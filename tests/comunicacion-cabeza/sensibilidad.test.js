import {
  factorDesdeSlider,
  valoresTracky,
  sliderDesdeX,
  BASE,
  MAX_TRACKY,
} from '../../js/features/apps-epe/comunicacion-cabeza/sensibilidad.js';

describe('sensibilidad', () => {
  it('el centro es el valor de fábrica de Tracky', () => {
    expect(factorDesdeSlider(50)).toBe(1);
    expect(valoresTracky(50)).toEqual(BASE);
  });
  it('los extremos son 0,25× y 4×', () => {
    expect(factorDesdeSlider(0)).toBeCloseTo(0.25);
    expect(factorDesdeSlider(100)).toBeCloseTo(4);
  });
  it('mantiene la proporción vertical:horizontal (salvo el tope de Tracky)', () => {
    const v = valoresTracky(25);
    expect(v.y / v.x).toBeCloseTo(2, 0);
  });
  it('nunca pasa el máximo de Tracky ni baja de 0', () => {
    const alto = valoresTracky(100);
    expect(alto.y).toBe(MAX_TRACKY);
    expect(alto.x).toBe(100);
    expect(valoresTracky(-50).x).toBeGreaterThanOrEqual(0);
    expect(valoresTracky(500).y).toBeLessThanOrEqual(MAX_TRACKY);
  });
  it('es monótona: más slider, más velocidad', () => {
    let previo = -1;
    for (let v = 0; v <= 100; v += 5) {
      const { x } = valoresTracky(v);
      expect(x).toBeGreaterThanOrEqual(previo);
      previo = x;
    }
  });
  it('ida y vuelta: leer lo escrito devuelve el mismo slider', () => {
    [10, 25, 40, 50, 60, 75, 90].forEach((v) => {
      expect(Math.abs(sliderDesdeX(valoresTracky(v).x) - v)).toBeLessThanOrEqual(1);
    });
  });
  it('un slider horizontal en 0 o inválido queda en el mínimo', () => {
    expect(sliderDesdeX(0)).toBe(0);
    expect(sliderDesdeX(NaN)).toBe(0);
    expect(sliderDesdeX(180)).toBeLessThanOrEqual(100);
  });
});
