// @ts-check
/**
 * Del requisito de un recurso a los comandos del dispositivo.
 *
 * Funciones puras, sin DOM ni conexión: se pueden probar en Node. El criterio
 * es el más simple posible: configurar SOLO lo que el recurso necesita para
 * usarse, sin tocar nada más (orientación, otros botones, etc.). La
 * personalización fina es del configurador, no de la plataforma.
 *
 * Todo lo que sale de acá pasa igual por la lista blanca del núcleo
 * (`esComandoDeConfiguracion`, en `Conexion.aplicar`).
 */

import {
  buildButtonCfg,
  normalizeThreshold,
  TH_DEFAULT_MS,
  TH_MIN_MS,
  TH_MAX_MS,
} from '../dispositivo/protocolo.js';

export { TH_DEFAULT_MS, TH_MIN_MS, TH_MAX_MS };

/** @typedef {import('./teclas-externas.js').Requisito} Requisito */

/** Rango y valores por defecto del cursor (el firmware acepta VEL 1..50). */
export const VEL_MIN = 1;
export const VEL_MAX = 50;
export const VEL_DEFECTO = 15;

/** Cómo se resuelve "arrastrar": ver `describir`. */
export const ARRASTRES = /** @type {const} */ (['toque', 'mantener']);
/** @typedef {'toque'|'mantener'} Arrastre */

// ─────────────────────────────────────────────────────────────────────────
// Traducción de tecla: formato de las apps (EpeTeclas) → token que entiende
// `buildButtonCfg`/`cvKey` del núcleo. Sin esto, espacio/flechas/escape
// quedarían mal configurados en el dispositivo sin ningún aviso.
// ─────────────────────────────────────────────────────────────────────────
/** @type {Record<string, string>} */
const TOKEN_ESPECIAL = {
  ' ': 'SPACE',
  arrowleft: 'LEFT_ARROW',
  arrowright: 'RIGHT_ARROW',
  arrowup: 'UP_ARROW',
  arrowdown: 'DOWN_ARROW',
  escape: 'ESC',
};

/** @param {string} tecla */
export function tokenParaNucleo(tecla) {
  return TOKEN_ESPECIAL[tecla] ?? tecla;
}

/** @param {string} tecla Igual criterio de etiqueta legible que `EpeTeclas.etiqueta`. */
export function teclaLegible(tecla) {
  /** @type {Record<string, string>} */
  const NOMBRES = {
    ' ': 'Espacio',
    enter: 'Enter',
    tab: 'Tab',
    escape: 'Esc',
    arrowleft: '←',
    arrowright: '→',
    arrowup: '↑',
    arrowdown: '↓',
    backspace: 'Retroceso',
    delete: 'Supr',
  };
  if (!tecla) return '—';
  if (NOMBRES[tecla]) return NOMBRES[tecla];
  if (tecla.length === 1) return tecla.toUpperCase();
  return tecla.charAt(0).toUpperCase() + tecla.slice(1);
}

/** Acción de mouse del requisito → `mouseAction` de `buildButtonCfg` y texto. */
const MOUSE = {
  clic: { accion: '1', texto: 'clic izquierdo' },
  'clic-derecho': { accion: '2', texto: 'clic derecho' },
  'clic-central': { accion: '4', texto: 'clic central' },
  'doble-clic': { accion: '1D', texto: 'doble clic' },
  'scroll-arriba': { accion: 'SU', texto: 'scroll hacia arriba' },
  'scroll-abajo': { accion: 'SD', texto: 'scroll hacia abajo' },
};

/** @param {Requisito[]} requisitos */
export function pideCursor(requisitos) {
  return requisitos.some((r) => r.tipo === 'cursor');
}

/** Requisitos que necesitan que el usuario elija un botón (todos menos el cursor). */
/** @param {Requisito[]} requisitos */
export function requisitosConBoton(requisitos) {
  return requisitos.filter((r) => r.tipo !== 'cursor');
}

/**
 * Frase corta de lo que hace el botón (para preguntar y para el resumen).
 * @param {Requisito} r
 * @param {Arrastre} [arrastre]
 * @returns {string}
 */
