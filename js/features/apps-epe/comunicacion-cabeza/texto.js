/**
 * texto.js
 * Qué le pasa al texto cuando se selecciona una celda. Puro y sin DOM.
 */
import { ACCIONES } from './grilla.js';

const MAX_LARGO = 500;

/**
 * Aplica una celda al texto actual.
 * @returns {{texto:string, hablar:boolean}} `hablar` = hay que reproducir por voz.
 */
export function aplicarCelda(texto, celda) {
  const actual = String(texto || '');
  if (!celda) return { texto: actual, hablar: false };
  if (celda.tipo === 'letra') {
    if (actual.length >= MAX_LARGO) return { texto: actual, hablar: false };
    return { texto: actual + celda.valor, hablar: false };
  }
  switch (celda.valor) {
    case ACCIONES.ESPACIO:
      // Sin espacios iniciales ni dobles: cada selección cuesta.
      if (actual === '' || actual.endsWith(' ') || actual.length >= MAX_LARGO) {
        return { texto: actual, hablar: false };
      }
      return { texto: actual + ' ', hablar: false };
    case ACCIONES.BORRAR:
      return { texto: actual.slice(0, -1), hablar: false };
    case ACCIONES.LIMPIAR:
      return { texto: '', hablar: false };
    case ACCIONES.HABLAR:
      return { texto: actual, hablar: actual.trim() !== '' };
    default:
      return { texto: actual, hablar: false };
  }
}

/** Texto listo para la voz: espacios colapsados y sin bordes. */
export function textoParaHablar(texto) {
  return String(texto || '')
    .replace(/\s+/g, ' ')
    .trim();
}
