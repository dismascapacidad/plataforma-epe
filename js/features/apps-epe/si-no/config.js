/**
 * config.js
 * Configuración de "Si-No con pulsadores" y su persistencia. Pura: el storage
 * se pasa por parámetro y todo localStorage va con try/catch (si no hay o está
 * lleno, la app anda igual sin recordar nada).
 *
 * Qué se guarda en el navegador de quien usa la app (nunca en un servidor):
 * los textos de las casillas, las imágenes (reducidas, como data URL) y las
 * opciones de acceso. El texto es libre: se advierte en el formulario que no
 * debe llevar datos de pacientes.
 */

export const CLAVE_STORAGE = 'epe-si-no';
export const MAX_TEXTO = 120;
/** Una imagen guardada pesa como mucho esto (en caracteres del data URL). */
export const MAX_CHARS_IMAGEN = 600_000;

/** Solo estos tipos entran como imagen guardada (nunca SVG: puede llevar scripts). */
const PREFIJO_IMAGEN = /^data:image\/(png|jpeg|webp);base64,/;

export const DWELL_OPCIONES_MS = [600, 900, 1200, 1800, 2500];

/** Textos de fábrica de las tres casillas. */
export const TEXTOS_INICIALES = ['Sí', 'No', 'No sé'];

/**
 * @typedef {{imagen:string|null, fuente:'arasaac'|'archivo'|null, texto:string}} Celda
 * @typedef {{seleccion:'pulsador'|'dwell', dwellMs:number, descanso:boolean,
 *   teclaRecentrar:string|null, ocultarVista:boolean}} ConfigCabeza
 * @typedef {{tercera:boolean, celdas:Celda[], acceso:'pulsadores'|'cabeza',
 *   leerAlResaltar:boolean, cabeza:ConfigCabeza}} Config
 */

/** @returns {Config} */
export function configInicial() {
  return {
    tercera: false,
    celdas: TEXTOS_INICIALES.map((texto) => ({ imagen: null, fuente: null, texto })),
    acceso: 'pulsadores',
    leerAlResaltar: false,
    cabeza: {
      seleccion: 'pulsador',
      dwellMs: 1200,
      descanso: true,
      teclaRecentrar: 'c',
      ocultarVista: true,
    },
  };
}

/** ¿Es un data URL de imagen que aceptamos? Se usa antes de mostrar o guardar. */
export function esImagenValida(src) {
  return typeof src === 'string' && src.length <= MAX_CHARS_IMAGEN && PREFIJO_IMAGEN.test(src);
}

/** Recorta espacios y largo. Siempre devuelve string. */
export function limpiarTexto(t) {
  return typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXTO) : '';
}

function celdaValida(c, textoPorDefecto) {
  const salida = { imagen: null, fuente: null, texto: textoPorDefecto };
  if (!c || typeof c !== 'object') return salida;
  if (typeof c.texto === 'string') salida.texto = limpiarTexto(c.texto);
  if (esImagenValida(c.imagen)) {
    salida.imagen = c.imagen;
    salida.fuente = c.fuente === 'arasaac' ? 'arasaac' : 'archivo';
  }
  return salida;
}

/** Normaliza lo leído del storage: lo que no sirve vuelve al valor de fábrica. */
export function validarConfig(crudo) {
  const salida = configInicial();
  if (!crudo || typeof crudo !== 'object') return salida;
  if (typeof crudo.tercera === 'boolean') salida.tercera = crudo.tercera;
  if (Array.isArray(crudo.celdas)) {
    salida.celdas = TEXTOS_INICIALES.map((t, i) => celdaValida(crudo.celdas[i], t));
  }
  if (crudo.acceso === 'pulsadores' || crudo.acceso === 'cabeza') salida.acceso = crudo.acceso;
  if (typeof crudo.leerAlResaltar === 'boolean') salida.leerAlResaltar = crudo.leerAlResaltar;
  const cab = crudo.cabeza;
  if (cab && typeof cab === 'object') {
    if (cab.seleccion === 'pulsador' || cab.seleccion === 'dwell') {
      salida.cabeza.seleccion = cab.seleccion;
    }
    if (DWELL_OPCIONES_MS.includes(cab.dwellMs)) salida.cabeza.dwellMs = cab.dwellMs;
    if (typeof cab.descanso === 'boolean') salida.cabeza.descanso = cab.descanso;
    if (typeof cab.ocultarVista === 'boolean') salida.cabeza.ocultarVista = cab.ocultarVista;
    if (cab.teclaRecentrar === null) salida.cabeza.teclaRecentrar = null;
    else if (typeof cab.teclaRecentrar === 'string' && cab.teclaRecentrar.length > 0) {
      salida.cabeza.teclaRecentrar = cab.teclaRecentrar.toLowerCase();
    }
  }
  return salida;
}

/** Cuántas casillas se usan: 2, o 3 si la tercera está activada. */
export function cantidadActiva(config) {
  return config.tercera ? 3 : 2;
}

/** Las casillas en uso, con su índice original (c0, c1, c2). */
export function celdasActivas(config) {
  return config.celdas
    .slice(0, cantidadActiva(config))
    .map((celda, i) => ({ id: `c${i}`, indice: i, ...celda }));
}

/** @returns {Config} */
export function cargarConfig(storage = globalThis.localStorage) {
  try {
    const crudo = storage?.getItem(CLAVE_STORAGE);
    return validarConfig(crudo ? JSON.parse(crudo) : null);
  } catch {
    return configInicial();
  }
}

/** @returns {boolean} false si no se pudo guardar (storage lleno o bloqueado). */
export function guardarConfig(config, storage = globalThis.localStorage) {
  try {
    storage.setItem(CLAVE_STORAGE, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}
