import {
  ARASAAC_HABILITADO,
  ATRIBUCION_CORTA,
  LARGO_MAX_BUSQUEDA,
  MAX_BYTES_IMAGEN,
  buscar,
  descargarImagen,
  idValido,
  normalizarTermino,
  parsearResultados,
  urlBusqueda,
  urlImagen,
} from '../../js/features/apps-epe/vincular-imagen/arasaac.js';

describe('habilitación y atribución', () => {
  it('está habilitado (ARASAAC autorizó el uso de la API, 06/10/2026)', () => {
    expect(ARASAAC_HABILITADO).toBe(true);
  });
  it('la atribución es el texto exacto que pidió ARASAAC', () => {
    expect(ATRIBUCION_CORTA).toBe(
      'Autor pictogramas: Sergio Palao. Origen: ARASAAC (http://www.arasaac.org). ' +
        'Licencia: CC (BY-NC-SA). Propiedad: Gobierno de Aragón (España)',
    );
  });
});

describe('normalizarTermino', () => {
  it('recorta, junta espacios y acota el largo', () => {
    expect(normalizarTermino('  casa   grande ')).toBe('casa grande');
    expect(normalizarTermino('a'.repeat(200))).toHaveLength(LARGO_MAX_BUSQUEDA);
  });
  it('devuelve vacío si no es texto o queda vacío', () => {
    expect(normalizarTermino('   ')).toBe('');
    expect(normalizarTermino(null)).toBe('');
    expect(normalizarTermino(42)).toBe('');
  });
});

describe('urlBusqueda', () => {
  it('arma la URL con el idioma y el término codificado', () => {
    expect(urlBusqueda('casa')).toBe('https://api.arasaac.org/v1/pictograms/es/bestsearch/casa');
    expect(urlBusqueda('mamá y papá')).toBe(
      'https://api.arasaac.org/v1/pictograms/es/bestsearch/mam%C3%A1%20y%20pap%C3%A1',
    );
  });
  it('codifica barras y signos para que no cambien la ruta', () => {
    const url = urlBusqueda('../../x?y=1#z');
    expect(url.startsWith('https://api.arasaac.org/v1/pictograms/es/bestsearch/')).toBe(true);
    expect(url.slice('https://api.arasaac.org/v1/pictograms/es/bestsearch/'.length)).not.toMatch(
      /[/?#]/,
    );
  });
  it('ignora un idioma inválido', () => {
    expect(urlBusqueda('casa', '../evil')).toContain('/es/bestsearch/');
    expect(urlBusqueda('casa', 'en')).toContain('/en/bestsearch/');
  });
  it('devuelve null con término vacío', () => {
    expect(urlBusqueda('  ')).toBeNull();
  });
});

describe('idValido / urlImagen', () => {
  it('acepta solo enteros positivos razonables', () => {
    expect(idValido(2317)).toBe(true);
    for (const malo of [0, -1, 1.5, '2317', NaN, null, undefined, 1e9]) {
      expect(idValido(malo)).toBe(false);
    }
  });
  it('arma la URL de la imagen y rechaza lo inválido', () => {
    expect(urlImagen(2317)).toBe('https://static.arasaac.org/pictograms/2317/2317_300.png');
    expect(urlImagen(2317, 500)).toBe('https://static.arasaac.org/pictograms/2317/2317_500.png');
    expect(urlImagen('2317/../x')).toBeNull();
    expect(urlImagen(2317, 99)).toBeNull();
  });
});

describe('parsearResultados', () => {
  it('toma id, primera palabra y URL; quita repetidos e inválidos', () => {
    const json = [
      { _id: 6964, keywords: [{ keyword: 'casa' }, { keyword: 'hogar' }] },
      { _id: 6964, keywords: [{ keyword: 'casa' }] },
      { _id: 2317, keywords: [] },
      { _id: 'x', keywords: [{ keyword: 'malo' }] },
      null,
      'texto',
    ];
    expect(parsearResultados(json)).toEqual([
      { id: 6964, palabra: 'casa', url: 'https://static.arasaac.org/pictograms/6964/6964_300.png' },
      { id: 2317, palabra: '', url: 'https://static.arasaac.org/pictograms/2317/2317_300.png' },
    ]);
  });
  it('devuelve [] si la respuesta no es una lista', () => {
    expect(parsearResultados({ error: 'x' })).toEqual([]);
    expect(parsearResultados(null)).toEqual([]);
  });
  it('no deja pasar HTML como palabra más allá de texto plano acotado', () => {
    const [r] = parsearResultados([{ _id: 1, keywords: [{ keyword: '<img src=x>'.repeat(20) }] }]);
    expect(r.palabra.length).toBeLessThanOrEqual(80);
  });
});

describe('buscar', () => {
  const respuesta = (status, cuerpo) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => cuerpo,
  });

  it('devuelve los resultados parseados', async () => {
    const fetchFn = vi.fn(async (_url) =>
      respuesta(200, [{ _id: 6964, keywords: [{ keyword: 'casa' }] }]),
    );
    const r = await buscar('casa', { fetchFn });
    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://api.arasaac.org/v1/pictograms/es/bestsearch/casa',
    );
    expect(r).toHaveLength(1);
  });
  it('trata 404 como sin resultados', async () => {
    expect(await buscar('zzzz', { fetchFn: async () => respuesta(404, {}) })).toEqual([]);
  });
  it('lanza error en otros fallos', async () => {
    await expect(buscar('casa', { fetchFn: async () => respuesta(500, {}) })).rejects.toThrow(
      'arasaac_http_500',
    );
  });
  it('no hace ninguna petición con un término vacío', async () => {
    const fetchFn = vi.fn();
    expect(await buscar('  ', { fetchFn })).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('descargarImagen', () => {
  const imagen = (tipo, bytes = 4) => ({
    ok: true,
    status: 200,
    blob: async () => new Blob([new Uint8Array(bytes)], { type: tipo }),
  });

  it('devuelve un data URL base64', async () => {
    const url = await descargarImagen(2317, { fetchFn: async () => imagen('image/png') });
    expect(url).toBe('data:image/png;base64,AAAAAA==');
  });
  it('descarga por defecto la versión de 500 px (se ve nítida en casilleros grandes)', async () => {
    const fetchFn = vi.fn(async (_url) => imagen('image/png'));
    await descargarImagen(2317, { fetchFn });
    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://static.arasaac.org/pictograms/2317/2317_500.png',
    );
  });
  it('rechaza ids inválidos sin hacer peticiones', async () => {
    const fetchFn = vi.fn();
    await expect(descargarImagen(/** @type {any} */ ('1/../2'), { fetchFn })).rejects.toThrow(
      'arasaac_id_invalido',
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('rechaza SVG y otros tipos', async () => {
    await expect(
      descargarImagen(1, { fetchFn: async () => imagen('image/svg+xml') }),
    ).rejects.toThrow('arasaac_tipo_no_permitido');
    await expect(descargarImagen(1, { fetchFn: async () => imagen('text/html') })).rejects.toThrow(
      'arasaac_tipo_no_permitido',
    );
  });
  it('rechaza imágenes demasiado pesadas', async () => {
    await expect(
      descargarImagen(1, { fetchFn: async () => imagen('image/png', MAX_BYTES_IMAGEN + 1) }),
    ).rejects.toThrow('arasaac_imagen_muy_grande');
  });
  it('lanza error si la descarga falla', async () => {
    await expect(
      descargarImagen(1, { fetchFn: async () => ({ ok: false, status: 403 }) }),
    ).rejects.toThrow('arasaac_http_403');
  });
});
