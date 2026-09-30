import {
  cargarConfig,
  guardarConfig,
  CONFIG_INICIAL,
  validarTeclaRecentrar,
  etiquetaTecla,
} from '../../js/features/apps-epe/comunicacion-cabeza/config.js';

/** @returns {any} */
const falso = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

describe('config', () => {
  it('sin nada guardado devuelve los valores iniciales', () => {
    expect(cargarConfig(falso())).toEqual(CONFIG_INICIAL);
  });
  it('guarda y recupera', () => {
    const s = falso();
    guardarConfig({ ...CONFIG_INICIAL, seleccion: 'dwell', dwellMs: 900 }, s);
    const c = cargarConfig(s);
    expect(c.seleccion).toBe('dwell');
    expect(c.dwellMs).toBe(900);
  });
  it('descarta valores fuera de rango', () => {
    const s = falso();
    s.setItem(
      'epe-comunicacion-cabeza',
      JSON.stringify({ seleccion: 'barrido', dwellMs: 5, celdaMin: 9999 }),
    );
    expect(cargarConfig(s)).toEqual(CONFIG_INICIAL);
  });
  it('JSON roto o storage que tira no rompe', () => {
    const s = falso();
    s.setItem('epe-comunicacion-cabeza', '{roto');
    expect(cargarConfig(s)).toEqual(CONFIG_INICIAL);
    expect(
      cargarConfig(
        /** @type {any} */ ({
          getItem: () => {
            throw new Error('x');
          },
        }),
      ),
    ).toEqual(CONFIG_INICIAL);
    expect(() =>
      guardarConfig(
        CONFIG_INICIAL,
        /** @type {any} */ ({
          setItem: () => {
            throw new Error('x');
          },
        }),
      ),
    ).not.toThrow();
  });
});

describe('tecla de recentrado', () => {
  it('por defecto es C', () => expect(CONFIG_INICIAL.teclaRecentrar).toBe('c'));
  it('acepta letras, números y flechas; normaliza a minúscula', () => {
    expect(validarTeclaRecentrar('C')).toEqual({ ok: true, tecla: 'c' });
    expect(validarTeclaRecentrar('ArrowUp')).toEqual({ ok: true, tecla: 'arrowup' });
    expect(validarTeclaRecentrar('5').ok).toBe(true);
  });
  it('rechaza las del pulsador y las reservadas', () => {
    ['k', 'K', ' ', 'Escape', 'F9', 'F1', 'Shift', 'Control', 'Dead', ''].forEach((t) => {
      expect(validarTeclaRecentrar(t).ok).toBe(false);
    });
  });
  it('null guardado se respeta (quitada a propósito)', () => {
    const s = falso();
    guardarConfig({ ...CONFIG_INICIAL, teclaRecentrar: null }, s);
    expect(cargarConfig(s).teclaRecentrar).toBeNull();
  });
  it('un valor guardado inválido vuelve a la de fábrica', () => {
    const s = falso();
    s.setItem('epe-comunicacion-cabeza', JSON.stringify({ teclaRecentrar: 'k' }));
    expect(cargarConfig(s).teclaRecentrar).toBe('c');
  });
  it('sin nada guardado usa C; una tecla válida se recupera', () => {
    expect(cargarConfig(falso()).teclaRecentrar).toBe('c');
    const s = falso();
    guardarConfig({ ...CONFIG_INICIAL, teclaRecentrar: 'x' }, s);
    expect(cargarConfig(s).teclaRecentrar).toBe('x');
  });
  it('etiquetas legibles', () => {
    expect(etiquetaTecla('c')).toBe('C');
    expect(etiquetaTecla('arrowleft')).toBe('←');
    expect(etiquetaTecla(null)).toBe('sin asignar');
  });
});

describe('layout', () => {
  it('por defecto es ABC y se guarda', () => {
    expect(cargarConfig(falso()).layout).toBe('abc');
    const s = falso();
    guardarConfig({ ...CONFIG_INICIAL, layout: 'qwerty' }, s);
    expect(cargarConfig(s).layout).toBe('qwerty');
  });
  it('un valor inválido vuelve a ABC', () => {
    const s = falso();
    s.setItem('epe-comunicacion-cabeza', JSON.stringify({ layout: 'dvorak' }));
    expect(cargarConfig(s).layout).toBe('abc');
  });
});

describe('zona de descanso', () => {
  it('por defecto está activa y es mediana', () => {
    const c = cargarConfig(falso());
    expect(c.descanso).toBe(true);
    expect(c.descansoTam).toBe('mediana');
  });
  it('se guarda y un valor inválido vuelve al de fábrica', () => {
    const s = falso();
    guardarConfig({ ...CONFIG_INICIAL, descanso: false, descansoTam: 'chica' }, s);
    expect(cargarConfig(s)).toMatchObject({ descanso: false, descansoTam: 'chica' });
    s.setItem('epe-comunicacion-cabeza', JSON.stringify({ descanso: 'si', descansoTam: 'enorme' }));
    expect(cargarConfig(s)).toMatchObject({ descanso: true, descansoTam: 'mediana' });
  });
});
