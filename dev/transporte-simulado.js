// @ts-check
/**
 * Transporte simulado (para los tests y para probar el arnés sin hardware,
 * abriendo `dev/arnes-dispositivo.html?simulado=1`): se comporta como un dispositivo
 * dis+capacidad real a nivel de protocolo (responde WHO y GETALL, y va
 * cambiando su configuración a medida que recibe CFG/FMODE/ORIENT/VEL/ACEL).
 * Guarda todo lo que recibe en `enviados` para poder afirmar, por ejemplo,
 * que NUNCA se mandó SAVE ni RESET sin que nadie lo pidiera.
 *
 * Soporta Tap-Hold igual que el firmware real: si `firmware` termina en
 * `-TH<n>` (el default, `R019-TH1`), `GETALL` manda la línea `BTN:` extendida
 * de 11 campos para TODOS los botones (con los 4 últimos en 0 si no están en
 * modo T — es el comportamiento documentado del firmware real), acepta
 * `CFG:...:T:...` de 11 campos, y devuelve `ERR:MODE` si se manda `H` (retirado)
 * o `T` a un firmware que no lo soporta.
 */

import { supportsTapHold } from '../js/features/dispositivo/protocolo.js';

/** @typedef {import('../js/features/dispositivo/protocolo.js').DeviceCfg} DeviceCfg */

const CODIGO_A_INDICE = { BR: 0, BA: 1, BN: 2, BC: 3, FU: 4, FD: 5, FL: 6, FR: 7 };
const TIPO = { K: 1, M: 0, X: 2 };
const MODO = { P: 0, R: 1, O: 3, T: 4 };
const MODS = { C: 1, S: 2, A: 4, G: 8 };
const FLAGS = { D: 1, M: 2 };

/** @returns {DeviceCfg} */
export function cfgInicial() {
  return {
    orient: 0,
    vel: 10,
    acel: 0,
    fmode: 0,
    btns: {
      0: { tipo: 0, modo: 0, debounce: 0, accion: 1, mods: 0, flags: 0 },
      1: { tipo: 0, modo: 0, debounce: 0, accion: 2, mods: 0, flags: 0 },
      2: { tipo: 1, modo: 3, debounce: 30, accion: 99, mods: 1, flags: 0 }, // 'c'+Ctrl, una vez
      3: { tipo: 1, modo: 1, debounce: 0, accion: 215, mods: 0, flags: 0 }, // ENTER al soltar
      4: { tipo: 2, modo: 0, debounce: 0, accion: 0, mods: 0, flags: 0 },
      5: { tipo: 2, modo: 0, debounce: 0, accion: 0, mods: 0, flags: 0 },
      6: { tipo: 0, modo: 0, debounce: 0, accion: 8, mods: 0, flags: 0 },
      7: { tipo: 0, modo: 0, debounce: 0, accion: 1, mods: 0, flags: 1 },
    },
  };
}

/**
 * Igual que `cfgInicial()`, pero con BR (índice 0) en Tap-Hold: corta 'k',
 * larga 'l', 500 ms — reproduce el caso real que encontró la prueba de
 * hardware del 2026-09-27 (disMouse R019-TH1). Sirve para no volver a
 * descubrir en hardware real algo que el arnés simulado ya puede probar.
 * @returns {DeviceCfg}
 */
export function cfgConTapHoldEnBR() {
  const cfg = cfgInicial();
  cfg.btns[0] = {
    tipo: 1,
    modo: 4,
    debounce: 0,
    accion: 107, // 'k'
    mods: 0,
    flags: 0,
    accionLarga: 108, // 'l'
    modsLarga: 0,
    flagsLarga: 0,
    umbral: 500,
  };
  return cfg;
}

export class TransporteSimulado {
  /**
   * @param {Object} [op]
   * @param {string} [op.modelo]
   * @param {string} [op.firmware]
   * @param {DeviceCfg} [op.cfg]
   * @param {boolean} [op.respondeWho=true]
   * @param {boolean} [op.respondeGetAll=true]
   * @param {number} [op.latenciaMs=1]
   * @param {string[]} [op.ignoraCodigos]  Códigos de botón cuyos CFG el "firmware" ignora (para probar que la verificación detecta diferencias).
   * @param {number[]} [op.omiteBotones]   Índices de botón cuya línea BTN el "firmware" no envía en GETALL (simula una lectura incompleta).
   * @param {string[]} [op.lineasExtra]    Líneas ajenas a la config que el dispositivo emite junto a GETALL.
   */
  constructor(op = {}) {
    this.tipo = /** @type {'usb'} */ ('usb');
    this.modelo = op.modelo ?? 'disMouse';
    this.firmware = op.firmware ?? 'R019-TH1';
    this.cfg = op.cfg ?? cfgInicial();
    this.respondeWho = op.respondeWho ?? true;
    this.respondeGetAll = op.respondeGetAll ?? true;
    this.latenciaMs = op.latenciaMs ?? 1;
    this.ignoraCodigos = op.ignoraCodigos ?? [];
    this.omiteBotones = op.omiteBotones ?? [];
    this.lineasExtra = op.lineasExtra ?? [];
    /** @type {string[]} */
    this.enviados = [];
    this.guardados = 0;
    this.reseteos = 0;
    this.conectado = false;
    /** @type {(l: string) => void} */
    this.enLinea = () => {};
    /** @type {() => void} */
    this.enDesconexion = () => {};
  }

  /** ¿Este "firmware" simulado soporta Tap-Hold? Igual regla que el real. */
  get tapHold() {
    return supportsTapHold(this.firmware);
  }

