// @ts-nocheck
// Script clásico (namespace Epe*): se carga leyendo el archivo y evaluándolo.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const EpeCatalogoMateriales = new Function(
  `${readFileSync('js/data/catalogo-materiales.js', 'utf8')}\nreturn EpeCatalogoMateriales;`
)();

describe('catálogo de material de consulta', () => {
  it('tiene ids únicos y estables (los guardan las colecciones)', async () => {
    const todos = await EpeCatalogoMateriales.getAll();
    const ids = todos.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]{1,80}$/));
  });

  it('cada material publicado tiene archivo válido y módulo existente', async () => {
    const [todos, modulos] = await Promise.all([
      EpeCatalogoMateriales.getAll(),
      EpeCatalogoMateriales.getModulos(),
    ]);
    const idsModulo = modulos.map((m) => m.id);
    todos
      .filter((m) => !m.ejemplo)
      .forEach((m) => {
        expect(EpeCatalogoMateriales.urlsDe(m), m.id).not.toBeNull();
        expect(['publico', 'logueado']).toContain(m.acceso);
        if (m.modulo) expect(idsModulo, m.id).toContain(m.modulo);
      });
  });

  it('las capturas, si hay, están en assets/img/materiales/', async () => {
    const todos = await EpeCatalogoMateriales.getAll();
    todos.filter((m) => m.imagen).forEach((m) => {
      expect(EpeCatalogoMateriales.rutaImagen(m), m.id).toBe(m.imagen);
    });
  });
});

describe('rutaImagen', () => {
  it('acepta solo archivos de assets/img/materiales/', () => {
    const ok = { imagen: 'assets/img/materiales/ta-epe-b1-introduccion.webp' };
    expect(EpeCatalogoMateriales.rutaImagen(ok)).toBe(ok.imagen);
    expect(EpeCatalogoMateriales.rutaImagen({ imagen: 'https://evil.com/x.png' })).toBeNull();
    expect(EpeCatalogoMateriales.rutaImagen({ imagen: 'assets/img/materiales/../../x.png' })).toBeNull();
    expect(EpeCatalogoMateriales.rutaImagen({ imagen: 'assets/img/materiales/x.svg' })).toBeNull();
    expect(EpeCatalogoMateriales.rutaImagen({})).toBeNull();
    expect(EpeCatalogoMateriales.rutaImagen(null)).toBeNull();
  });
});

describe('agruparPorModulo', () => {
  it('sigue el orden de los módulos y deja lo suelto al final', async () => {
    const modulos = await EpeCatalogoMateriales.getModulos();
    const lista = [
      { id: 'c', modulo: modulos[1].id },
      { id: 'suelto' },
      { id: 'a', modulo: modulos[0].id },
      { id: 'd', modulo: 'no-existe' },
      { id: 'b', modulo: modulos[0].id },
    ];
    const grupos = EpeCatalogoMateriales.agruparPorModulo(lista);
    expect(grupos.map((g) => g.modulo && g.modulo.id)).toEqual([modulos[0].id, modulos[1].id, null]);
    expect(grupos[0].materiales.map((m) => m.id)).toEqual(['a', 'b']);
    expect(grupos[2].materiales.map((m) => m.id)).toEqual(['suelto', 'd']);
  });

  it('no devuelve grupos vacíos', () => {
    expect(EpeCatalogoMateriales.agruparPorModulo([])).toEqual([]);
  });
});
