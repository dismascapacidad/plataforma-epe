/**
 * arasaac.js
 * Búsqueda de pictogramas de ARASAAC para "Vincular imagen-botón".
 *
 * Módulo ES (sin DOM): arma las URLs, interpreta las respuestas y descarga la
 * imagen elegida. La interfaz vive en vincular-imagen.js, que lo carga con
 * import() dinámico.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ AUTORIZADO por ARASAAC (respuesta por correo, 06/10/2026).           │
 * │ Su licencia CC BY-NC-SA no permite fines comerciales ni editoriales  │
 * │ y no hay licencia comercial. Nos autorizaron a usar la API SIEMPRE   │
 * │ QUE la plataforma y esta actividad sean abiertas y gratuitas para    │
 * │ cualquier persona, haya o no comprado productos de dis+capacidad.    │
 * │ Si eso cambia (cuenta obligatoria de pago, acceso solo para clientes │
 * │ o cualquier otro cobro), poner ARASAAC_HABILITADO en false y quitar  │
 * │ la sección #arasaac de acerca/index.html.                            │
 * │ Condición de uso: mostrar ATRIBUCION_CORTA en la página de           │
 * │ configuración de la actividad y en la búsqueda de pictogramas.       │
 * │ ARASAAC nos anotó como usuarios de su API y puede avisarnos de       │
 * │ cambios y controlar que el uso respete la licencia.                  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Decisiones de seguridad:
 * - Solo se usa el id numérico que devuelve la API; todo lo demás se valida
 *   antes de armar una URL.
 * - El término de búsqueda se acota (40 caracteres) y se codifica en la URL.
 * - La imagen elegida se descarga y se guarda en el navegador (data URL):
 *   así el juego no depende de ARASAAC ni le avisa a nadie al jugar. Se
 *   aceptan solo PNG/JPEG/WebP de hasta 1,5 MB (nunca SVG).
 * - Nada de esto se envía ni se guarda en nuestros servidores.
 */

export const ARASAAC_HABILITADO = true;

export const ARASAAC_API = 'https://api.arasaac.org/v1/pictograms';
export const ARASAAC_IMAGENES = 'https://static.arasaac.org/pictograms';
export const ARASAAC_IDIOMA = 'es';

export const LARGO_MAX_BUSQUEDA = 40;
export const RESULTADOS_POR_PAGINA = 12;
export const MAX_BYTES_IMAGEN = 1.5 * 1024 * 1024;

const TIPOS_IMAGEN_OK = ['image/png', 'image/jpeg', 'image/webp'];
const RESOLUCIONES_OK = [300, 500];

// Texto de atribución que piden los términos de ARASAAC.
export const ATRIBUCION_COMPLETA =
  'Los símbolos pictográficos utilizados son propiedad del Gobierno de Aragón y han sido creados ' +
  'por Sergio Palao para ARASAAC (https://arasaac.org), que los distribuye bajo licencia ' +
  'Creative Commons BY-NC-SA.';

// Texto EXACTO que pidió ARASAAC para la configuración de la actividad y la búsqueda.
export const ATRIBUCION_CORTA =
  'Autor pictogramas: Sergio Palao. Origen: ARASAAC (http://www.arasaac.org). ' +
  'Licencia: CC (BY-NC-SA). Propiedad: Gobierno de Aragón (España)';

/** Recorta espacios, junta los repetidos y acota el largo. '' si no queda nada. */
export function normalizarTermino(texto) {
  if (typeof texto !== 'string') return '';
  return texto.replace(/\s+/g, ' ').trim().slice(0, LARGO_MAX_BUSQUEDA).trim();
}

export function idValido(id) {
  return Number.isInteger(id) && id > 0 && id < 100000000;
}

/** URL de búsqueda, o null si el término queda vacío. */
export function urlBusqueda(termino, idioma = ARASAAC_IDIOMA) {
  const t = normalizarTermino(termino);
  if (!t) return null;
  const lang = /^[a-z]{2,3}$/.test(idioma) ? idioma : ARASAAC_IDIOMA;
  return `${ARASAAC_API}/${lang}/bestsearch/${encodeURIComponent(t)}`;
}

/** URL de la imagen de un pictograma, o null si el id o la resolución no son válidos. */
export function urlImagen(id, resolucion = 300) {
  if (!idValido(id) || !RESOLUCIONES_OK.includes(resolucion)) return null;
  return `${ARASAAC_IMAGENES}/${id}/${id}_${resolucion}.png`;
}

/**
 * Convierte la respuesta de la API en [{ id, palabra, url }].
 * Descarta lo que no tenga un id válido y quita repetidos.
 */
export function parsearResultados(json) {
  if (!Array.isArray(json)) return [];
  const vistos = new Set();
  const lista = [];
  for (const item of json) {
    if (!item || typeof item !== 'object') continue;
    const id = item._id;
    if (!idValido(id) || vistos.has(id)) continue;
    const url = urlImagen(id);
    if (!url) continue;
    vistos.add(id);
    lista.push({ id, palabra: primeraPalabra(item.keywords), url });
  }
  return lista;
}

function primeraPalabra(keywords) {
  if (!Array.isArray(keywords)) return '';
  for (const k of keywords) {
    if (k && typeof k.keyword === 'string' && k.keyword.trim()) {
      return k.keyword.trim().slice(0, 80);
    }
  }
  return '';
}

/**
 * @typedef {object} OpcionesRed
 * @property {(url: string, init?: object) => Promise<any>} [fetchFn] fetch alternativo (para tests)
 * @property {string} [idioma]
 * @property {number} [resolucion]
 * @property {AbortSignal} [signal]
 */

/**
 * Busca pictogramas. Devuelve [] si no hay resultados; lanza Error si falla la red o la API.
 * @param {string} termino
 * @param {OpcionesRed} [opciones]
 */
export async function buscar(termino, { fetchFn = fetch, idioma, signal } = {}) {
  const url = urlBusqueda(termino, idioma);
  if (!url) return [];
  const resp = await fetchFn(url, { signal });
  if (resp.status === 404) return []; // la API responde 404 cuando no hay coincidencias
  if (!resp.ok) throw new Error(`arasaac_http_${resp.status}`);
  return parsearResultados(await resp.json());
}

/** Blob → data URL (base64), sin FileReader para poder probarlo fuera del navegador. */
export async function blobADataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(binario)}`;
}

/**
 * Descarga la imagen del pictograma y la devuelve como data URL.
 * Lanza Error si el id no es válido, si falla la descarga, si el tipo no es
 * PNG/JPEG/WebP o si pesa más de MAX_BYTES_IMAGEN.
 * @param {number} id
 * @param {OpcionesRed} [opciones]
 */
export async function descargarImagen(id, { fetchFn = fetch, resolucion = 300, signal } = {}) {
  const url = urlImagen(id, resolucion);
  if (!url) throw new Error('arasaac_id_invalido');
  const resp = await fetchFn(url, { signal });
  if (!resp.ok) throw new Error(`arasaac_http_${resp.status}`);
  const blob = await resp.blob();
  if (!TIPOS_IMAGEN_OK.includes(blob.type)) throw new Error('arasaac_tipo_no_permitido');
  if (blob.size > MAX_BYTES_IMAGEN) throw new Error('arasaac_imagen_muy_grande');
  return blobADataUrl(blob);
}
