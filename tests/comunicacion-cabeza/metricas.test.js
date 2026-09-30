import {
  mediana,
  desvioEstandar,
  crearSesion,
  resumenTexto,
} from '../../js/features/apps-epe/comunicacion-cabeza/metricas.js';

describe('estadística', () => {
  it('mediana', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
  it('desvío', () => {
    expect(desvioEstandar([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2);
    expect(desvioEstandar([1])).toBeNull();
  });
});

describe('sesión', () => {
  it('resume', () => {
    const s = crearSesion({ modo: 'pulsador', celdaMin: 100 }, 0);
    s.seleccion(1000, { id: 'l-h', tipo: 'letra', valor: 'h' });
    s.seleccion(3000, { id: 'l-o', tipo: 'letra', valor: 'o' });
    s.seleccion(4000, { id: 'a-hablar', tipo: 'accion', valor: 'hablar' });
    s.intentoSinEfecto('fuera');
    s.intentoSinEfecto('sin-puntero');
    s.muestra(0, true);
    s.muestra(1, false);
    for (let i = 0; i < 20; i += 1) s.eventoPuntero();
    const r = s.resumen(10000);
    expect(r.selecciones).toBe(3);
    expect(r.caracteres).toBe(2);
    expect(r.habladas).toBe(1);
    expect(r.medianaEntreSeleccionesS).toBe(1.5);
    expect(r.intentosFuera).toBe(1);
    expect(r.pctSinPuntero).toBe(50);
    expect(r.eventosPunteroPorS).toBe(2);
    expect(r.temblorPx).toBeNull();
  });
  it('temblor y texto', () => {
    const s = crearSesion({ modo: 'dwell', dwellMs: 1200 }, 0);
    [
      [0, 0],
      [2, 0],
      [0, 2],
      [2, 2],
    ].forEach(([x, y]) => s.posicion(x, y));
    const r = s.resumen(5000);
    expect(r.temblorPx).toBeCloseTo(1.4, 1);
    const t = resumenTexto(r);
    expect(t).toContain('Comunicación con seguimiento de cabeza');
    expect(t).toContain('permanencia');
    expect(t).not.toContain('Pulsaciones fuera');
  });
});

describe('recentrados', () => {
  it('se cuentan y aparecen en el resumen solo si hubo', () => {
    const s = crearSesion({ modo: 'pulsador' }, 0);
    expect(resumenTexto(s.resumen(1000))).not.toContain('Recentrados');
    s.recentrado();
    s.recentrado();
    const r = s.resumen(1000);
    expect(r.recentrados).toBe(2);
    expect(resumenTexto(r)).toContain('Recentrados del puntero: 2');
  });
});

describe('layout en el resumen', () => {
  it('se informa la disposición', () => {
    const s = crearSesion({ modo: 'pulsador', layout: 'qwerty' }, 0);
    expect(resumenTexto(s.resumen(1000))).toContain('Disposición del tablero: QWERTY');
  });
});

describe('zona de descanso en el resumen', () => {
  it('solo aparece en dwell', () => {
    const d = crearSesion({ modo: 'dwell', dwellMs: 1200, descansoTam: 'mediana' }, 0);
    expect(resumenTexto(d.resumen(1000))).toContain('Zona de descanso central: mediana');
    const p = crearSesion({ modo: 'pulsador', descansoTam: 'mediana' }, 0);
    expect(resumenTexto(p.resumen(1000))).not.toContain('Zona de descanso');
    const sin = crearSesion({ modo: 'dwell', dwellMs: 1200, descansoTam: null }, 0);
    expect(resumenTexto(sin.resumen(1000))).not.toContain('Zona de descanso');
  });
});
