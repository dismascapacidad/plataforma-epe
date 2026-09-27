// @ts-check
/**
 * Transporte Bluetooth LE: Web Bluetooth + Nordic UART Service (NUS), que
 * emula un puerto serie. Mismos comandos de texto que por USB.
 *
 * Diferencias con USB que conviene tener presentes:
 *  - El navegador NO ofrece reabrir un dispositivo ya elegido sin volver a
 *    mostrar el selector (`getDevices()` no existe en Chrome/Edge sin un flag),
 *    así que cada carga de página necesita `conectar()` con selector.
 *  - Se escribe en paquetes de 20 bytes (el MTU mínimo garantizado).
 *  - En Windows, si el dispositivo está emparejado como mouse en el sistema,
 *    el navegador no puede leer su GATT: se informa como `hid-windows`.
 */

import { EnsambladorDeLineas, partirEnPaquetes } from './lineas.js';
import { ErrorDeTransporte } from './errores.js';

export const BLE_SERVICIO = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const BLE_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // escribir hacia el dispositivo
export const BLE_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // notificaciones desde el dispositivo

// El firmware anuncia HID pero expone también el servicio UART; el selector
// acepta cualquier dispositivo porque puede aparecer sin nombre.
const SERVICIOS_OPCIONALES = [
  BLE_SERVICIO,
  '00001812-0000-1000-8000-00805f9b34fb', // HID over GATT
  '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
  '0000180f-0000-1000-8000-00805f9b34fb', // Battery
];

const TAMANO_PAQUETE = 20;

/**
 * @param {unknown} e
 * @returns {ErrorDeTransporte}
 */
export function traducirErrorBle(e) {
  const err = /** @type {any} */ (e);
  if (err instanceof ErrorDeTransporte) return err;
  const nombre = err?.name;
  const msg = err?.message ?? String(e);
  if (nombre === 'NotFoundError' || nombre === 'AbortError') {
    return new ErrorDeTransporte('cancelado', 'No se eligió ningún dispositivo.', e);
  }
  if (nombre === 'SecurityError') {
    return new ErrorDeTransporte(
      'hid-windows',
      'El navegador no puede acceder al dispositivo. Si está emparejado como mouse en el sistema, quitalo desde la configuración de Bluetooth y volvé a intentar.',
      e,
    );
  }
  if (nombre === 'NetworkError') {
    return new ErrorDeTransporte('sin-conexion', 'No se pudo establecer la conexión Bluetooth.', e);
  }
  return new ErrorDeTransporte('error', `Error Bluetooth: ${msg}`, e);
}

export class TransporteBle {
  /**
   * @param {Object} [op]
   * @param {any} [op.bluetooth]  Inyectable para tests; por defecto `navigator.bluetooth`.
   */
  constructor(op = {}) {
    this.tipo = /** @type {'ble'} */ ('ble');
    this._bluetooth =
      op.bluetooth ??
      (typeof navigator !== 'undefined' ? /** @type {any} */ (navigator).bluetooth : null);
    /** @type {any} */
    this._dispositivo = null;
    /** @type {any} */
    this._tx = null;
    this._codificador = new TextEncoder();
    /** @type {(linea: string) => void} */
    this._alLinea = () => {};
    /** @type {() => void} */
    this._alDesconectar = () => {};
    this._ensamblador = new EnsambladorDeLineas((l) => this._alLinea(l));
  }

  /** ¿Este navegador ofrece Web Bluetooth? (No en iOS ni en Firefox/Safari.) */
  static disponible() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /** @param {(linea: string) => void} cb */
  alRecibirLinea(cb) {
    this._alLinea = cb;
  }

  /** @param {() => void} cb */
  alDesconectar(cb) {
    this._alDesconectar = cb;
  }

  /** Nombre del dispositivo elegido (puede estar vacío). */
  get nombre() {
    return this._dispositivo?.name ?? '';
  }

  async conectar() {
    if (!this._bluetooth) {
      throw new ErrorDeTransporte(
        'no-disponible',
        'Bluetooth no disponible en este navegador. Usá Chrome o Edge (en iPhone/iPad no está soportado): podés configurar por USB desde una PC.',
      );
    }
    let dispositivo;
    try {
      dispositivo = await this._bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: SERVICIOS_OPCIONALES,
      });
    } catch (e) {
      throw traducirErrorBle(e);
    }
    this._dispositivo = dispositivo;
    dispositivo.addEventListener('gattserverdisconnected', () => {
      const estaba = this._tx !== null;
      this._tx = null;
      if (estaba) this._alDesconectar();
    });

    try {
      const servidor = await dispositivo.gatt.connect();
      const servicio = await this._obtenerServicioUart(servidor);
      const rx = await servicio.getCharacteristic(BLE_RX);
      await rx.startNotifications();
      this._ensamblador.reiniciar();
      rx.addEventListener('characteristicvaluechanged', (/** @type {any} */ ev) => {
        this._ensamblador.empujar(ev.target.value);
      });
      this._tx = await servicio.getCharacteristic(BLE_TX);
    } catch (e) {
      try {
        if (dispositivo.gatt?.connected) dispositivo.gatt.disconnect();
      } catch {
        /* nada */
      }
      this._dispositivo = null;
      this._tx = null;
      throw traducirErrorBle(e);
    }
  }

  /**
   * Busca el servicio UART; si falla, distingue las dos causas típicas para
   * dar un mensaje útil (dispositivo equivocado vs. conflicto con el mouse HID).
   * @param {any} servidor
   */
  async _obtenerServicioUart(servidor) {
    try {
      return await servidor.getPrimaryService(BLE_SERVICIO);
    } catch (e) {
      let servicios = [];
      try {
        servicios = await servidor.getPrimaryServices();
      } catch {
        throw new ErrorDeTransporte(
          'hid-windows',
          'No se pudieron leer los servicios del dispositivo: probablemente está emparejado como mouse en el sistema. Quitalo desde la configuración de Bluetooth y volvé a intentar.',
          e,
        );
      }
      const hayUart = servicios.some((/** @type {any} */ s) =>
        String(s.uuid).startsWith('6e400001'),
      );
      if (hayUart) {
        throw new ErrorDeTransporte(
          'hid-windows',
          'El servicio de comandos existe pero el navegador no puede usarlo: probablemente el dispositivo está emparejado como mouse en el sistema. Quitalo desde la configuración de Bluetooth y volvé a intentar.',
          e,
        );
      }
      throw new ErrorDeTransporte(
        'sin-uart',
        'El dispositivo elegido no tiene el servicio de comandos. Probablemente elegiste otro dispositivo de la lista.',
        e,
      );
    }
  }

  /** @param {string} linea */
  async enviar(linea) {
    if (!this._tx)
      throw new ErrorDeTransporte('sin-conexion', 'El dispositivo Bluetooth no está conectado.');
    for (const paquete of partirEnPaquetes(
      this._codificador.encode(linea + '\n'),
      TAMANO_PAQUETE,
    )) {
      await this._tx.writeValue(paquete);
    }
  }

  async desconectar() {
    const dispositivo = this._dispositivo;
    this._tx = null; // primero: así el aviso de desconexión no se dispara por un cierre propio
    try {
      if (dispositivo?.gatt?.connected) dispositivo.gatt.disconnect();
    } catch {
      /* nada */
    }
    this._dispositivo = null;
  }
}