export function describir(r, arrastre) {
  if (r.tipo === 'tecla') {
    const mods = (r.mods || []).map((m) => ({ ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', gui: 'Win/⌘' })[m]);
    return `tecla ${[...mods, teclaLegible(r.tecla || '')].join(' + ')}`;
  }
  if (r.tipo === 'mouse') return /** @type {any} */ (MOUSE)[r.mouse || '']?.texto ?? 'acción de mouse';
  if (r.tipo === 'arrastrar') {
    return arrastre === 'mantener'
      ? 'clic izquierdo mientras lo mantenés presionado'
      : 'clic izquierdo mantenido: un toque agarra y otro suelta';
  }
  return 'mover el cursor con las flechas';
}

/**
 * ¿Se puede usar `largo` como pulsación larga del mismo botón que `corto`?
 * En el protocolo, la acción corta y la larga comparten el tipo (las dos teclas
 * o las dos de mouse), y el doble clic no existe como acción larga. Arrastrar y
 * cursor nunca se combinan: arrastrar ya ocupa el botón mantenido y el cursor
 * no usa botón.
 * @param {Requisito} corto
 * @param {Requisito} largo
 * @returns {boolean}
 */
export function puedeCombinar(corto, largo) {
  if (!corto || !largo) return false;
  if (corto.tipo !== largo.tipo) return false;
  if (corto.tipo === 'tecla') return true;
  if (corto.tipo === 'mouse') return largo.mouse !== 'doble-clic';
  return false;
}

/**
 * Asignaciones a las que `entrada` podría sumarse como pulsación larga: las que
 * todavía no tienen larga y son compatibles (ver `puedeCombinar`).
 * @template {{ requisito: Requisito, largo?: Requisito|null }} A
 * @param {A[]} asignaciones
 * @param {Requisito} entrada
 * @returns {A[]}
 */
export function candidatasParaLarga(asignaciones, entrada) {
  return asignaciones.filter((a) => !a.largo && puedeCombinar(a.requisito, entrada));
}

/**
 * Cuántos eventos entran en `botones` botones: uno por botón y, si el
 * dispositivo soporta Tap-Hold y el recurso lo permite, dos.
 * @param {number} botones
 * @param {boolean} conLarga
 */
export function capacidadEventos(botones, conLarga) {
  return conLarga ? botones * 2 : botones;
}

/**
 * Umbral válido para mostrar/enviar: vacío o inválido = el default del firmware.
 * @param {unknown} v
 * @returns {number}
 */
export function umbralEfectivo(v) {
  return normalizeThreshold(/** @type {any} */ (v)) || TH_DEFAULT_MS;
}

/**
 * Frase del botón combinado para el resumen.
 * @param {Requisito} corto
 * @param {Requisito} largo
 * @param {number} [umbral]
 */
export function describirCombinado(corto, largo, umbral) {
  return `toque: ${corto.etiqueta} (${describir(corto)}) · pulsación larga de ${umbralEfectivo(umbral)} ms: ${largo.etiqueta} (${describir(largo)})`;
}

/**
 * Acción larga (`LongSpec` del núcleo) a partir de un requisito.
 * @param {Requisito} r
 * @returns {import('../dispositivo/protocolo.js').LongSpec}
 */
function especificacionLarga(r) {
  if (r.tipo === 'tecla') {
    const mods = r.mods || [];
    return {
      key: tokenParaNucleo(r.tecla || ''),
      ctrl: mods.includes('ctrl'),
      shift: mods.includes('shift'),
      alt: mods.includes('alt'),
      gui: mods.includes('gui'),
    };
  }
  const m = /** @type {any} */ (MOUSE)[r.mouse || ''];
  return { mouseAction: m ? m.accion : '1' };
}

/**
 * Datos de la línea `CFG:` de un requisito, sin el código de botón.
 * Con `largo` (y un `corto` de su mismo tipo) arma un botón Tap-Hold.
 * @param {Requisito} r
 * @param {Arrastre} [arrastre]
 * @param {Requisito|null} [largo]
 * @param {number} [umbral]
 * @returns {Omit<import('../dispositivo/protocolo.js').ButtonSpec, 'code'>}
 */
function especificacion(r, arrastre, largo = null, umbral = 0) {
  /** @type {Omit<import('../dispositivo/protocolo.js').ButtonSpec, 'code'>} */
  let base;
  if (r.tipo === 'tecla') {
    const mods = r.mods || [];
    base = {
      tipo: 'K',
      modo: 'P',
      key: tokenParaNucleo(r.tecla || ''),
      ctrl: mods.includes('ctrl'),
      shift: mods.includes('shift'),
      alt: mods.includes('alt'),
      gui: mods.includes('gui'),
    };
  } else if (r.tipo === 'mouse') {
    const m = /** @type {any} */ (MOUSE)[r.mouse || ''];
    base = { tipo: 'M', modo: 'P', mouseAction: m ? m.accion : '1' };
  } else {
    // arrastrar: clic izquierdo; con "toque" queda mantenido hasta el siguiente toque.
    base = { tipo: 'M', modo: 'P', mouseAction: arrastre === 'mantener' ? '1' : '1M' };
  }
  if (largo && puedeCombinar(r, largo)) {
    return { ...base, modo: 'T', largo: especificacionLarga(largo), umbral: umbralEfectivo(umbral) };
  }
  return base;
}

/**
 * Valor inicial de los controles del cursor: lo que ya tiene el dispositivo
 * (para no pisar su velocidad sin motivo) o, si no hay dato, el default.
 * @param {{ vel?: number|null, acel?: number|null } | null | undefined} cfg
 * @returns {{ vel: number, acel: boolean }}
 */
export function cursorInicial(cfg) {
  const v = cfg && typeof cfg.vel === 'number' ? cfg.vel : NaN;
  const vel = Number.isFinite(v) && v >= VEL_MIN && v <= VEL_MAX ? Math.round(v) : VEL_DEFECTO;
  return { vel, acel: !!(cfg && cfg.acel === 1) };
}

/**
 * Arma la lista de comandos. Solo toca los botones asignados y, si se pidió,
 * el modo de las flechas (cursor) con su velocidad y aceleración.
 * @param {{
 *   asignaciones: { requisito: Requisito, codigo: string, largo?: Requisito|null, umbral?: number }[],
 *   cursor?: { vel: number, acel: boolean } | null,
 *   arrastre?: Arrastre,
 *   modoIndividual?: boolean,
 * }} p
 * @returns {string[]}
 */
export function armarComandos({ asignaciones, cursor = null, arrastre, modoIndividual = false }) {
  const comandos = asignaciones.map((a) =>
    buildButtonCfg({
      code: a.codigo,
      ...especificacion(a.requisito, arrastre, a.largo, a.umbral),
    }),
  );
  if (cursor) {
    const vel = Math.min(VEL_MAX, Math.max(VEL_MIN, Math.round(cursor.vel)));
    comandos.push('FMODE:1', `VEL:${vel}`, `ACEL:${cursor.acel ? 1 : 0}`);
  } else if (modoIndividual) {
    comandos.push('FMODE:0');
  }
  return comandos;
}
