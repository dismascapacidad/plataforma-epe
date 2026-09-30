import {
  crearPulsador,
  crearDwell,
} from '../../js/features/apps-epe/comunicacion-cabeza/seleccion.js';

describe('pulsador', () => {
  it('elige la celda bajo el puntero', () => {
    const s = crearPulsador();
    s.alMover('a', 0);
    expect(s.alPresionar()).toEqual({ seleccion: 'a', motivo: 'ok' });
  });
  it('distingue fuera de celda y sin puntero', () => {
    const s = crearPulsador();
    s.alMover(null, 0, { punteroVivo: true });
    expect(s.alPresionar().motivo).toBe('fuera');
    s.alMover(null, 1, { punteroVivo: false });
    expect(s.alPresionar().motivo).toBe('sin-puntero');
  });
});

describe('dwell', () => {
  it('elige tras el tiempo', () => {
    const s = crearDwell({ ms: 1000 });
    s.alMover('a', 0);
    expect(s.tick(500).seleccion).toBeNull();
    expect(s.tick(500).progreso).toBeCloseTo(0.5);
    expect(s.tick(1000).seleccion).toBe('a');
  });
  it('no repite la misma celda mientras el puntero siga ahí', () => {
    const s = crearDwell({ ms: 1000 });
    s.alMover('a', 0);
    s.tick(1000);
    expect(s.tick(3000).seleccion).toBeNull();
  });
  it('permite repetir después de salir y volver', () => {
    const s = crearDwell({ ms: 1000, toleranciaSalidaMs: 100 });
    s.alMover('a', 0);
    s.tick(1000);
    s.alMover(null, 1100);
    s.tick(1300); // supera la tolerancia: se libera
    s.alMover('a', 1400);
    expect(s.tick(2400).seleccion).toBe('a');
  });
  it('cambiar de celda reinicia el conteo', () => {
    const s = crearDwell({ ms: 1000 });
    s.alMover('a', 0);
    s.alMover('b', 800);
    expect(s.tick(1000).seleccion).toBeNull();
    expect(s.tick(1800).seleccion).toBe('b');
  });
  it('salida breve (temblor) no reinicia', () => {
    const s = crearDwell({ ms: 1000, toleranciaSalidaMs: 150 });
    s.alMover('a', 0);
    s.alMover(null, 500);
    s.tick(600);
    s.alMover('a', 650);
    expect(s.tick(1000).seleccion).toBe('a');
  });
  it('salida larga reinicia', () => {
    const s = crearDwell({ ms: 1000, toleranciaSalidaMs: 150 });
    s.alMover('a', 0);
    s.alMover(null, 500);
    s.tick(800);
    s.alMover('a', 850);
    expect(s.tick(1500).seleccion).toBeNull();
    expect(s.tick(1850).seleccion).toBe('a');
  });
  it('salir sin volver no selecciona', () => {
    const s = crearDwell({ ms: 1000 });
    s.alMover('a', 0);
    s.alMover(null, 900);
    expect(s.tick(1500).seleccion).toBeNull();
  });
});
