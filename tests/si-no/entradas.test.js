import { describe, it, expect } from 'vitest';
import {
  accionesPanel,
  completarTeclasGuardadas,
  entradasCabeza,
  conFranjaDescanso,
  distribucion,
  reparto,
} from '../../js/features/apps-epe/si-no/entradas.js';
import { configInicial } from '../../js/features/apps-epe/si-no/config.js';

const celdas = [
  { id: 'c0', indice: 0, texto: 'Sí' },
  { id: 'c1', indice: 1, texto: 'No' },
  { id: 'c2', indice: 2, texto: '' },
];

describe('accionesPanel', () => {
  it('una acción por casilla, con tecla de fábrica A, B, C', () => {
    const a = accionesPanel(celdas);
    expect(a.map((x) => x.id)).toEqual(['c0', 'c1', 'c2']);
    expect(a.map((x) => x.tecla)).toEqual(['a', 'b', 'c']);
    expect(a[2].etiqueta).toBe('Casilla 3'); // sin texto: nombre genérico
    expect(a[0].etiqueta).toBe('Sí');
  });
});

describe('completarTeclasGuardadas', () => {
  const acciones = accionesPanel(celdas);
  it('sin nada guardado devuelve null', () => {
    expect(completarTeclasGuardadas(null, acciones)).toBeNull();
    expect(completarTeclasGuardadas({}, acciones)).toBeNull();
  });
  it('conserva las teclas elegidas y agrega la de la casilla nueva', () => {
    const r = completarTeclasGuardadas(
      { modo: 'manual', teclas: { c0: 'q', c1: 'w' }, avanzar: 'k', seleccionar: 'l' },
      acciones,
    );
    expect(r.teclas).toEqual({ c0: 'q', c1: 'w', c2: 'c' });
    expect(r.modo).toBe('manual');
  });
  it('si la tecla de fábrica ya está tomada, usa otra libre', () => {
    const r = completarTeclasGuardadas(
      { teclas: { c0: 'c', c1: 'b' }, avanzar: 'k', seleccionar: 'l' },
      acciones,
    );
    expect(r.teclas.c2).toBe('a');
    expect(new Set(Object.values(r.teclas)).size).toBe(3);
  });
  it('no modifica el objeto original', () => {
    const orig = { teclas: { c0: 'a', c1: 'b' }, avanzar: 'k', seleccionar: 'l' };
    completarTeclasGuardadas(orig, acciones);
    expect(orig.teclas).toEqual({ c0: 'a', c1: 'b' });
  });
});

describe('entradasCabeza', () => {
  it('pulsador: K y recentrar', () => {
    expect(entradasCabeza({ seleccion: 'pulsador', teclaRecentrar: 'c' })).toEqual([
      { id: 'k', etiqueta: 'Elegir la casilla bajo el puntero', tecla: 'k' },
      { id: 'recentrar', etiqueta: 'Recentrar el puntero al centro', tecla: 'c' },
    ]);
  });
  it('dwell sin tecla de recentrar: nada para programar', () => {
    expect(entradasCabeza({ seleccion: 'dwell', teclaRecentrar: null })).toEqual([]);
  });
  it('dwell con recentrar: solo recentrar', () => {
    const r = entradasCabeza({ seleccion: 'dwell', teclaRecentrar: 'c' });
    expect(r.map((x) => x.id)).toEqual(['recentrar']);
  });
});

describe('conFranjaDescanso', () => {
  it('solo en cabeza + dwell con descanso activado', () => {
    const c = configInicial();
    expect(conFranjaDescanso(c)).toBe(false);
    c.acceso = 'cabeza';
    expect(conFranjaDescanso(c)).toBe(false); // pulsador: no hace falta
    c.cabeza.seleccion = 'dwell';
    expect(conFranjaDescanso(c)).toBe(true);
    c.cabeza.descanso = false;
    expect(conFranjaDescanso(c)).toBe(false);
  });
});

describe('distribucion', () => {
  it('apaisada: lado a lado; vertical: apiladas', () => {
    expect(distribucion(3, 1200, 700)).toEqual({ columnas: 3, filas: 1 });
    expect(distribucion(2, 400, 800)).toEqual({ columnas: 1, filas: 2 });
  });
});

describe('reparto', () => {
  it('sin descanso: casillas en fila (apaisada) o en columna (vertical)', () => {
    const a = reparto(2, 1200, 700, false);
    expect(a.celdas).toEqual([
      { col: 1, fila: 1, filas: 1 },
      { col: 2, fila: 1, filas: 1 },
    ]);
    expect(a.descanso).toBeNull();
    const v = reparto(3, 400, 800, false);
    expect(v.celdas.map((c) => c.fila)).toEqual([1, 2, 3]);
    expect(v.descanso).toBeNull();
  });

  it('2 casillas apaisadas con descanso: franja vertical al medio del 30 % del ancho de una casilla', () => {
    const r = reparto(2, 1200, 700, true);
    expect(r.columnas).toBe('minmax(0, 1fr) minmax(0, 0.3fr) minmax(0, 1fr)');
    expect(r.celdas.map((c) => c.col)).toEqual([1, 3]);
    expect(r.descanso).toEqual({ col: 2, fila: 1, vertical: true });
  });

  it('3 casillas apaisadas con descanso: laterales a todo el alto; al medio 70 % casilla + 30 % descanso debajo', () => {
    const r = reparto(3, 1200, 700, true);
    expect(r.filas).toBe('minmax(0, 7fr) minmax(0, 3fr)');
    expect(r.celdas).toEqual([
      { col: 1, fila: 1, filas: 2 },
      { col: 2, fila: 1, filas: 1 },
      { col: 3, fila: 1, filas: 2 },
    ]);
    expect(r.descanso).toEqual({ col: 2, fila: 2, vertical: false });
  });

  it('vertical con descanso: casillas apiladas y franja horizontal (con 3, debajo de la del medio)', () => {
    const dos = reparto(2, 400, 800, true);
    expect(dos.celdas.map((c) => c.fila)).toEqual([1, 3]);
    expect(dos.descanso).toEqual({ col: 1, fila: 2, vertical: false });
    const tres = reparto(3, 400, 800, true);
    expect(tres.celdas.map((c) => c.fila)).toEqual([1, 2, 4]);
    expect(tres.descanso).toEqual({ col: 1, fila: 3, vertical: false });
  });

  it('nunca se pisan: cada posición de grilla la usa una sola casilla o el descanso', () => {
    for (const [n, a, h] of [
      [2, 1200, 700],
      [3, 1200, 700],
      [2, 400, 800],
      [3, 400, 800],
    ]) {
      const r = reparto(n, a, h, true);
      const usadas = new Set();
      const todos = [...r.celdas, { ...r.descanso, filas: 1 }];
      for (const c of todos) {
        for (let k = 0; k < c.filas; k++) {
          const clave = `${c.col},${c.fila + k}`;
          expect(usadas.has(clave)).toBe(false);
          usadas.add(clave);
        }
      }
    }
  });
});
