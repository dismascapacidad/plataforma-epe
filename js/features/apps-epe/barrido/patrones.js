/**
 * patrones.js
 * Cómo se agrupan las celdas del tablero según el patrón de barrido.
 *
 * Todo patrón se representa igual: un ÁRBOL de grupos. Cada nivel del árbol
 * es una lista de opciones que el barrido recorre; elegir un grupo "entra" en
 * él (y se recorren sus hijos), y elegir una celda suelta es la selección
 * final. Así el motor (motor.js) no sabe nada de filas, columnas ni mitades:
 *
 *   - celda:      1 nivel   -> cada celda es una opción.
 *   - horizontal: 2 niveles -> primero filas, después las celdas de la fila.
 *   - vertical:   2 niveles -> primero columnas, después las celdas de la columna.
 *   - binario:    n niveles -> mitades sucesivas hasta quedar una sola celda.
 *
 * Módulo puro: no toca el DOM.
 */

/** Patrones disponibles, en el orden en que se muestran. */
export const PATRONES = ['celda', 'horizontal', 'vertical', 'binario'];

export const NOMBRES_PATRON = {
  celda: 'Celda a celda',
  horizontal: 'Horizontal (filas, luego columnas)',
  vertical: 'Vertical (columnas, luego filas)',
  binario: 'Binario (mitades)',
};

/**
 * @typedef {{id:string, fila:number, col:number}} CeldaPos
 *   `col` es la columna donde EMPIEZA la celda (una celda ancha, como ESPACIO
 *   en QWERTY, cuenta en la columna de inicio).
 */

/**
 * @typedef {{celdas:string[], hijos:Nodo[]|null}} Nodo
 *   `celdas`: ids de todas las celdas del grupo, en orden de lectura.
 *   `hijos`: sus opciones; `null` si el nodo es una celda suelta.
 */

/** @returns {Nodo} */
function hoja(celda) {
  return { celdas: [celda.id], hijos: null };
}

/**
 * Un grupo de una sola celda no necesita un nivel propio: sería elegir dos
 * veces lo mismo. Se devuelve la celda suelta.
 * @param {CeldaPos[]} celdas
 * @returns {Nodo}
 */
function grupo(celdas) {
  if (celdas.length === 1) return hoja(celdas[0]);
  return { celdas: celdas.map((c) => c.id), hijos: celdas.map(hoja) };
}

/** Orden de lectura: de arriba abajo, y de izquierda a derecha. */
function enOrdenDeLectura(celdas) {
  return [...celdas].sort((a, b) => a.fila - b.fila || a.col - b.col);
}

/**
 * Agrupa por una clave numérica, conservando el orden creciente de la clave.
 * @param {CeldaPos[]} celdas
 * @param {(c:CeldaPos)=>number} clave
 * @param {(a:CeldaPos, b:CeldaPos)=>number} orden orden dentro de cada grupo
 */
function agruparPor(celdas, clave, orden) {
  /** @type {Map<number, CeldaPos[]>} */
  const mapa = new Map();
  for (const c of celdas) {
    const k = clave(c);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(c);
  }
  return [...mapa.keys()].sort((a, b) => a - b).map((k) => mapa.get(k).sort(orden));
}

/** Parte la lista en mitades (la primera se queda con la celda de más si es impar). */
function dividir(celdas) {
  if (celdas.length === 1) return hoja(celdas[0]);
  const medio = Math.ceil(celdas.length / 2);
  return {
    celdas: celdas.map((c) => c.id),
    hijos: [dividir(celdas.slice(0, medio)), dividir(celdas.slice(medio))],
  };
}

/**
 * Arma el árbol de grupos de un patrón.
 * @param {string} patron uno de PATRONES
 * @param {CeldaPos[]} celdas
 * @returns {Nodo} la raíz: sus `hijos` son las opciones del primer nivel.
 */
export function construirArbol(patron, celdas) {
  if (!Array.isArray(celdas) || celdas.length === 0) {
    throw new Error('construirArbol: no hay celdas');
  }
  const ordenadas = enOrdenDeLectura(celdas);
  const raiz = { celdas: ordenadas.map((c) => c.id) };

  if (patron === 'celda') {
    return { ...raiz, hijos: ordenadas.map(hoja) };
  }
  if (patron === 'horizontal') {
    const filas = agruparPor(
      ordenadas,
      (c) => c.fila,
      (a, b) => a.col - b.col,
    );
    return { ...raiz, hijos: filas.map(grupo) };
  }
  if (patron === 'vertical') {
    const columnas = agruparPor(
      ordenadas,
      (c) => c.col,
      (a, b) => a.fila - b.fila,
    );
    // Las celdas de una columna se recorren de arriba abajo, pero la lista de
    // ids del grupo también queda en ese orden (no en el de lectura general).
    return { ...raiz, hijos: columnas.map(grupo) };
  }
  if (patron === 'binario') {
    // Con una sola celda no hay nada que dividir: la raíz tiene esa única opción.
    if (ordenadas.length === 1) return { ...raiz, hijos: [hoja(ordenadas[0])] };
    return dividir(ordenadas);
  }
  throw new Error(`construirArbol: patrón desconocido "${patron}"`);
}

/**
 * Cantidad máxima de selecciones que hacen falta para llegar a una celda.
 * Sirve para mostrarle al profesional el costo de cada patrón.
 * @param {Nodo} nodo
 * @returns {number}
 */
export function profundidad(nodo) {
  if (!nodo.hijos) return 0;
  return 1 + Math.max(...nodo.hijos.map(profundidad));
}
