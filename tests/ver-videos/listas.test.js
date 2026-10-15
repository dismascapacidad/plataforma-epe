import { describe, it, expect } from 'vitest';
import {
  analizarEnlace,
  normalizarNombre,
  nombrePorDefecto,
  urlBusqueda,
  normalizarItem,
  cargarListas,
  guardarListas,
  borrarListas,
  CLAVE_STORAGE,
  LARGO_MAX_NOMBRE,
} from '../../js/features/apps-epe/ver-videos/listas.js';

const VIDEO = 'dQw4w9WgXcQ';
const LISTA = 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI';

function almacenFalso(inicial = {}) {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => {
      datos[k] = String(v);
    },
    removeItem: (k) => {
      delete datos[k];
    },
  };
}

describe('analizarEnlace', () => {
  it('lista de YouTube (playlist?list=)', () => {
    expect(analizarEnlace(`https://www.youtube.com/playlist?list=${LISTA}`)).toEqual({
      ok: true,
      tipo: 'lista',
      id: LISTA,
    });
  });

  it('video con lista: gana la lista', () => {
    const r = analizarEnlace(`https://www.youtube.com/watch?v=${VIDEO}&list=${LISTA}&index=2`);
    expect(r).toEqual({ ok: true, tipo: 'lista', id: LISTA });
  });

  it('video suelto en sus formas habituales', () => {
    const formas = [
      `https://www.youtube.com/watch?v=${VIDEO}`,
      `https://youtu.be/${VIDEO}?si=abc`,
      `https://m.youtube.com/watch?v=${VIDEO}&t=10s`,
      `https://www.youtube.com/shorts/${VIDEO}`,
      `https://www.youtube.com/embed/${VIDEO}`,
      `https://www.youtube-nocookie.com/embed/${VIDEO}`,
      `youtube.com/watch?v=${VIDEO}`,
    ];
    formas.forEach((f) =>
      expect(analizarEnlace(f)).toEqual({ ok: true, tipo: 'video', id: VIDEO }),
    );
  });

  it('tolera espacios alrededor', () => {
    expect(analizarEnlace(`  https://youtu.be/${VIDEO}  `).ok).toBe(true);
  });

  it('un Mix o una lista de la cuenta no sirve', () => {
    expect(analizarEnlace('https://www.youtube.com/playlist?list=RDCLAK5uy_abcdefghijk')).toEqual({
      ok: false,
      motivo: 'no-compatible',
    });
    expect(analizarEnlace('https://www.youtube.com/playlist?list=WL')).toEqual({
      ok: false,
      motivo: 'no-compatible',
    });
  });

  it('video dentro de un Mix: se usa el video', () => {
    const r = analizarEnlace(
      `https://www.youtube.com/watch?v=${VIDEO}&list=RD${VIDEO}&start_radio=1`,
    );
    expect(r).toEqual({ ok: true, tipo: 'video', id: VIDEO });
  });

  it('rechaza lo que no es de YouTube', () => {
    [
      'https://vimeo.com/123456789',
      'https://evil.com/watch?v=' + VIDEO,
      'https://youtube.com.evil.com/watch?v=' + VIDEO,
      'https://notyoutube.com/watch?v=' + VIDEO,
      'javascript:alert(1)',
      'ftp://youtube.com/watch?v=' + VIDEO,
    ].forEach((t) => expect(analizarEnlace(t)).toEqual({ ok: false, motivo: 'no-youtube' }));
  });

  it('rechaza IDs mal formados o con caracteres raros', () => {
    expect(analizarEnlace('https://www.youtube.com/watch?v=corto').motivo).toBe('sin-id');
    expect(analizarEnlace('https://www.youtube.com/watch?v=' + VIDEO + 'x').motivo).toBe('sin-id');
    expect(analizarEnlace('https://www.youtube.com/watch?v="><script>x').motivo).toBe('sin-id');
    expect(analizarEnlace('https://www.youtube.com/playlist?list=a%22b').motivo).toBe('sin-id');
    expect(analizarEnlace('https://www.youtube.com/').motivo).toBe('sin-id');
  });

  it('vacío y tipos raros', () => {
    expect(analizarEnlace('').motivo).toBe('vacio');
    expect(analizarEnlace('   ').motivo).toBe('vacio');
    expect(analizarEnlace(null).motivo).toBe('vacio');
    expect(analizarEnlace(undefined).motivo).toBe('vacio');
    expect(analizarEnlace(42).motivo).toBe('vacio');
  });

  it('un texto larguísimo se descarta', () => {
    expect(analizarEnlace('https://youtu.be/' + 'a'.repeat(400)).ok).toBe(false);
  });
});

