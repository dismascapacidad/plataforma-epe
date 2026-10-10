// @ts-check
/**
 * Validación de lo que viene de la base para un recurso externo compatible:
 * la lista de teclas que necesita (`catalogo_actividades.teclas`) y su URL.
 *
 * Funciones puras, sin DOM. Los datos del catálogo los carga a mano
 * dis+capacidad, pero igual se validan antes de usarlos: la lista de teclas
 * termina armando comandos que se guardan en la memoria del dispositivo, y la
 * URL termina en `window.open`. Ante cualquier duda, se rechaza todo (null).
 */

/**
 * Un requisito de un recurso: qué necesita del dispositivo para poder usarlo.
 * Cuatro clases, siempre la más simple que sirva (la plataforma no pide
 * configuraciones de más; la personalización fina se hace en el configurador):
 *  - `tecla`: un botón que emite una tecla (con modificadores opcionales).
 *  - `mouse`: un botón que hace una acción de mouse (clic, doble clic, scroll…).
 *  - `cursor`: las flechas del dispositivo mueven el cursor. No usa ningún botón.
 *  - `arrastrar`: arrastrar y soltar; se resuelve con UN botón de clic izquierdo
 *    mantenido (el usuario elige cómo en el asistente).
 *
 * @typedef {Object} Requisito
 * @property {string} id
 * @property {string} etiqueta
 * @property {'tecla'|'mouse'|'cursor'|'arrastrar'} tipo
 * @property {string} [tecla]    Solo `tecla`. Formato `KeyboardEvent.key` en minúscula.
 * @property {string[]} [mods]   Solo `tecla`: subconjunto de ctrl, shift, alt, gui.
 * @property {string} [mouse]    Solo `mouse`: ver ACCIONES_MOUSE.
 * @property {true} [combinable] Solo `tecla` y `mouse`: el recurso tolera que esta acción
 *   comparta botón con otra (toque corto + pulsación larga, Tap-Hold). Ver README del widget.
 */

/** Teclas con nombre que el widget sabe traducir (ver TOKEN_ESPECIAL + las que coinciden tal cual). */
const TECLAS_CON_NOMBRE = new Set([
  ' ',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'enter',
  'escape',
  'tab',
  'backspace',
  'delete',
]);

/** Acciones de mouse que se pueden pedir (lista cerrada; ver comandos.js). */
export const ACCIONES_MOUSE = ['clic', 'clic-derecho', 'clic-central', 'doble-clic', 'scroll-arriba', 'scroll-abajo'];

/** Modificadores aceptados, en el orden en que se normalizan. */
const MODIFICADORES = ['ctrl', 'shift', 'alt', 'gui'];

/** Un dispositivo tiene como mucho 8 entradas (BR BA BN BC FU FD FL FR). */
export const MAX_TECLAS = 8;

const RE_ID = /^[a-z0-9_-]{1,32}$/;
const RE_LETRA_O_DIGITO = /^[a-z0-9]$/;

/**
 * @param {unknown} tecla
 * @returns {tecla is string}
 */
function teclaValida(tecla) {
  return typeof tecla === 'string' && (RE_LETRA_O_DIGITO.test(tecla) || TECLAS_CON_NOMBRE.has(tecla));
}

/**
 * @param {unknown} mods
 * @returns {string[] | null} lista normalizada (sin repetidos, orden fijo) o null si es inválida
 */
function modsValidos(mods) {
  if (mods === undefined) return [];
  if (!Array.isArray(mods) || mods.length > MODIFICADORES.length) return null;
  for (const m of mods) if (typeof m !== 'string' || !MODIFICADORES.includes(m)) return null;
  return MODIFICADORES.filter((m) => mods.includes(m));
}

/**
 * Devuelve la lista normalizada (objetos nuevos, solo los campos conocidos de
 * la clase de cada requisito) o `null` si algo no es válido: no se aceptan
 * listas a medias. Cada ítem tiene exactamente UNA clase (tecla, mouse,
 * cursor o arrastrar); como mucho un `cursor` y un `arrastrar`.
 * @param {unknown} valor
 * @returns {Requisito[] | null}
 */
export function validarTeclas(valor) {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > MAX_TECLAS) return null;
  /** @type {Requisito[]} */
  const salida = [];
  const ids = new Set();
  let cursores = 0;
  let arrastres = 0;
  for (const item of valor) {
    if (!item || typeof item !== 'object') return null;
    const o = /** @type {Record<string, unknown>} */ (item);
    const { id, etiqueta } = o;
    if (typeof id !== 'string' || !RE_ID.test(id) || ids.has(id)) return null;
    if (typeof etiqueta !== 'string') return null;
    const et = etiqueta.trim();
    if (et.length < 1 || et.length > 40) return null;

    const clases = ['tecla', 'mouse', 'cursor', 'arrastrar'].filter((k) => o[k] !== undefined);
    if (clases.length !== 1) return null;
    const clase = clases[0];

    // `combinable`: solo `true` (o ausente) y solo en tecla/mouse. Cualquier otra cosa
    // invalida la lista entera, igual que el resto de los campos.
    if (o.combinable !== undefined && (o.combinable !== true || (clase !== 'tecla' && clase !== 'mouse'))) {
      return null;
    }
    const combinable = o.combinable === true;

    if (clase === 'tecla') {
      if (!teclaValida(o.tecla)) return null;
      const mods = modsValidos(o.mods);
      if (mods === null) return null;
      /** @type {Requisito} */
      const r = { id, etiqueta: et, tipo: 'tecla', tecla: o.tecla };
      if (mods.length) r.mods = mods;
      if (combinable) r.combinable = true;
      salida.push(r);
    } else {
      if (o.mods !== undefined) return null; // los modificadores solo van con una tecla
      if (clase === 'mouse') {
        if (typeof o.mouse !== 'string' || !ACCIONES_MOUSE.includes(o.mouse)) return null;
        /** @type {Requisito} */
        const r = { id, etiqueta: et, tipo: 'mouse', mouse: o.mouse };
        if (combinable) r.combinable = true;
        salida.push(r);
      } else if (clase === 'cursor') {
        if (o.cursor !== true || ++cursores > 1) return null;
        salida.push({ id, etiqueta: et, tipo: 'cursor' });
      } else {
        if (o.arrastrar !== true || ++arrastres > 1) return null;
        salida.push({ id, etiqueta: et, tipo: 'arrastrar' });
      }
    }
    ids.add(id);
  }
  return salida;
}

/**
 * Solo `https:` (nada de `javascript:`, `data:`, `http:`…). Devuelve la URL
 * normalizada o `null`.
 * @param {unknown} url
 * @returns {string | null}
 */
export function urlSegura(url) {
  if (typeof url !== 'string' || url.length > 2000) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname ? u.href : null;
  } catch {
    return null;
  }
}
