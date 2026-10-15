/**
 * listas.js
 * Las dos listas de "Ver videos con pulsadores": interpretar el enlace que pega
 * la persona, validar lo que se guarda y leer/escribir en el navegador.
 *
 * Módulo ES sin DOM (se prueba con Vitest). La interfaz vive en ver-videos.js,
 * que lo carga con import() dinámico, igual que vincular-imagen.js con arasaac.js.
 *
 * Decisiones de seguridad:
 * - Del enlace solo se conserva un ID de YouTube que pasa una expresión regular
 *   estricta (video: 11 caracteres; lista: 10 a 64). Nada más del texto pegado
 *   llega al reproductor ni a ninguna URL, así que no hay forma de colar
 *   parámetros ni sitios que no sean YouTube.
 * - Se aceptan solo los dominios de YouTube de la lista blanca de abajo.
 * - Se guarda en localStorage solo: tipo, ID y un nombre corto. Sin cuenta, sin
 *   servidor. Lo que está guardado se vuelve a validar al leerlo.
 * - El nombre es texto libre: la interfaz lo muestra siempre con textContent.
 */

export const CLAVE_STORAGE = 'epe-ver-videos-listas';
export const CANTIDAD_LISTAS = 2;
export const LARGO_MAX_NOMBRE = 40;
export const LARGO_MAX_BUSQUEDA = 80;

const HOSTS_LARGOS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const HOSTS_CORTOS = new Set(['youtu.be', 'www.youtu.be']);

const RE_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const RE_LISTA = /^[A-Za-z0-9_-]{10,64}$/;

// Listas que no se pueden embeber: los "Mix" que arma YouTube solos (RD…) y las
// listas propias de la cuenta (Ver más tarde, Me gusta).
const LISTAS_DE_CUENTA = new Set(['WL', 'LL', 'LM']);

export const MOTIVOS = {
  vacio: 'Pegá un enlace de YouTube.',
  'no-youtube': 'Ese enlace no es de YouTube. Copiá el enlace desde youtube.com o youtu.be.',
  'sin-id': 'No encontramos un video ni una lista en ese enlace.',
  'no-compatible':
    'Esa lista no se puede usar (es un Mix o una lista de la cuenta). Probá con una lista pública o no listada.',
};

function noCompatible(idLista) {
  return LISTAS_DE_CUENTA.has(idLista) || idLista.startsWith('RD');
}

/**
 * Interpreta lo que la persona pegó.
 * Si ok es true vienen `tipo` e `id`; si no, `motivo` (clave de MOTIVOS).
 * @param {unknown} texto
 * @returns {{ok: boolean, tipo?: 'lista'|'video', id?: string, motivo?: keyof typeof MOTIVOS}}
 */
export function analizarEnlace(texto) {
  if (typeof texto !== 'string') return { ok: false, motivo: 'vacio' };
  const limpio = texto.trim();
  if (!limpio) return { ok: false, motivo: 'vacio' };
  if (limpio.length > 300) return { ok: false, motivo: 'sin-id' };

  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(limpio) ? limpio : 'https://' + limpio);
  } catch {
    return { ok: false, motivo: 'no-youtube' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, motivo: 'no-youtube' };
  }

  const host = url.hostname.toLowerCase();
  const esLargo = HOSTS_LARGOS.has(host);
  const esCorto = HOSTS_CORTOS.has(host);
  if (!esLargo && !esCorto) return { ok: false, motivo: 'no-youtube' };

  // Lista: el parámetro list= (también en watch?v=…&list=…, /playlist?list=…).
  const lista = url.searchParams.get('list');
  let mix = false;
  if (lista !== null) {
    if (noCompatible(lista)) mix = true;
    else if (RE_LISTA.test(lista)) return { ok: true, tipo: 'lista', id: lista };
  }

  // Video suelto.
  const partes = url.pathname.split('/').filter(Boolean);
  let candidato = null;
  if (esCorto) candidato = partes[0];
  else if (partes[0] === 'watch') candidato = url.searchParams.get('v');
  else if (['embed', 'shorts', 'live', 'v'].includes(partes[0])) candidato = partes[1];
  if (candidato && RE_VIDEO.test(candidato)) return { ok: true, tipo: 'video', id: candidato };

  return { ok: false, motivo: mix ? 'no-compatible' : 'sin-id' };
}

/** Recorta espacios, junta los repetidos y acota el largo. '' si no queda nada. */
function compactar(texto, largoMax) {
  if (typeof texto !== 'string') return '';
  return texto.replace(/\s+/g, ' ').trim().slice(0, largoMax).trim();
}

export function normalizarNombre(texto) {
  return compactar(texto, LARGO_MAX_NOMBRE);
}

export function nombrePorDefecto(tipo) {
  return tipo === 'video' ? 'Video' : 'Lista de YouTube';
}

/** URL de búsqueda de YouTube para abrir en otra pestaña; null si no hay término. */
export function urlBusqueda(termino) {
  const t = compactar(termino, LARGO_MAX_BUSQUEDA);
  return t ? 'https://www.youtube.com/results?search_query=' + encodeURIComponent(t) : null;
}

/**
 * Deja un ítem guardado en su forma segura, o null si no sirve.
 * @returns {{tipo: 'lista'|'video', id: string, nombre: string} | null}
 */
export function normalizarItem(item) {
  if (!item || typeof item !== 'object') return null;
  const { tipo, id } = item;
  const idValido =
    tipo === 'video' ? RE_VIDEO.test(id) : tipo === 'lista' ? RE_LISTA.test(id) : false;
  if (!idValido || (tipo === 'lista' && noCompatible(id))) return null;
  return { tipo, id, nombre: normalizarNombre(item.nombre) || nombrePorDefecto(tipo) };
}

/**
 * Lo mínimo que se le pide a un almacenamiento (localStorage lo cumple).
 * @typedef {{ getItem(clave: string): string | null, setItem(clave: string, valor: string): void, removeItem(clave: string): void }} Almacen
 */

/** @returns {Almacen | null} */
function almacenamiento() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Las listas guardadas: siempre un arreglo de CANTIDAD_LISTAS ítems (o null).
 * @param {Almacen | null} [storage]
 */
export function cargarListas(storage = almacenamiento()) {
  const vacias = Array.from({ length: CANTIDAD_LISTAS }, () => null);
  if (!storage) return vacias;
  try {
    const dato = JSON.parse(storage.getItem(CLAVE_STORAGE));
    if (!dato || dato.v !== 1 || !Array.isArray(dato.listas)) return vacias;
    return vacias.map((_, i) => normalizarItem(dato.listas[i]));
  } catch {
    return vacias;
  }
}

/**
 * Guarda las listas. Devuelve false si no hay dónde guardar.
 * @param {Array<object | null>} listas
 * @param {Almacen | null} [storage]
 */
export function guardarListas(listas, storage = almacenamiento()) {
  if (!storage) return false;
  try {
    const limpias = Array.from({ length: CANTIDAD_LISTAS }, (_, i) => normalizarItem(listas[i]));
    storage.setItem(CLAVE_STORAGE, JSON.stringify({ v: 1, listas: limpias }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Borra todo lo guardado.
 * @param {Almacen | null} [storage]
 */
export function borrarListas(storage = almacenamiento()) {
  if (!storage) return false;
  try {
    storage.removeItem(CLAVE_STORAGE);
    return true;
  } catch {
    return false;
  }
}