describe('normalizarNombre y búsqueda', () => {
  it('junta espacios y acota el largo', () => {
    expect(normalizarNombre('  Canciones   infantiles ')).toBe('Canciones infantiles');
    expect(normalizarNombre('x'.repeat(100))).toHaveLength(LARGO_MAX_NOMBRE);
    expect(normalizarNombre(null)).toBe('');
  });

  it('nombre por defecto según el tipo', () => {
    expect(nombrePorDefecto('video')).toBe('Video');
    expect(nombrePorDefecto('lista')).toBe('Lista de YouTube');
  });

  it('URL de búsqueda codificada, o null si no hay término', () => {
    expect(urlBusqueda('canciones infantiles & más')).toBe(
      'https://www.youtube.com/results?search_query=canciones%20infantiles%20%26%20m%C3%A1s',
    );
    expect(urlBusqueda('   ')).toBeNull();
    expect(urlBusqueda(undefined)).toBeNull();
  });
});

describe('normalizarItem', () => {
  it('conserva un ítem válido y completa el nombre', () => {
    expect(normalizarItem({ tipo: 'video', id: VIDEO, nombre: '' })).toEqual({
      tipo: 'video',
      id: VIDEO,
      nombre: 'Video',
    });
  });

  it('descarta lo inválido', () => {
    expect(normalizarItem(null)).toBeNull();
    expect(normalizarItem({ tipo: 'otro', id: VIDEO })).toBeNull();
    expect(normalizarItem({ tipo: 'video', id: 'corto' })).toBeNull();
    expect(normalizarItem({ tipo: 'lista', id: 'RDCLAK5uy_abcdefghijk' })).toBeNull();
  });

  it('descarta campos de más', () => {
    const r = normalizarItem({ tipo: 'video', id: VIDEO, nombre: 'a', url: 'https://evil.com' });
    expect(Object.keys(r).sort()).toEqual(['id', 'nombre', 'tipo']);
  });
});

describe('guardado local', () => {
  it('ida y vuelta, siempre con 2 lugares', () => {
    const s = almacenFalso();
    expect(guardarListas([{ tipo: 'lista', id: LISTA, nombre: 'Música' }, null], s)).toBe(true);
    expect(cargarListas(s)).toEqual([{ tipo: 'lista', id: LISTA, nombre: 'Música' }, null]);
  });

  it('sin nada guardado devuelve dos lugares vacíos', () => {
    expect(cargarListas(almacenFalso())).toEqual([null, null]);
  });

  it('lo corrupto o manipulado se ignora', () => {
    expect(cargarListas(almacenFalso({ [CLAVE_STORAGE]: '{no es json' }))).toEqual([null, null]);
    expect(
      cargarListas(almacenFalso({ [CLAVE_STORAGE]: JSON.stringify({ v: 2, listas: [] }) })),
    ).toEqual([null, null]);
    const manipulado = JSON.stringify({
      v: 1,
      listas: [
        { tipo: 'video', id: '"><img src=x onerror=alert(1)>' },
        { tipo: 'video', id: VIDEO },
      ],
    });
    expect(cargarListas(almacenFalso({ [CLAVE_STORAGE]: manipulado }))).toEqual([
      null,
      { tipo: 'video', id: VIDEO, nombre: 'Video' },
    ]);
  });

  it('sin almacenamiento no falla', () => {
    expect(cargarListas(null)).toEqual([null, null]);
    expect(guardarListas([null, null], null)).toBe(false);
    expect(borrarListas(null)).toBe(false);
  });

  it('un almacenamiento que tira error no rompe', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('lleno');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(cargarListas(roto)).toEqual([null, null]);
    expect(guardarListas([null, null], roto)).toBe(false);
    expect(borrarListas(roto)).toBe(false);
  });

  it('borrar deja todo vacío', () => {
    const s = almacenFalso();
    guardarListas([{ tipo: 'video', id: VIDEO, nombre: 'v' }, null], s);
    expect(borrarListas(s)).toBe(true);
    expect(cargarListas(s)).toEqual([null, null]);
  });
});
