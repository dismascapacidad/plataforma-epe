import {
  calcularGrilla,
  celdasTablero,
  ACCIONES,
} from '../../js/features/apps-epe/comunicacion-cabeza/grilla.js';
import {
  aplicarCelda,
  textoParaHablar,
} from '../../js/features/apps-epe/comunicacion-cabeza/texto.js';

describe('celdasTablero', () => {
  it('incluye 27 letras y las 4 acciones, con ids únicos', () => {
    const c = celdasTablero();
    expect(c.filter((x) => x.tipo === 'letra')).toHaveLength(27);
    expect(c.filter((x) => x.tipo === 'accion').map((x) => x.valor)).toEqual([
      ACCIONES.ESPACIO,
      ACCIONES.BORRAR,
      ACCIONES.LIMPIAR,
      ACCIONES.HABLAR,
    ]);
    expect(new Set(c.map((x) => x.id)).size).toBe(c.length);
  });
});

describe('calcularGrilla', () => {
  it('todas las celdas caben en el espacio', () => {
    const g = calcularGrilla({ ancho: 1200, alto: 500, cantidad: 31, celdaMin: 80 });
    expect(g.cols * g.filas).toBeGreaterThanOrEqual(31);
    expect(g.cols * g.celdaAncho + 8 * (g.cols - 1)).toBeLessThanOrEqual(1200);
    expect(g.filas * g.celdaAlto + 8 * (g.filas - 1)).toBeLessThanOrEqual(500);
    expect(g.cumpleMinimo).toBe(true);
  });
  it('avisa cuando no se llega al mínimo', () => {
    const g = calcularGrilla({ ancho: 800, alto: 300, cantidad: 31, celdaMin: 120 });
    expect(g.cumpleMinimo).toBe(false);
  });
  it('más alto disponible no achica las celdas', () => {
    const a = calcularGrilla({ ancho: 1000, alto: 400, cantidad: 31 });
    const b = calcularGrilla({ ancho: 1000, alto: 600, cantidad: 31 });
    expect(Math.min(b.celdaAncho, b.celdaAlto)).toBeGreaterThanOrEqual(
      Math.min(a.celdaAncho, a.celdaAlto),
    );
  });
  it('entradas inválidas no rompen', () => {
    expect(calcularGrilla({ ancho: 0, alto: 0, cantidad: 5 }).cumpleMinimo).toBe(false);
  });
});

describe('aplicarCelda', () => {
  const L = (v) => ({ tipo: 'letra', valor: v });
  const A = (v) => ({ tipo: 'accion', valor: v });
  it('agrega letras', () => expect(aplicarCelda('ho', L('l')).texto).toBe('hol'));
  it('espacio: no inicial ni doble', () => {
    expect(aplicarCelda('', A(ACCIONES.ESPACIO)).texto).toBe('');
    expect(aplicarCelda('hola ', A(ACCIONES.ESPACIO)).texto).toBe('hola ');
    expect(aplicarCelda('hola', A(ACCIONES.ESPACIO)).texto).toBe('hola ');
  });
  it('borrar y limpiar', () => {
    expect(aplicarCelda('hola', A(ACCIONES.BORRAR)).texto).toBe('hol');
    expect(aplicarCelda('', A(ACCIONES.BORRAR)).texto).toBe('');
    expect(aplicarCelda('hola', A(ACCIONES.LIMPIAR)).texto).toBe('');
  });
  it('hablar solo con texto', () => {
    expect(aplicarCelda('hola', A(ACCIONES.HABLAR)).hablar).toBe(true);
    expect(aplicarCelda('  ', A(ACCIONES.HABLAR)).hablar).toBe(false);
  });
  it('tope de largo', () => {
    expect(aplicarCelda('a'.repeat(500), L('b')).texto).toHaveLength(500);
  });
  it('textoParaHablar normaliza espacios', () => {
    expect(textoParaHablar('  hola   mundo ')).toBe('hola mundo');
  });
});
