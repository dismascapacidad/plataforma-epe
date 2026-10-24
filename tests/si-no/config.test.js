import { describe, it, expect } from 'vitest';
import {
  configInicial,
  validarConfig,
  esImagenValida,
  limpiarTexto,
  cantidadActiva,
  celdasActivas,
  cargarConfig,
  guardarConfig,
  CLAVE_STORAGE,
  MAX_TEXTO,
} from '../../js/features/apps-epe/si-no/config.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

/** @returns {any} */
function storageFalso(inicial = {}) {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => {
      datos[k] = String(v);
    },
  };
}

describe('esImagenValida', () => {
  it('acepta PNG, JPEG y WebP en data URL', () => {
    expect(esImagenValida(PNG)).toBe(true);
    expect(esImagenValida('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(esImagenValida('data:image/webp;base64,AAAA')).toBe(true);
  });
  it('rechaza SVG, GIF, otros esquemas y no-strings', () => {
    expect(esImagenValida('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(esImagenValida('data:image/gif;base64,AAAA')).toBe(false);
    expect(esImagenValida('https://static.arasaac.org/x.png')).toBe(false);
    expect(esImagenValida('javascript:alert(1)')).toBe(false);
    expect(esImagenValida(null)).toBe(false);
    expect(esImagenValida(42)).toBe(false);
  });
  it('rechaza imágenes demasiado grandes', () => {
    expect(esImagenValida('data:image/png;base64,' + 'A'.repeat(700_000))).toBe(false);
  });
});

describe('limpiarTexto', () => {
  it('junta espacios, recorta y acota el largo', () => {
    expect(limpiarTexto('  hola   mundo ')).toBe('hola mundo');
    expect(limpiarTexto('x'.repeat(500)).length).toBe(MAX_TEXTO);
    expect(limpiarTexto(undefined)).toBe('');
  });
});

describe('validarConfig', () => {
  it('sin datos devuelve la configuración de fábrica', () => {
    expect(validarConfig(null)).toEqual(configInicial());
    expect(validarConfig('basura')).toEqual(configInicial());
  });
  it('de fábrica: Sí / No / No sé, tercera apagada, pulsadores', () => {
    const c = configInicial();
    expect(c.celdas.map((x) => x.texto)).toEqual(['Sí', 'No', 'No sé']);
    expect(c.tercera).toBe(false);
    expect(c.acceso).toBe('pulsadores');
    expect(c.leerAlResaltar).toBe(false);
    expect(c.cabeza.dwellMs).toBe(1200);
  });
  it('descarta imágenes inválidas pero conserva el texto', () => {
    const c = validarConfig({
      celdas: [
        { texto: 'Claro', imagen: 'javascript:alert(1)' },
        { texto: 'Nunca', imagen: PNG, fuente: 'arasaac' },
      ],
    });
    expect(c.celdas[0]).toEqual({ imagen: null, fuente: null, texto: 'Claro' });
    expect(c.celdas[1].imagen).toBe(PNG);
    expect(c.celdas[1].fuente).toBe('arasaac');
    expect(c.celdas[2].texto).toBe('No sé');
  });
  it('una fuente desconocida cuenta como archivo', () => {
    const c = validarConfig({ celdas: [{ texto: 'a', imagen: PNG, fuente: 'otra' }] });
    expect(c.celdas[0].fuente).toBe('archivo');
  });
  it('valida las opciones de cabeza', () => {
    const c = validarConfig({
      acceso: 'cabeza',
      cabeza: { seleccion: 'dwell', dwellMs: 999, descanso: false, teclaRecentrar: null },
    });
    expect(c.acceso).toBe('cabeza');
    expect(c.cabeza.seleccion).toBe('dwell');
    expect(c.cabeza.dwellMs).toBe(1200); // 999 no es una opción: vuelve al valor de fábrica
    expect(c.cabeza.descanso).toBe(false);
    expect(c.cabeza.teclaRecentrar).toBeNull();
  });
  it('un modo de acceso desconocido vuelve a pulsadores', () => {
    expect(validarConfig({ acceso: 'telepatia' }).acceso).toBe('pulsadores');
  });
});

describe('casillas activas', () => {
  it('son 2, o 3 con la tercera activada', () => {
    const c = configInicial();
    expect(cantidadActiva(c)).toBe(2);
    expect(celdasActivas(c).map((x) => x.id)).toEqual(['c0', 'c1']);
    c.tercera = true;
    expect(cantidadActiva(c)).toBe(3);
    expect(celdasActivas(c).map((x) => x.id)).toEqual(['c0', 'c1', 'c2']);
    expect(celdasActivas(c)[2].indice).toBe(2);
  });
});

describe('persistencia', () => {
  it('guarda y vuelve a cargar', () => {
    const s = storageFalso();
    const c = configInicial();
    c.tercera = true;
    c.celdas[0].texto = 'Dale';
    expect(guardarConfig(c, s)).toBe(true);
    expect(cargarConfig(s)).toEqual(c);
  });
  it('JSON roto en el storage: configuración de fábrica', () => {
    const s = storageFalso({ [CLAVE_STORAGE]: '{no es json' });
    expect(cargarConfig(s)).toEqual(configInicial());
  });
  it('storage lleno o ausente: guardar devuelve false y cargar no explota', () => {
    /** @type {any} */
    const lleno = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(guardarConfig(configInicial(), lleno)).toBe(false);
    expect(guardarConfig(configInicial(), null)).toBe(false);
    expect(cargarConfig(null)).toEqual(configInicial());
  });
});
