import {
  CONFIG_INICIAL,
  validarConfig,
  cargarConfig,
  guardarConfig,
} from '../../js/features/apps-epe/barrido/config.js';
import { TECLAS_POR_DEFECTO } from '../../js/features/apps-epe/barrido/eventos.js';

/** @returns {any} */
function storageFalso(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    datos,
  };
}

describe('validar configuración', () => {
  it('sin datos devuelve la inicial', () => {
    expect(validarConfig(null)).toEqual(CONFIG_INICIAL);
    expect(validarConfig('basura')).toEqual(CONFIG_INICIAL);
  });
  it('conserva los valores válidos', () => {
    const c = validarConfig({
      objetivo: 'comunicacion',
      metodo: 'dirigido',
      patron: 'binario',
      conRetroceso: true,
      intervaloMs: 900,
      vueltas: 3,
      layout: 'qwerty',
      reproduccion: 'tecla',
      vozNombre: 'Microsoft Elena',
      velocidadVoz: 1.2,
    });
    expect(c).toMatchObject({
      objetivo: 'comunicacion',
      metodo: 'dirigido',
      patron: 'binario',
      conRetroceso: true,
      intervaloMs: 900,
      vueltas: 3,
      layout: 'qwerty',
      reproduccion: 'tecla',
      vozNombre: 'Microsoft Elena',
      velocidadVoz: 1.2,
    });
  });
  it('descarta lo inválido campo por campo', () => {
    const c = validarConfig({
      objetivo: 'otro',
      metodo: 'x',
      patron: 'diagonal',
      intervaloMs: 10,
      vueltas: 99,
      layout: 'dvorak',
      velocidadVoz: 9,
    });
    expect(c).toEqual(CONFIG_INICIAL);
  });
});

describe('teclas guardadas', () => {
  it('acepta una asignación completa y sin repetidas', () => {
    const teclas = { avanzar: 'a', seleccionar: 's', retroceder: 'd', reproducir: 'f' };
    expect(validarConfig({ teclas }).teclas).toEqual(teclas);
  });
  it('si hay dos iguales vuelve a las de fábrica', () => {
    const teclas = { avanzar: 'a', seleccionar: 'a', retroceder: 'd', reproducir: 'f' };
    expect(validarConfig({ teclas }).teclas).toEqual(TECLAS_POR_DEFECTO);
  });
  it('si falta alguna o es inválida vuelve a las de fábrica', () => {
    expect(validarConfig({ teclas: { avanzar: 'a' } }).teclas).toEqual(TECLAS_POR_DEFECTO);
    const conEsc = { avanzar: 'escape', seleccionar: 's', retroceder: 'd', reproducir: 'f' };
    expect(validarConfig({ teclas: conEsc }).teclas).toEqual(TECLAS_POR_DEFECTO);
  });
  it('no comparte el objeto de fábrica', () => {
    const c = validarConfig(null);
    c.teclas.avanzar = 'z';
    expect(TECLAS_POR_DEFECTO.avanzar).toBe('k');
  });
});

describe('persistencia', () => {
  it('guarda y vuelve a leer', () => {
    const s = storageFalso();
    guardarConfig({ ...CONFIG_INICIAL, patron: 'vertical', intervaloMs: 1000 }, s);
    expect(cargarConfig(s)).toMatchObject({ patron: 'vertical', intervaloMs: 1000 });
  });
  it('un JSON roto no rompe nada', () => {
    expect(cargarConfig(storageFalso({ 'epe-barrido': '{no es json' }))).toEqual(CONFIG_INICIAL);
  });
  it('sin storage o con storage que falla, sigue andando', () => {
    const roto = /** @type {any} */ ({
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    expect(cargarConfig(roto)).toEqual(CONFIG_INICIAL);
    expect(() => guardarConfig(CONFIG_INICIAL, roto)).not.toThrow();
    expect(cargarConfig(null)).toEqual(CONFIG_INICIAL);
  });
  it('solo guarda configuración: nunca texto escrito ni palabras', () => {
    const s = storageFalso();
    guardarConfig({ ...CONFIG_INICIAL, texto: 'Juan Pérez DNI 123', palabras: ['SECRETO'] }, s);
    const guardado = s.datos.get('epe-barrido');
    expect(guardado).not.toMatch(/Juan|SECRETO|palabras|texto/);
  });
});
