import { construirArbol } from '../../js/features/apps-epe/barrido/patrones.js';
import { crearMotor } from '../../js/features/apps-epe/barrido/motor.js';

// a b c
// d e f
const GRILLA = [
  { id: 'a', fila: 1, col: 1 },
  { id: 'b', fila: 1, col: 2 },
  { id: 'c', fila: 1, col: 3 },
  { id: 'd', fila: 2, col: 1 },
  { id: 'e', fila: 2, col: 2 },
  { id: 'f', fila: 2, col: 3 },
];

const motor = (patron, vueltas) => crearMotor({ arbol: construirArbol(patron, GRILLA), vueltas });

describe('celda a celda', () => {
  it('avanza, da la vuelta y selecciona la celda resaltada', () => {
    const m = motor('celda');
    expect(m.estado().opcion).toEqual(['a']);
    m.avanzar();
    m.avanzar();
    expect(m.estado().opcion).toEqual(['c']);
    expect(m.seleccionar()).toEqual({ tipo: 'celda', id: 'c' });
    expect(m.estado().opcion).toEqual(['a']); // vuelve al inicio
  });
  it('en el primer nivel el recorrido da la vuelta sin subir ni bajar', () => {
    const m = motor('celda');
    for (let i = 0; i < 6; i += 1) expect(m.avanzar().tipo).toBe('mueve');
    expect(m.estado().indice).toBe(0);
  });
});

describe('retroceder', () => {
  it('va al elemento anterior del mismo nivel, con vuelta al final', () => {
    const m = motor('celda');
    m.retroceder();
    expect(m.estado().opcion).toEqual(['f']);
    m.retroceder();
    expect(m.estado().opcion).toEqual(['e']);
  });
  it('dentro de un grupo no sale del grupo', () => {
    const m = motor('horizontal');
    m.seleccionar(); // entra en la fila 1
    m.retroceder();
    expect(m.estado().nivel).toBe(1);
    expect(m.estado().opcion).toEqual(['c']);
  });
});

describe('horizontal', () => {
  it('elige la fila y después la celda', () => {
    const m = motor('horizontal');
    m.avanzar(); // fila 2
    expect(m.estado().opcion).toEqual(['d', 'e', 'f']);
    expect(m.seleccionar().tipo).toBe('nivel');
    expect(m.estado().grupo).toEqual(['d', 'e', 'f']);
    m.avanzar();
    expect(m.seleccionar()).toEqual({ tipo: 'celda', id: 'e' });
    expect(m.estado().nivel).toBe(0);
  });
});

describe('vertical', () => {
  it('elige la columna y después la celda', () => {
    const m = motor('vertical');
    m.avanzar(); // columna 2: b, e
    m.seleccionar();
    m.avanzar();
    expect(m.seleccionar()).toEqual({ tipo: 'celda', id: 'e' });
  });
});

describe('binario', () => {
  it('llega a cualquier celda eligiendo mitades', () => {
    const m = motor('binario');
    // objetivo: f  -> segunda mitad (d e f) -> segunda mitad (f)
    m.avanzar();
    expect(m.seleccionar().tipo).toBe('nivel');
    expect(m.estado().opcion).toEqual(['d', 'e']);
    m.avanzar();
    expect(m.estado().opcion).toEqual(['f']);
    expect(m.seleccionar()).toEqual({ tipo: 'celda', id: 'f' });
  });
  it('alcanza todas las celdas', () => {
    const alcanzadas = new Set();
    for (let objetivo = 0; objetivo < 6; objetivo += 1) {
      const m = motor('binario');
      let r;
      do {
        // la opción 0 contiene al objetivo si su primer id está en la mitad izquierda
        const ids = GRILLA.map((c) => c.id);
        const { opcion } = m.estado();
        if (!opcion.includes(ids[objetivo])) m.avanzar();
        r = m.seleccionar();
      } while (r.tipo !== 'celda');
      alcanzadas.add(r.id);
    }
    expect(alcanzadas.size).toBe(6);
  });
});

describe('salir de un grupo mal elegido', () => {
  it('con 1 vuelta, al pasar la última opción vuelve a parar en el grupo que dejó', () => {
    const m = motor('horizontal', 1);
    m.avanzar(); // fila 2
    m.seleccionar();
    m.avanzar();
    m.avanzar();
    expect(m.avanzar().tipo).toBe('sube');
    expect(m.estado().nivel).toBe(0);
    expect(m.estado().opcion).toEqual(['d', 'e', 'f']);
  });
  it('con 2 vueltas recorre el grupo dos veces antes de subir', () => {
    const m = motor('horizontal', 2);
    m.seleccionar();
    const tipos = [];
    for (let i = 0; i < 6; i += 1) tipos.push(m.avanzar().tipo);
    expect(tipos).toEqual(['mueve', 'mueve', 'mueve', 'mueve', 'mueve', 'sube']);
  });
  it('al entrar de nuevo en un grupo, las vueltas arrancan de cero', () => {
    const m = motor('horizontal', 1);
    m.seleccionar();
    for (let i = 0; i < 3; i += 1) m.avanzar(); // sube
    m.seleccionar(); // vuelve a entrar en la misma fila
    expect(m.estado().indice).toBe(0);
    expect(m.avanzar().tipo).toBe('mueve');
  });
});

describe('robustez', () => {
  it('rechaza un árbol sin opciones', () => {
    expect(() => crearMotor({ arbol: { celdas: [], hijos: [] } })).toThrow();
  });
  it('reiniciar vuelve al primer nivel y a la primera opción', () => {
    const m = motor('horizontal');
    m.avanzar();
    m.seleccionar();
    m.reiniciar();
    expect(m.estado()).toMatchObject({ nivel: 0, indice: 0 });
  });
});
