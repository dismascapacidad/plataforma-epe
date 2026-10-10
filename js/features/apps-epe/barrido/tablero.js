/**
 * tablero.js
 * Puente entre el tablero de Comunicación (grilla.js) y el barrido: dice en qué
 * fila y columna cae cada celda, que es lo que necesitan los patrones
 * horizontal y vertical (ver patrones.js).
 *
 * Módulo puro: no toca el DOM.
 */

/**
 * Coloca las celdas en orden de lectura sobre `cols` columnas, respetando las
 * celdas anchas (`spans`: id -> cantidad de columnas que ocupa). Es la misma
 * regla con la que el navegador reparte las celdas del tablero en la grilla CSS,
 * así que la posición calculada acá coincide con la que se ve en pantalla.
 * @param {{id:string}[]} celdas
 * @param {number} cols
 * @param {Record<string, number>} [spans]
 * @returns {import('./patrones.js').CeldaPos[]} `col` es la columna donde EMPIEZA cada celda.
 */
export function posicionarCeldas(celdas, cols, spans = {}) {
  let col = 1;
  let fila = 1;
  return celdas.map((c) => {
    const n = Math.min(spans[c.id] ?? 1, cols);
    if (col + n - 1 > cols) {
      col = 1;
      fila += 1;
    }
    const pos = { id: c.id, fila, col };
    col += n;
    return pos;
  });
}
