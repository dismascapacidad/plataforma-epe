import {
  construirArbol,
  profundidad,
  PATRONES,
} from '../../js/features/apps-epe/barrido/patrones.js';

// Grilla de 2 filas x 3 columnas:   a b c
//                                   d e f
const GRILLA = [
  { id: 'a', fila: 1, col: 1 },
  { id: 'b', fila: 1, col: 2 },
  { id: 'c', fila: 1, col: 3 },
  { id: 'd', fila: 2, col: 1 },
  { id: 'e', fila: 2, col: 2 },
  { id: 'f', fila: 2, col: 3 },
];

const ids = (nodos) => nodos.map((n) => n.celdas.join(''));

describe('celda a celda', () => {
  it('un solo nivel con cada celda en orden de lectura', () => {
    const arbol = construirArbol('celda', [...GRILLA].reverse());
    expect(ids(arbol.hijos)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(arbol.hijos.every((h) => h.hijos === null)).toBe(true);
    expect(profundidad(arbol)).toBe(1);
  });
});

describe('horizontal (filas, luego columnas)', () => {
  it('primero las filas y dentro de cada una sus celdas', () => {
    const arbol = construirArbol('horizontal', GRILLA);
    expect(ids(arbol.hijos)).toEqual(['abc', 'def']);
    expect(ids(arbol.hijos[1].hijos)).toEqual(['d', 'e', 'f']);
    expect(profundidad(arbol)).toBe(2);
  });
  it('una fila con una sola celda es una celda suelta, sin nivel propio', () => {
    const arbol = construirArbol('horizontal', [...GRILLA, { id: 'g', fila: 3, col: 1 }]);
    expect(arbol.hijos[2].hijos).toBeNull();
    expect(arbol.hijos[2].celdas).toEqual(['g']);
  });
});

describe('vertical (columnas, luego filas)', () => {
  it('primero las columnas y dentro de cada una sus celdas, de arriba abajo', () => {
    const arbol = construirArbol('vertical', GRILLA);
    expect(ids(arbol.hijos)).toEqual(['ad', 'be', 'cf']);
    expect(ids(arbol.hijos[0].hijos)).toEqual(['a', 'd']);
    expect(profundidad(arbol)).toBe(2);
  });
  it('una celda ancha cuenta en la columna donde empieza', () => {
    // fila 2: una celda "ancha" que empieza en la columna 1 y ocupa 3.
    const celdas = [
      { id: 'a', fila: 1, col: 1 },
      { id: 'b', fila: 1, col: 2 },
      { id: 'c', fila: 1, col: 3 },
      { id: 'ancha', fila: 2, col: 1 },
    ];
    const arbol = construirArbol('vertical', celdas);
    expect(ids(arbol.hijos)).toEqual(['aancha', 'b', 'c']);
  });
});

describe('binario', () => {
  it('divide en mitades (la primera se queda con la de más)', () => {
    const arbol = construirArbol('binario', GRILLA);
    expect(ids(arbol.hijos)).toEqual(['abc', 'def']);
    expect(ids(arbol.hijos[0].hijos)).toEqual(['ab', 'c']);
    expect(ids(arbol.hijos[0].hijos[0].hijos)).toEqual(['a', 'b']);
  });
  it('siempre hay exactamente 2 opciones por nivel', () => {
    const arbol = construirArbol('binario', GRILLA);
    const recorrer = (n) => {
      if (!n.hijos) return;
      expect(n.hijos).toHaveLength(2);
      n.hijos.forEach(recorrer);
    };
    recorrer(arbol);
  });
  it('la profundidad crece como log2 de la cantidad de celdas', () => {
    const celdas = Array.from({ length: 32 }, (_, i) => ({
      id: `c${i}`,
      fila: Math.floor(i / 8) + 1,
      col: (i % 8) + 1,
    }));
    expect(profundidad(construirArbol('binario', celdas))).toBe(5);
  });
  it('con una sola celda la raíz tiene esa única opción', () => {
    const arbol = construirArbol('binario', [{ id: 'z', fila: 1, col: 1 }]);
    expect(ids(arbol.hijos)).toEqual(['z']);
  });
});

describe('todos los patrones', () => {
  it.each(PATRONES)('%s: no pierde ni repite ninguna celda', (patron) => {
    const arbol = construirArbol(patron, GRILLA);
    const hojas = [];
    const recorrer = (n) => (n.hijos ? n.hijos.forEach(recorrer) : hojas.push(n.celdas[0]));
    recorrer(arbol);
    expect([...hojas].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
  it('rechaza un patrón desconocido o una lista vacía', () => {
    expect(() => construirArbol('diagonal', GRILLA)).toThrow();
    expect(() => construirArbol('celda', [])).toThrow();
  });
});
