/**
 * motor.js
 * Máquina de estados del barrido. Recorre el árbol de grupos que arma
 * patrones.js y responde a los eventos de entrada:
 *
 *   - avanzar():      pasa a la opción siguiente del nivel actual.
 *   - retroceder():   pasa a la opción anterior del mismo nivel (nunca cambia
 *                     de nivel).
 *   - seleccionar():  si la opción resaltada es un grupo, entra en él; si es
 *                     una celda, la devuelve y el recorrido vuelve al inicio.
 *
 * El motor no sabe si el avance es automático o dirigido: en automático
 * alguien (un temporizador) llama a avanzar(); en dirigido lo llama el evento
 * "Avanzar". Tampoco toca el DOM ni el tiempo, así que se puede probar solo.
 *
 * Salida de un grupo: como "retroceder" no sube de nivel, un grupo mal elegido
 * se abandona dejando que el recorrido lo complete `vueltas` veces; después se
 * vuelve solo al nivel de arriba, parado en el grupo que se acaba de dejar.
 * En el primer nivel no hay a dónde subir: el recorrido simplemente da la vuelta.
 */

/** @typedef {import('./patrones.js').Nodo} Nodo */

/**
 * @typedef {Object} Resultado
 * @property {'mueve'|'nivel'|'sube'|'celda'} tipo
 *   `mueve`: cambió la opción resaltada; `nivel`: se entró en un grupo (conviene
 *   reiniciar el temporizador); `sube`: se volvió al nivel de arriba; `celda`:
 *   se eligió una celda (ver `id`).
 * @property {string} [id] Solo con `tipo: 'celda'`.
 */

/**
 * @param {{arbol: Nodo, vueltas?: number}} op
 *   `vueltas`: cuántas veces se recorre un grupo (a partir del segundo nivel)
 *   antes de volver al nivel de arriba. Mínimo 1.
 */
export function crearMotor({ arbol, vueltas = 2 }) {
  if (!arbol || !arbol.hijos || arbol.hijos.length === 0) {
    throw new Error('crearMotor: el árbol no tiene opciones');
  }
  const maxVueltas = Math.max(1, Math.floor(vueltas) || 1);

  /** @type {{nodo: Nodo, indice: number, pasadas: number}[]} */
  let pila = [];

  function reiniciar() {
    pila = [{ nodo: arbol, indice: 0, pasadas: 0 }];
  }
  reiniciar();

  const actual = () => pila[pila.length - 1];

  /** @returns {Resultado} */
  function avanzar() {
    const nivel = actual();
    nivel.indice += 1;
    if (nivel.indice < nivel.nodo.hijos.length) return { tipo: 'mueve' };
    // Llegó al final del nivel.
    if (pila.length > 1) {
      nivel.pasadas += 1;
      if (nivel.pasadas >= maxVueltas) {
        pila.pop();
        return { tipo: 'sube' };
      }
    }
    nivel.indice = 0;
    return { tipo: 'mueve' };
  }

  /** @returns {Resultado} */
  function retroceder() {
    const nivel = actual();
    const n = nivel.nodo.hijos.length;
    nivel.indice = (nivel.indice - 1 + n) % n;
    return { tipo: 'mueve' };
  }

  /** @returns {Resultado} */
  function seleccionar() {
    const nivel = actual();
    const elegido = nivel.nodo.hijos[nivel.indice];
    if (elegido.hijos) {
      pila.push({ nodo: elegido, indice: 0, pasadas: 0 });
      return { tipo: 'nivel' };
    }
    const id = elegido.celdas[0];
    reiniciar();
    return { tipo: 'celda', id };
  }

  /**
   * Qué resaltar ahora.
   * @returns {{ opcion: string[], grupo: string[]|null, nivel: number,
   *   indice: number, total: number }}
   *   `opcion`: ids de las celdas de la opción resaltada; `grupo`: ids del
   *   grupo en el que se está (null en el primer nivel, donde no hay grupo
   *   elegido todavía); `nivel`: 0 en el primero.
   */
  function estado() {
    const nivel = actual();
    return {
      opcion: nivel.nodo.hijos[nivel.indice].celdas,
      grupo: pila.length > 1 ? nivel.nodo.celdas : null,
      nivel: pila.length - 1,
      indice: nivel.indice,
      total: nivel.nodo.hijos.length,
    };
  }

  return { avanzar, retroceder, seleccionar, reiniciar, estado };
}