  async conectar() {
    this.conectado = true;
  }

  /** Como el USB real: reabre sin selector un dispositivo "ya autorizado". */
  async reconectarEnSilencio() {
    this.conectado = true;
    return true;
  }

  /** @param {string} linea */
  async enviar(linea) {
    if (!this.conectado) throw new Error('canal cerrado');
    this.enviados.push(linea);
    setTimeout(() => this.#procesar(linea), this.latenciaMs);
  }

  /** @param {(l: string) => void} cb */
  alRecibirLinea(cb) {
    this.enLinea = cb;
  }

  /** @param {() => void} cb */
  alDesconectar(cb) {
    this.enDesconexion = cb;
  }

  async desconectar() {
    this.conectado = false;
  }

  /** Simula que se desenchufó el cable. */
  caerse() {
    this.conectado = false;
    this.enDesconexion();
  }

  /** @param {string} linea */
  #procesar(linea) {
    if (!this.conectado) return;
    if (linea === 'WHO') {
      if (this.respondeWho) this.enLinea(`OK:WHO:${this.modelo}:${this.firmware}`);
    } else if (linea === 'GETALL') {
      if (!this.respondeGetAll) return;
      const c = this.cfg;
      for (const extra of this.lineasExtra) this.enLinea(extra);
      this.enLinea(`ORIENT:${c.orient}`);
      this.enLinea(`VEL:${c.vel}`);
      this.enLinea(`ACEL:${c.acel}`);
      this.enLinea(`FMODE:${c.fmode}`);
      for (const [i, b] of Object.entries(c.btns)) {
        if (this.omiteBotones.includes(Number(i))) continue;
        let l = `BTN:${i}:${b.tipo}:${b.modo}:${b.debounce}:${b.accion}:${b.mods}:${b.flags}`;
        // Firmware -TH: SIEMPRE 11 campos, aunque el botón no esté en modo T
        // (ahí los 4 últimos van en 0) — así lo documenta el protocolo real.
        if (this.tapHold) {
          l += `:${b.accionLarga || 0}:${b.modsLarga || 0}:${b.flagsLarga || 0}:${b.umbral || 0}`;
        }
        this.enLinea(l);
      }
    } else if (linea === 'SAVE') {
      this.guardados++;
    } else if (linea === 'RESET') {
      this.reseteos++;
      this.cfg = cfgInicial();
    } else if (linea.startsWith('CFG:')) {
      this.#aplicarCfg(linea);
    } else if (linea.startsWith('FMODE:')) {
      this.cfg.fmode = parseInt(linea.slice(6), 10);
    } else if (linea.startsWith('ORIENT:')) {
      this.cfg.orient = parseInt(linea.slice(7), 10);
    } else if (linea.startsWith('VEL:')) {
      this.cfg.vel = parseInt(linea.slice(4), 10);
    } else if (linea.startsWith('ACEL:')) {
      this.cfg.acel = parseInt(linea.slice(5), 10);
    }
  }

  /** @param {string} accion */
  #decodificarAccion(tipo, accion) {
    if (accion === 'SU') return 8;
    if (accion === 'SD') return 16;
    if (/^\d+$/.test(accion) && (accion.length > 1 || tipo !== 'K')) return parseInt(accion, 10);
    return accion.charCodeAt(0); // carácter suelto (incluye el espacio)
  }

  /** @param {string} linea */
  #aplicarCfg(linea) {
    const p = linea.split(':');
    const [, code, tipo, modo, debounce, accion, mods, flags] = p;
    if (this.ignoraCodigos.includes(code)) return;
    // Igual que el firmware real: modo no reconocido (H, retirado) o T sin
    // soporte del firmware → ERR:MODE, no se aplica nada.
    const modoNum = /** @type {Record<string, number>} */ (MODO)[modo];
    if (modoNum === undefined || (modo === 'T' && !this.tapHold)) {
      this.enLinea('ERR:MODE');
      return;
    }
    const idx = /** @type {Record<string, number>} */ (CODIGO_A_INDICE)[code];
    let m = 0;
    for (const ch of mods.trim()) m |= /** @type {Record<string, number>} */ (MODS)[ch] ?? 0;
    let f = 0;
    for (const ch of flags.trim()) f |= /** @type {Record<string, number>} */ (FLAGS)[ch] ?? 0;
    /** @type {DeviceCfg['btns'][string]} */
    const b = {
      tipo: /** @type {Record<string, number>} */ (TIPO)[tipo],
      modo: modoNum,
      debounce: parseInt(debounce, 10),
      accion: this.#decodificarAccion(tipo, accion),
      mods: m,
      flags: f,
    };
    if (modo === 'T') {
      const [, , , , , , , , accionL, modsL, flagsL, umbral] = p;
      let ml = 0;
      for (const ch of modsL.trim()) ml |= /** @type {Record<string, number>} */ (MODS)[ch] ?? 0;
      let fl = 0;
      if (flagsL === 'M' || flagsL === '2') fl = 2;
      b.accionLarga = this.#decodificarAccion(tipo, accionL);
      b.modsLarga = ml;
      b.flagsLarga = fl;
      b.umbral = parseInt(umbral, 10) || 0;
    } else if (this.tapHold) {
      // El firmware -TH resetea los campos Tap-Hold en cualquier CFG que no
      // sea T (ver protocolo-configurador-dis-epe.md §6).
      b.accionLarga = 0;
      b.modsLarga = 0;
      b.flagsLarga = 0;
      b.umbral = 0;
    }
    this.cfg.btns[idx] = b;
  }
}
