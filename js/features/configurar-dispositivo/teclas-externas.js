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
 * Misma forma que usa el widget (`EntradaNecesaria` en widget.js).
 * @typedef {Object} EntradaNecesaria
 * @property {string} id
 * @property {string} etiqueta
 * @property {string} tecla  Formato `KeyboardEvent.key` en minúscula.
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
 * Devuelve la lista normalizada (objetos nuevos, solo los 3 campos conocidos)
 * o `null` si algo no es válido: no se aceptan listas a medias.
 * @param {unknown} valor
 * @returns {EntradaNecesaria[] | null}
 */
export function validarTeclas(valor) {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > MAX_TECLAS) return null;
  /** @type {EntradaNecesaria[]} */
  const salida = [];
  const ids = new Set();
  for (const item of valor) {
    if (!item || typeof item !== 'object') return null;
    const { id, etiqueta, tecla } = /** @type {Record<string, unknown>} */ (item);
    if (typeof id !== 'string' || !RE_ID.test(id) || ids.has(id)) return null;
    if (typeof etiqueta !== 'string') return null;
    const et = etiqueta.trim();
    if (et.length < 1 || et.length > 40) return null;
    if (!teclaValida(tecla)) return null;
    ids.add(id);
    salida.push({ id, etiqueta: et, tecla });
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
