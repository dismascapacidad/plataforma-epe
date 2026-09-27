// @ts-check
/**
 * Transporte USB: Web Serial (Chrome/Edge de escritorio y Chrome de Android
 * reciente) o, si el navegador no lo trae, el polyfill sobre WebUSB (tablets
 * Android con cable OTG). Habla a 9600 baudios, un comando por línea.
 *
 * Cumple la interfaz `Transporte` de conexion.js y suma dos cosas propias
 * de USB: `reconectarEnSilencio()` (reabre un puerto ya autorizado sin volver
 * a mostrar el selector) y `olvidar()`.
 *
 * El permiso del navegador es por ORIGEN (y, dentro de un iframe, por la
 * combinación página+iframe): un puerto autorizado en un origen no lo ve otro.
 */

import { EnsambladorDeLineas } from './lineas.js';
import { obtenerPolyfillSerial } from './polyfill-webusb.js';
import { ErrorDeTransporte } from './errores.js';

/**
 * VID/PID USB de productos dis+capacidad, para filtrar el selector del
 * navegador. Hoy solo se conoce el del disMouse con Pro Micro (aparece como
 * Arduino Micro). Por defecto NO se filtra: falta relevar los del resto.
 */
export const FILTROS_USB_CONOCIDOS = [{ usbVendorId: 0x2341, usbProductId: 0x8037 }];

/**
 * Elige la API serie disponible: nativa o polyfill WebUSB. `null` si no hay.
 * @returns {{ api: any, via: 'nativo' | 'polyfill-webusb' } | null}
 */
export function elegirApiSerial() {
  if (typeof navigator === 'undefined') return null;
  if ('serial' in navigator) return { api: navigator.serial, via: 'nativo' };
  if (typeof window === 'undefined') return null; // sin navegador (tests en Node)
  const pf = obtenerPolyfillSerial();
  return pf ? { api: pf.serial, via: 'polyfill-webusb' } : null;
}

/**
 * @param {unknown} e
 * @returns {ErrorDeTransporte}
 */
export function traducirErrorUsb(e) {
  const err = /** @type {any} */ (e);
  if (err instanceof ErrorDeTransporte) return err;
  const nombre = err?.name;
  const msg = err?.message ?? String(e);
  if (nombre === 'NotFoundError') {
    return new ErrorDeTransporte('cancelado', 'No se eligió ningún dispositivo.', e);
  }
  if (nombre === 'SecurityError') {
    return new ErrorDeTransporte(
      'permiso-bloqueado',
      'El navegador no permite usar el puerto USB en esta página.',
      e,
    );
  }
  if (nombre === 'NetworkError' || nombre === 'InvalidStateError') {
    return new ErrorDeTransporte(
      'puerto-ocupado',
      'No se pudo abrir el puerto: puede que otra pestaña o programa lo esté usando. Cerralos y volvé a intentar.',
      e,
    );
  }
  return new ErrorDeTransporte('error', `Error USB: ${msg}`, e);
}

export class TransporteUsb {
  /**
   * @param {Object} [op]
   * @param {any} [op.api]          Inyectable para tests; por defecto `elegirApiSerial()`.
   * @param {number} [op.baudRate=9600]
   * @param {Array<{ usbVendorId: number, usbProductId?: number }>} [op.filtros]
   */
  constructor(op = {}) {
    this.tipo = /** @type {'usb'} */ ('usb');
    this.baudRate = op.baudRate ?? 9600;
    this.filtros = op.filtros ?? [];
    this._api = op.api ?? null;
    /** @type {'nativo' | 'polyfill-webusb' | 'inyectado' | null} */
    this.via = op.api ? 'inyectado' : null;
    /** @type {any} */
    this._puerto = null;
    /** @type {ReadableStreamDefaultReader<Uint8Array> | null} */
    this._lector = null;
    /** @type {WritableStreamDefaultWriter<Uint8Array> | null} */
    this._escritor = null;
    this._cerrando = false;
    this._codificador = new TextEncoder();
    /** @type {(linea: string) => void} */
    this._alLinea = () => {};
    /** @type {() => void} */
    this._alDesconectar = () => {};
    this._ensamblador = new EnsambladorDeLineas((l) => this._alLinea(l));
  }

