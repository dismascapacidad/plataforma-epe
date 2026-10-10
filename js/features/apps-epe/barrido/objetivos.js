/**
 * objetivos.js
 * Lo que se practica con el barrido. Hay dos objetivos:
 *  - Copiar una palabra: se muestra una palabra y hay que armarla letra por
 *    letra. Al completarla se reproduce y se pasa a la siguiente.
 *  - Comunicación: se escribe libremente y se reproduce con HABLAR.
 *
 * Acá vive la parte de "copiar una palabra" (lista de palabras, comparación
 * letra por letra, pasar a la siguiente). El texto libre usa texto.js de
 * Comunicación. Módulo puro: no toca el DOM.
 */

/**
 * Cada palabra tiene dos formas: `escritura` (lo que hay que armar en el
 * tablero; sin tildes, porque el tablero no tiene Á É Í Ó Ú) y `pronunciacion`
 * (lo que se dice en voz alta; con la tilde real para que suene bien).
 * @typedef {{escritura:string, pronunciacion:string}} Palabra
 */

/** @type {Palabra[]} */
export const PALABRAS_DEFAULT = [
  { escritura: 'SOL', pronunciacion: 'SOL' },
  { escritura: 'OJO', pronunciacion: 'OJO' },
  { escritura: 'MAMA', pronunciacion: 'MAMÁ' },
  { escritura: 'PAPA', pronunciacion: 'PAPÁ' },
  { escritura: 'CASA', pronunciacion: 'CASA' },
];

export const MAX_LARGO_PALABRA = 20;

/**
 * Saca las tildes (MAMÁ -> MAMA) sin tocar la Ñ: es una letra propia del
 * alfabeto y sí existe como celda en el tablero.
 * @param {string} textoMayusculas
 */
export function quitarTildes(textoMayusculas) {
  return textoMayusculas
    .replace(/Ñ/g, '\uE000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\uE000/g, 'Ñ');
}

/**
 * Convierte lo que escribió el profesional en una palabra para practicar, o
 * explica por qué no sirve. Solo se admiten letras que existan en el tablero
 * (A-Z y Ñ) y espacios sueltos entre palabras.
 * @param {string} texto
 * @param {Palabra[]} existentes
 * @returns {{ok:true, palabra:Palabra}|{ok:false, motivo:string}}
 */
export function palabraDesdeTexto(texto, existentes = []) {
  const pronunciacion = String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!pronunciacion) return { ok: false, motivo: 'Escribí una palabra.' };
  if (pronunciacion.length > MAX_LARGO_PALABRA) {
    return { ok: false, motivo: `Máximo ${MAX_LARGO_PALABRA} letras.` };
  }
  const escritura = quitarTildes(pronunciacion);
  if (!/^[A-ZÑ ]+$/.test(escritura)) {
    return {
      ok: false,
      motivo: 'Solo letras (sin números ni signos), porque el tablero no los tiene.',
    };
  }
  if (existentes.some((p) => p.escritura === escritura)) {
    return { ok: false, motivo: 'Esa palabra ya está en la lista.' };
  }
  return { ok: true, palabra: { escritura, pronunciacion } };
}

/**
 * Compara lo escrito con la palabra, letra por letra.
 * @param {string} escrito lo escrito hasta ahora (en el tablero, en minúscula)
 * @param {Palabra} palabra
 * @returns {{letras:{letra:string, estado:'correcta'|'incorrecta'|'pendiente'}[], completa:boolean, errores:number}}
 *   `completa`: lo escrito es exactamente la palabra.
 */
export function evaluarCopia(escrito, palabra) {
  const e = String(escrito ?? '').toUpperCase();
  const objetivo = palabra.escritura;
  const letras = objetivo.split('').map((letra, i) => ({
    letra,
    /** @type {'pendiente'|'correcta'|'incorrecta'} */
    estado: i >= e.length ? 'pendiente' : e[i] === letra ? 'correcta' : 'incorrecta',
  }));
  const errores =
    letras.filter((l) => l.estado === 'incorrecta').length +
    Math.max(0, e.length - objetivo.length);
  return { letras, completa: e === objetivo, errores };
}

/**
 * Recorrido por la lista de palabras: arranca en la primera, pasa a la
 * siguiente al completar una y, después de la última, vuelve a la primera.
 * @param {Palabra[]} [palabras]
 */
export function crearPractica(palabras = PALABRAS_DEFAULT) {
  /** @type {Palabra[]} */
  const lista = palabras.map((p) => ({ ...p }));
  let indice = 0;
  return {
    actual: () => lista[indice],
    lista: () => lista.map((p) => ({ ...p })),
    indice: () => indice,
    /** Pasa a la palabra siguiente (la última da la vuelta a la primera). */
    siguiente() {
      indice = (indice + 1) % lista.length;
      return lista[indice];
    },
    /** Va directo a una palabra de la lista; si no está, no cambia nada. */
    elegir(escritura) {
      const i = lista.findIndex((p) => p.escritura === escritura);
      if (i >= 0) indice = i;
      return lista[indice];
    },
    /** Suma una palabra al final y la deja elegida. */
    agregar(palabra) {
      lista.push({ ...palabra });
      indice = lista.length - 1;
      return lista[indice];
    },
  };
}
