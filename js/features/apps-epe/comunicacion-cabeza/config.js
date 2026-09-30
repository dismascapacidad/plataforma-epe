/**
 * config.js
 * Configuración de la sesión y su persistencia. localStorage siempre con
 * try/catch (mismo criterio que theme.js): sin storage, la app anda igual.
 */

const CLAVE = 'epe-comunicacion-cabeza';

/**
 * @typedef {{seleccion:string, dwellMs:number, celdaMin:number, vozNombre:string|null,
 *   velocidad:number, ocultarVista:boolean, teclaRecentrar:string|null, layout:string,
 *   descanso:boolean, descansoTam:string}} Config
 */

/** @type {Config} */
export const CONFIG_INICIAL = {
  seleccion: 'pulsador', // 'pulsador' | 'dwell'
  dwellMs: 1200,
  celdaMin: 120,
  vozNombre: null,
  velocidad: 1,
  ocultarVista: true,
  // Tecla que devuelve el puntero al centro de la pantalla (null = sin asignar).
  teclaRecentrar: 'c',
  layout: 'abc', // 'abc' | 'qwerty'
  // Zona central sin selección para descansar (solo en modo dwell).
  descanso: true,
  descansoTam: 'mediana', // 'chica' | 'mediana'
};

/**
 * Teclas que ya tienen otro uso en la app y no se pueden asignar al
 * recentrado: las del pulsador (K y Espacio), Esc (reabre la configuración),
 * F9/F1 (atajos de Tracky) y las que solas no cuentan como tecla.
 */
const RESERVADAS = new Set([
  'k',
  ' ',
  'escape',
  'f9',
  'f1',
  'shift',
  'control',
  'alt',
  'altgraph',
  'meta',
  'capslock',
  'os',
  'dead',
  'unidentified',
]);

/** Normaliza como EpeTeclas: `KeyboardEvent.key` en minúscula. */
export function normalizarTecla(tecla) {
  return String(tecla ?? '').toLowerCase();
}

/** @returns {{ok:boolean, tecla?:string, motivo?:string}} */
export function validarTeclaRecentrar(tecla) {
  const t = normalizarTecla(tecla);
  if (!t) return { ok: false, motivo: 'No se detectó ninguna tecla.' };
  if (t === 'k' || t === ' ') {
    return { ok: false, motivo: 'K y Espacio son del pulsador: elegí otra tecla.' };
  }
  if (RESERVADAS.has(t)) return { ok: false, motivo: 'Esa tecla ya tiene otro uso: elegí otra.' };
  return { ok: true, tecla: t };
}

/** Nombre legible de una tecla para mostrar ("c" -> "C", "arrowleft" -> "←"). */
export function etiquetaTecla(tecla) {
  if (!tecla) return 'sin asignar';
  const nombres = {
    ' ': 'Espacio',
    enter: 'Enter',
    tab: 'Tab',
    backspace: 'Retroceso',
    delete: 'Supr',
  };
  const flechas = { arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓' };
  if (nombres[tecla]) return nombres[tecla];
  if (flechas[tecla]) return flechas[tecla];
  if (tecla.length === 1) return tecla.toUpperCase();
  return tecla.charAt(0).toUpperCase() + tecla.slice(1);
}

/** @returns {Config} */
function valida(c) {
  const salida = { ...CONFIG_INICIAL };
  if (!c || typeof c !== 'object') return salida;
  if (c.seleccion === 'pulsador' || c.seleccion === 'dwell') salida.seleccion = c.seleccion;
  if (Number.isFinite(c.dwellMs) && c.dwellMs >= 300 && c.dwellMs <= 5000)
    salida.dwellMs = c.dwellMs;
  if (Number.isFinite(c.celdaMin) && c.celdaMin >= 60 && c.celdaMin <= 300)
    salida.celdaMin = c.celdaMin;
  if (typeof c.vozNombre === 'string') salida.vozNombre = c.vozNombre;
  if (Number.isFinite(c.velocidad) && c.velocidad >= 0.5 && c.velocidad <= 1.6)
    salida.velocidad = c.velocidad;
  if (typeof c.ocultarVista === 'boolean') salida.ocultarVista = c.ocultarVista;
  if (c.layout === 'abc' || c.layout === 'qwerty') salida.layout = c.layout;
  if (typeof c.descanso === 'boolean') salida.descanso = c.descanso;
  if (c.descansoTam === 'chica' || c.descansoTam === 'mediana') salida.descansoTam = c.descansoTam;
  // null = el profesional la quitó a propósito; un valor inválido vuelve a la de fábrica.
  if (c.teclaRecentrar === null) salida.teclaRecentrar = null;
  else if (typeof c.teclaRecentrar === 'string' && validarTeclaRecentrar(c.teclaRecentrar).ok) {
    salida.teclaRecentrar = normalizarTecla(c.teclaRecentrar);
  }
  return salida;
}

export function cargarConfig(storage = globalThis.localStorage) {
  try {
    const crudo = storage?.getItem(CLAVE);
    return valida(crudo ? JSON.parse(crudo) : null);
  } catch {
    return { ...CONFIG_INICIAL };
  }
}

export function guardarConfig(config, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CLAVE, JSON.stringify(config));
  } catch {
    /* sin storage: sigue funcionando sin recordar */
  }
}
