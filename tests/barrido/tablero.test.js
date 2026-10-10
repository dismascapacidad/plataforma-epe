import { posicionarCeldas } from '../../js/features/apps-epe/barrido/tablero.js';
import {
  celdasTablero,
  plantillaTablero,
} from '../../js/features/apps-epe/comunicacion-cabeza/grilla.js';

describe('posicionar celdas', () => {
  it('reparte en orden de lectura', () => {
    const r = posicionarCeldas([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2);
    expect(r).toEqual([
      { id: 'a', fila: 1, col: 1 },
      { id: 'b', fila: 1, col: 2 },
      { id: 'c', fila: 2, col: 1 },
    ]);
  });
  it('una celda ancha ocupa varias columnas y empuja a la siguiente', () => {
    const r = posicionarCeldas([{ id: 'a' }, { id: 'ancha' }, { id: 'b' }], 4, { ancha: 3 });
    expect(r.map((p) => [p.id, p.fila, p.col])).toEqual([
      ['a', 1, 1],
      ['ancha', 1, 2],
      ['b', 2, 1],
    ]);
  });
  it('una celda más ancha que la grilla no se sale de las columnas', () => {
    const r = posicionarCeldas([{ id: 'x' }], 3, { x: 9 });
    expect(r).toEqual([{ id: 'x', fila: 1, col: 1 }]);
  });
});

describe('con el tablero real de Comunicación', () => {
  it('QWERTY: 3 filas de letras y una de ESPACIO + HABLAR', () => {
    const celdas = celdasTablero('qwerty');
    const { cols, spans } = plantillaTablero('qwerty');
    const pos = Object.fromEntries(posicionarCeldas(celdas, cols, spans).map((p) => [p.id, p]));
    expect(pos['l-Q']).toMatchObject({ fila: 1, col: 1 });
    expect(pos['l-P']).toMatchObject({ fila: 1, col: 10 });
    expect(pos['l-A']).toMatchObject({ fila: 2, col: 1 });
    expect(pos['l-Z']).toMatchObject({ fila: 3, col: 1 });
    expect(pos['a-espacio']).toMatchObject({ fila: 4, col: 1 });
    expect(pos['a-hablar']).toMatchObject({ fila: 4, col: 7 });
  });
  it('ABC: cada celda tiene una posición única', () => {
    const celdas = celdasTablero('abc');
    const pos = posicionarCeldas(celdas, 7);
    const claves = new Set(pos.map((p) => `${p.fila}-${p.col}`));
    expect(claves.size).toBe(celdas.length);
  });
});
