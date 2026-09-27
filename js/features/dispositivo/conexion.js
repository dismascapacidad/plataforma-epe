// @ts-check
/**
 * Orquestador de la conexión con un dispositivo dis+capacidad.
 *
 * Se apoya en un "transporte" (USB o BLE, ver transporte-usb.js y
 * transporte-ble.js) que solo sabe mandar y recibir líneas de texto. Acá está
 * la lógica común a los dos: detectar el modelo con `WHO`, leer la
 * configuración con `GETALL`, aplicar comandos, sacar un respaldo (snapshot)
 * y volver atrás verificando que lo restaurado quedó igual.
 *
 * IMPORTANTE — el dispositivo guarda cada comando en su memoria apenas lo
 * recibe (`SAVE` es solo una medida extra). No existe un modo "de prueba" que
 * se pierda al desenchufar: cualquier `aplicar()` cambia el dispositivo de
 * verdad. Por eso:
 *  - `aplicar()` solo acepta comandos de configuración bien formados (lista
 *    blanca en protocolo.js): nunca `SAVE`, `RESET` ni comandos crudos.
 *  - `SAVE` y `RESET` tienen métodos propios y explícitos; el núcleo no los
 *    manda por su cuenta en ningún momento.
 *  - Antes de tocar nada conviene `tomarSnapshot()`; `restaurar()` vuelve
 *    atrás y RELEE el dispositivo para comprobar el resultado.
 */

import { emptyCfg, parseWho, parseDeviceLine, esComandoDeConfiguracion } from './protocolo.js';
import { estaDesactualizado } from './firmware.js';
import { productoPorModelo, normalizarModelo } from './productos.js';
import {
  comandosDeRestauracion,
  compararConfiguraciones,
  clonarCfg,
  entradasFaltantes,
} from './configuracion.js';

/** @typedef {import('./protocolo.js').DeviceCfg} DeviceCfg */
/** @typedef {import('./productos.js').Producto} Producto */
/** @typedef {import('./configuracion.js').Snapshot} Snapshot */
/** @typedef {import('./configuracion.js').Diferencia} Diferencia */

/**
 * Lo que un transporte tiene que ofrecer (USB y BLE lo cumplen).
 * @typedef {Object} Transporte
 * @property {'usb' | 'ble'} tipo
 * @property {() => Promise<void>} conectar     Pide el dispositivo al usuario y abre el canal.
 * @property {(linea: string) => Promise<void>} enviar   Manda una línea (el transporte agrega el `\n`).
 * @property {(cb: (linea: string) => void) => void} alRecibirLinea
 * @property {(cb: () => void) => void} alDesconectar
 * @property {() => Promise<void>} desconectar
 * @property {() => Promise<boolean>} [reconectarEnSilencio]  Solo USB: reabre un puerto ya autorizado sin selector.
 */

/**
 * @typedef {Object} OpcionesConexion
 * @property {number} [esperaWhoMs=2500]        Cuánto esperar la respuesta a `WHO`.
 * @property {number} [silencioGetAllMs=1000]    Silencio que da por terminada la respuesta a `GETALL`.
 * @property {number} [esperaMaxGetAllMs=5000]  Tope total para `GETALL`.
 * @property {number} [pausaEntreComandosMs=90]  Pausa entre comandos al aplicar. 90 ms es lo que espera el configurador actual tras cada envío; se conserva ese ritmo porque es el que ya se usa en producción.
 */

/**
 * @typedef {Object} InfoDispositivo
 * @property {string | null} modelo        Como lo informa `WHO`; `null` si no contestó.
 * @property {string | null} version
 * @property {Producto | null} producto    `null` si el modelo no se reconoce.
 * @property {boolean} desactualizado
 * @property {boolean} sinWho              El dispositivo no contestó `WHO` (firmware viejo).
 * @property {number | null} latenciaWhoMs Cuánto tardó en contestar `WHO`.
 */

/**
 * @typedef {Object} ResultadoRestauracion
 * @property {boolean} ok                  Lo releído quedó idéntico al respaldo.
 * @property {Diferencia[]} diferencias    Qué quedó distinto (vacío si `ok`).
 * @property {string[]} advertencias       Entradas que no se pudieron restaurar.
 * @property {number} comandosEnviados
 */

export const ESTADOS = /** @type {const} */ ({
  DESCONECTADO: 'desconectado',
  CONECTANDO: 'conectando',
  CONECTADO: 'conectado',
});

/** Error propio del núcleo, para distinguirlo de errores del navegador. */
export class ErrorDeConexion extends Error {
  /** @param {string} mensaje */
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorDeConexion';
  }
}