  /** ¿Este navegador puede hablar USB (nativo o por polyfill)? */
  static disponible() {
    return elegirApiSerial() !== null;
  }

  /** @param {(linea: string) => void} cb */
  alRecibirLinea(cb) {
    this._alLinea = cb;
  }

  /** @param {() => void} cb */
  alDesconectar(cb) {
    this._alDesconectar = cb;
  }

  /** VID/PID del puerto abierto, si el navegador lo informa. */
  get infoPuerto() {
    try {
      return this._puerto?.getInfo?.() ?? null;
    } catch {
      return null;
    }
  }

  _resolverApi() {
    if (this._api) return this._api;
    const elegida = elegirApiSerial();
    if (!elegida) {
      throw new ErrorDeTransporte(
        'no-disponible',
        'USB no disponible en este navegador. Usá Chrome o Edge en una PC, o Chrome en Android con cable OTG.',
      );
    }
    this._api = elegida.api;
    this.via = elegida.via;
    return this._api;
  }

  /** Muestra el selector del navegador y abre el puerto elegido. */
  async conectar() {
    const api = this._resolverApi();
    let puerto;
    try {
      puerto = await api.requestPort(this.filtros.length ? { filters: this.filtros } : undefined);
    } catch (e) {
      throw traducirErrorUsb(e);
    }
    await this._abrir(puerto);
  }

  /**
   * Reabre, sin mostrar el selector, un puerto que el usuario ya autorizó
   * antes en este origen. Devuelve `false` si no hay ninguno recordado.
   * @returns {Promise<boolean>}
   */
  async reconectarEnSilencio() {
    const api = this._resolverApi();
    let puertos;
    try {
      puertos = await api.getPorts();
    } catch (e) {
      throw traducirErrorUsb(e);
    }
    if (!puertos.length) return false;
    await this._abrir(puertos[0]);
    return true;
  }

  /** @param {any} puerto */
  async _abrir(puerto) {
    try {
      await puerto.open({ baudRate: this.baudRate });
      this._puerto = puerto;
      this._cerrando = false;
      this._ensamblador.reiniciar();
      this._lector = puerto.readable.getReader();
      this._escritor = puerto.writable.getWriter();
    } catch (e) {
      this._puerto = null;
      throw traducirErrorUsb(e);
    }
    this._bucleDeLectura(this._lector);
  }

  /** @param {ReadableStreamDefaultReader<Uint8Array>} lector */
  async _bucleDeLectura(lector) {
    try {
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        if (value) this._ensamblador.empujar(value);
      }
    } catch {
      /* el puerto se cayó: se resuelve abajo */
    }
    if (!this._cerrando) {
      this._limpiar();
      this._alDesconectar();
    }
  }

  /** @param {string} linea */
  async enviar(linea) {
    if (!this._escritor)
      throw new ErrorDeTransporte('sin-conexion', 'El puerto USB no está abierto.');
    await this._escritor.write(this._codificador.encode(linea + '\n'));
  }

  async desconectar() {
    this._cerrando = true;
    const lector = this._lector;
    const escritor = this._escritor;
    const puerto = this._puerto;
    try {
      if (lector) {
        await lector.cancel();
        lector.releaseLock();
      }
    } catch {
      /* nada */
    }
    try {
      if (escritor) {
        await escritor.close();
        escritor.releaseLock();
      }
    } catch {
      /* nada */
    }
    try {
      if (puerto) await puerto.close();
    } catch {
      /* nada */
    }
    this._limpiar();
  }

  /** Revoca el permiso del puerto (el navegador vuelve a pedirlo la próxima vez). */
  async olvidar() {
    const puerto = this._puerto;
    await this.desconectar();
    if (puerto?.forget) await puerto.forget();
  }

  _limpiar() {
    this._lector = null;
    this._escritor = null;
    this._puerto = null;
  }
}
