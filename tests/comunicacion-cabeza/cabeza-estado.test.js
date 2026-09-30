import {
  calidadSeguimiento,
  CALIDAD,
  textoCalidad,
} from '../../js/features/apps-epe/comunicacion-cabeza/cabeza-estado.js';

const base = { iniciada: true, pausada: false, hayCara: true, edadPunteroMs: 50 };

describe('calidadSeguimiento', () => {
  it('ok', () => expect(calidadSeguimiento(base)).toBe(CALIDAD.OK));
  it('sin iniciar', () =>
    expect(calidadSeguimiento({ ...base, iniciada: false })).toBe(CALIDAD.SIN_INICIAR));
  it('pausa tiene prioridad sobre cara', () => {
    expect(calidadSeguimiento({ ...base, pausada: true, hayCara: false })).toBe(CALIDAD.PAUSA);
  });
  it('sin cara', () =>
    expect(calidadSeguimiento({ ...base, hayCara: false })).toBe(CALIDAD.SIN_CARA));
  it('sin señal si el puntero está viejo o nunca llegó', () => {
    expect(calidadSeguimiento({ ...base, edadPunteroMs: 900 })).toBe(CALIDAD.SIN_SENIAL);
    expect(calidadSeguimiento({ ...base, edadPunteroMs: null })).toBe(CALIDAD.SIN_SENIAL);
  });
  it('todos los estados tienen texto', () => {
    Object.values(CALIDAD).forEach((c) => expect(textoCalidad(c)).not.toBe(''));
  });
});