const RE_LINEA_DE_CONFIG = /^(ORIENT|VEL|ACEL|FMODE|BTN):/;

/** @param {number} ms */
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export class Conexion {
  /** @type {Transporte} */
  #t;
  /** @type {Required<OpcionesConexion>} */
  #op;
  /** @type {string} */
  #estado = ESTADOS.DESCONECTADO;
  /** @type {InfoDispositivo | null} */
  #info = null;
  /** @type {DeviceCfg | null} */
  #cfg = null;
  /** @type {Snapshot | null} */
  #snapshot = null;
  /** @type {((who: { model: string, version: string }) => void) | null} */
  #resolverWho = null;
  /** @type {((linea: string) => void) | null} */
  #recibirConfig = null;
  /** @type {Set<(e: Error) => void>} */
  #pendientes = new Set();
  /** @type {Set<(e: { sentido: 'tx' | 'rx', linea: string }) => void>} */
  #oyentesRegistro = new Set();
  /** @type {Set<(estado: string) => void>} */
  #oyentesEstado = new Set();
  /** @type {Promise<unknown>} */
  #cola = Promise.resolve();

  /**
   * @param {Transporte} transporte
   * @param {OpcionesConexion} [opciones]
   */
  constructor(transporte, opciones = {}) {
    this.#t = transporte;
    this.#op = {
      esperaWhoMs: 2500,
      silencioGetAllMs: 1000,
      esperaMaxGetAllMs: 5000,
      pausaEntreComandosMs: 90,
      ...opciones,
    };
    transporte.alRecibirLinea((l) => this.#alLinea(l));
    transporte.alDesconectar(() => this.#alPerderConexion());
  }

  // ── Estado visible ─────────────────────────────────────────────────

  get estado() {
    return this.#estado;
  }
  get tipoDeTransporte() {
    return this.#t.tipo;
  }
  /** @returns {InfoDispositivo | null} */
  get info() {
    return this.#info;
  }
  /** Última configuración leída (o `null` si todavía no se leyó). */
  get cfg() {
    return this.#cfg;
  }
  /** Último snapshot tomado (o `null`). */
  get ultimoSnapshot() {
    return this.#snapshot;
  }

  /**
   * Registro de todo lo que se manda (`tx`) y recibe (`rx`), para mostrar un
   * log. Devuelve una función para dejar de escuchar.
   * @param {(e: { sentido: 'tx' | 'rx', linea: string }) => void} cb
   */
  alRegistro(cb) {
    this.#oyentesRegistro.add(cb);
    return () => this.#oyentesRegistro.delete(cb);
  }

  /**
   * @param {(estado: string) => void} cb
   */
  alCambioDeEstado(cb) {
    this.#oyentesEstado.add(cb);
    return () => this.#oyentesEstado.delete(cb);
  }

  // ── Operaciones ────────────────────────────────────────────────────

  /**
   * Abre el canal (el navegador muestra su selector) y detecta el modelo con
   * `WHO`. Si el dispositivo no contesta (firmware viejo) igual queda
   * conectado, con `sinWho: true`.
   * @param {{ silencioso?: boolean }} [opciones]  `silencioso`: reabrir un puerto ya
   *   autorizado sin mostrar el selector (solo USB). Si no hay ninguno recordado falla.
   * @returns {Promise<InfoDispositivo>}
   */
  conectar({ silencioso = false } = {}) {
    return this.#enCola(async () => {
      if (this.#estado !== ESTADOS.DESCONECTADO) {
        throw new ErrorDeConexion('Ya hay una conexión abierta.');
      }
      this.#cambiarEstado(ESTADOS.CONECTANDO);
      try {
        if (silencioso) {
          if (!this.#t.reconectarEnSilencio) {
            throw new ErrorDeConexion('Este tipo de conexión no permite reconectar sin selector.');
          }
          const abrio = await this.#t.reconectarEnSilencio();
          if (!abrio) throw new ErrorDeConexion('No hay ningún dispositivo autorizado de antes.');
        } else {
          await this.#t.conectar();
        }
      } catch (e) {
        this.#cambiarEstado(ESTADOS.DESCONECTADO);
        throw e;
      }
      this.#cambiarEstado(ESTADOS.CONECTADO);

      const inicio = Date.now();
      const who = await this.#pedirWho();
      const modelo = who ? who.model : null;
      const version = who ? who.version : null;
      this.#info = {
        modelo,
        version,
        producto: modelo ? productoPorModelo(modelo) : null,
        desactualizado: modelo && version ? estaDesactualizado(modelo, version) : false,
        sinWho: !who,
        latenciaWhoMs: who ? Date.now() - inicio : null,
      };
      return this.#info;
    });
  }

  /**
   * Lee la configuración actual del dispositivo (`GETALL`).
   * @returns {Promise<DeviceCfg>}
   */
  leerConfig() {
    return this.#enCola(() => this.#leerConfigInterno().then((r) => r.cfg));
  }

  /**
   * Lee el dispositivo y guarda una copia de respaldo (no modifica nada).
   * @returns {Promise<Snapshot>}
   */
  tomarSnapshot() {
    return this.#enCola(async () => {
      const { cfg, crudas } = await this.#leerConfigInterno();
      /** @type {Snapshot} */
      const snap = {
        formato: 1,
        tomadoEn: new Date().toISOString(),
        modelo: this.#info?.modelo ?? '',
        firmware: this.#info?.version ?? '',
        cfg: clonarCfg(cfg),
        lineasCrudas: crudas,
        faltantes: entradasFaltantes(cfg, this.#info?.producto ?? null),
      };
      this.#snapshot = snap;
      return snap;
    });
  }

  /**
   * Manda comandos de configuración. Valida TODOS antes de enviar el primero:
   * si alguno no está permitido no se manda ninguno.
   * @param {string[]} comandos
   * @returns {Promise<{ enviados: number }>}
   */
  aplicar(comandos) {
    return this.#enCola(() => this.#aplicarInterno(comandos));
  }

  /**
   * Vuelve a dejar el dispositivo como estaba en el snapshot y, por defecto,
   * lo relee para comprobar que quedó idéntico.
   * @param {Snapshot} snapshot
   * @param {{ verificar?: boolean }} [opciones]
   * @returns {Promise<ResultadoRestauracion>}
   */
  restaurar(snapshot, { verificar = true } = {}) {
    return this.#enCola(async () => {
      this.#exigirConectado();
      const modeloActual = this.#info?.modelo;
      if (
        modeloActual &&
        snapshot.modelo &&
        normalizarModelo(modeloActual) !== normalizarModelo(snapshot.modelo)
      ) {
        throw new ErrorDeConexion(
          `El respaldo es de un ${snapshot.modelo} y hay un ${modeloActual} conectado: no se restaura.`,
        );
      }
      const { comandos, advertencias } = comandosDeRestauracion(snapshot.cfg);
      const { enviados } = await this.#aplicarInterno(comandos);
      if (!verificar) {
        return { ok: true, diferencias: [], advertencias, comandosEnviados: enviados };
      }
      const { cfg } = await this.#leerConfigInterno();
      const diferencias = compararConfiguraciones(snapshot.cfg, cfg);
      return {
        ok: diferencias.length === 0,
        diferencias,
        advertencias,
        comandosEnviados: enviados,
      };
    });
  }

  /**
   * Manda `SAVE` (afirma en la memoria del dispositivo lo ya aplicado). Como
   * el dispositivo ya guarda cada comando al recibirlo, esto es una medida de
   * seguridad; el núcleo nunca lo llama solo.
   */
  guardarEnMemoria() {
    return this.#enCola(async () => {
      this.#exigirConectado();
      await this.#enviarCrudo('SAVE');
    });
  }

  /**
   * Manda `RESET` (valores de fábrica del firmware). Destructivo: exige
   * `{ confirmado: true }` para que no se pueda llamar por accidente.
   * @param {{ confirmado: boolean }} opciones
   */
  restablecerDeFabrica(opciones) {
    return this.#enCola(async () => {
      if (!opciones || opciones.confirmado !== true) {
        throw new ErrorDeConexion('Restablecer de fábrica exige confirmación explícita.');
      }
      this.#exigirConectado();
      await this.#enviarCrudo('RESET');
    });
  }

  /** Cierra la conexión. */
  async desconectar() {
    try {
      await this.#t.desconectar();
    } finally {
      this.#alPerderConexion();
    }
  }

  // ── Internos ───────────────────────────────────────────────────────

  /**
   * Serializa las operaciones: nunca se mezclan dos a la vez sobre el mismo
   * canal (una respuesta de GETALL no puede cruzarse con un aplicar).
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  #enCola(fn) {
    const siguiente = this.#cola.then(fn, fn);
    this.#cola = siguiente.catch(() => undefined);
    return siguiente;
  }

  #exigirConectado() {
    if (this.#estado !== ESTADOS.CONECTADO) {
      throw new ErrorDeConexion('No hay un dispositivo conectado.');
    }
  }

  /** @param {string} nuevo */
  #cambiarEstado(nuevo) {
    if (this.#estado === nuevo) return;
    this.#estado = nuevo;
    for (const cb of this.#oyentesEstado) cb(nuevo);
  }

  /** @param {string} linea */
  async #enviarCrudo(linea) {
    if (/[\r\n]/.test(linea))
      throw new ErrorDeConexion('Un comando no puede tener saltos de línea.');
    for (const cb of this.#oyentesRegistro) cb({ sentido: 'tx', linea });
    await this.#t.enviar(linea);
  }

  /** @param {string} linea */
  #alLinea(linea) {
    for (const cb of this.#oyentesRegistro) cb({ sentido: 'rx', linea });
    const who = parseWho(linea);
    if (who) {
      if (this.#resolverWho) this.#resolverWho(who);
      return;
    }
    if (this.#recibirConfig) this.#recibirConfig(linea);
  }

  #alPerderConexion() {
    const habiaConexion = this.#estado !== ESTADOS.DESCONECTADO;
    const pendientes = [...this.#pendientes];
    this.#pendientes.clear();
    this.#cambiarEstado(ESTADOS.DESCONECTADO);
    if (habiaConexion) {
      for (const rechazar of pendientes)
        rechazar(new ErrorDeConexion('El dispositivo se desconectó.'));
    }
  }

  /** @returns {Promise<{ model: string, version: string } | null>} */
  async #pedirWho() {
    /** @type {(e: Error) => void} */
    let rechazarPendiente = () => {};
    try {
      return await new Promise((resolve, reject) => {
        rechazarPendiente = reject;
        this.#pendientes.add(reject);
        const timer = setTimeout(() => resolve(null), this.#op.esperaWhoMs);
        this.#resolverWho = (who) => {
          clearTimeout(timer);
          resolve(who);
        };
        this.#enviarCrudo('WHO').catch((e) => {
          clearTimeout(timer);
          reject(e);
        });
      });
    } finally {
      this.#resolverWho = null;
      this.#pendientes.delete(rechazarPendiente);
    }
  }

  /** @returns {Promise<{ cfg: DeviceCfg, crudas: string[] }>} */
  async #leerConfigInterno() {
    this.#exigirConectado();
    const cfg = emptyCfg();
    /** @type {string[]} */
    const crudas = [];
    let recibio = false;
    let ultima = 0;
    /** @type {(e: Error) => void} */
    let rechazarPendiente = () => {};

    this.#recibirConfig = (linea) => {
      if (!RE_LINEA_DE_CONFIG.test(linea)) return;
      parseDeviceLine(linea, cfg);
      crudas.push(linea);
      recibio = true;
      ultima = Date.now();
    };

    try {
      await new Promise((resolve, reject) => {
        rechazarPendiente = reject;
        this.#pendientes.add(reject);
        const inicio = Date.now();
        const revisar = () => {
          const ahora = Date.now();
          if (recibio && ahora - ultima >= this.#op.silencioGetAllMs) return resolve(undefined);
          if (ahora - inicio >= this.#op.esperaMaxGetAllMs) {
            return recibio
              ? resolve(undefined)
              : reject(new ErrorDeConexion('El dispositivo no respondió a GETALL.'));
          }
          if (this.#estado !== ESTADOS.CONECTADO) return; // la desconexión ya rechazó la promesa
          setTimeout(revisar, 10);
        };
        this.#enviarCrudo('GETALL').then(revisar, reject);
      });
    } finally {
      this.#recibirConfig = null;
      this.#pendientes.delete(rechazarPendiente);
    }
    this.#cfg = cfg;
    return { cfg, crudas };
  }

  /**
   * @param {string[]} comandos
   * @returns {Promise<{ enviados: number }>}
   */
  async #aplicarInterno(comandos) {
    this.#exigirConectado();
    const rechazados = comandos.filter((c) => !esComandoDeConfiguracion(c));
    if (rechazados.length) {
      throw new ErrorDeConexion(
        `Comandos no permitidos, no se envió ninguno: ${rechazados.map((c) => JSON.stringify(c)).join(', ')}`,
      );
    }
    let enviados = 0;
    for (const c of comandos) {
      this.#exigirConectado();
      await this.#enviarCrudo(c);
      enviados++;
      if (this.#op.pausaEntreComandosMs > 0) await esperar(this.#op.pausaEntreComandosMs);
    }
    return { enviados };
  }
}
