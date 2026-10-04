import { describe, it, expect } from 'vitest';
import { validarTeclas, urlSegura, MAX_TECLAS } from '../../js/features/configurar-dispositivo/teclas-externas.js';
import * as pendiente from '../../js/features/configurar-dispositivo/pendiente.js';

const flechas = () => [
  { id: 'up', etiqueta: 'Flecha ↑', tecla: 'arrowup' },
  { id: 'down', etiqueta: 'Flecha ↓', tecla: 'arrowdown' },
  { id: 'left', etiqueta: 'Flecha ←', tecla: 'arrowleft' },
  { id: 'right', etiqueta: 'Flecha →', tecla: 'arrowright' },
];

describe('validarTeclas', () => {
  it('acepta las 4 flechas y devuelve objetos nuevos con solo los 3 campos', () => {
    const entrada = flechas().map((t) => ({ ...t, extra: 'x' }));
    const r = validarTeclas(entrada);
    expect(r).toEqual(flechas());
    expect(r[0]).not.toBe(entrada[0]);
  });

  it('acepta letras, dígitos y teclas con nombre', () => {
    const r = validarTeclas([
      { id: 'a', etiqueta: 'A', tecla: 'a' },
      { id: 'n1', etiqueta: 'Uno', tecla: '1' },
      { id: 'esp', etiqueta: 'Espacio', tecla: ' ' },
      { id: 'esc', etiqueta: 'Escape', tecla: 'escape' },
    ]);
    expect(r).toHaveLength(4);
  });

  it('rechaza lo que no es una lista, o está vacía o pasa del máximo', () => {
    expect(validarTeclas(null)).toBeNull();
    expect(validarTeclas({})).toBeNull();
    expect(validarTeclas('arrowup')).toBeNull();
    expect(validarTeclas([])).toBeNull();
    const muchas = Array.from({ length: MAX_TECLAS + 1 }, (_, i) => ({
      id: `t${i}`,
      etiqueta: `T${i}`,
      tecla: 'a',
    }));
    expect(validarTeclas(muchas)).toBeNull();
  });

  it('rechaza TODA la lista si una entrada es inválida', () => {
    const l = flechas();
    l[2].tecla = 'ArrowLeft'; // mayúsculas: no es el formato esperado
    expect(validarTeclas(l)).toBeNull();
    const m = flechas();
    m[1].tecla = 'f13';
    expect(validarTeclas(m)).toBeNull();
    const n = flechas();
    n[0].etiqueta = '   ';
    expect(validarTeclas(n)).toBeNull();
    const o = flechas();
    o[0].etiqueta = 'x'.repeat(41);
    expect(validarTeclas(o)).toBeNull();
  });

  it('rechaza ids repetidos, con caracteres raros o que no son texto', () => {
    const rep = flechas();
    rep[1].id = 'up';
    expect(validarTeclas(rep)).toBeNull();
    const raro = flechas();
    raro[0].id = 'up<script>';
    expect(validarTeclas(raro)).toBeNull();
    const num = flechas();
    num[0].id = 5;
    expect(validarTeclas(num)).toBeNull();
    expect(validarTeclas([null])).toBeNull();
    expect(validarTeclas(['arrowup'])).toBeNull();
  });
});

describe('urlSegura', () => {
  it('acepta https y devuelve la URL normalizada', () => {
    expect(urlSegura('https://apps.makeymakey.com/play/#counter')).toBe(
      'https://apps.makeymakey.com/play/#counter',
    );
  });

  it('rechaza todo lo que no sea https', () => {
    expect(urlSegura('http://apps.makeymakey.com/')).toBeNull();
    expect(urlSegura('javascript:alert(1)')).toBeNull();
    expect(urlSegura('data:text/html,<b>x</b>')).toBeNull();
    expect(urlSegura('//apps.makeymakey.com/')).toBeNull();
    expect(urlSegura('apps.makeymakey.com')).toBeNull();
    expect(urlSegura('')).toBeNull();
    expect(urlSegura(null)).toBeNull();
    expect(urlSegura(undefined)).toBeNull();
    expect(urlSegura(42)).toBeNull();
    expect(urlSegura('https://' + 'a'.repeat(2000))).toBeNull();
  });
});

/** Un localStorage mínimo en memoria. */
function almacenFalso() {
  const datos = new Map();
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => void datos.set(k, String(v)),
    removeItem: (k) => void datos.delete(k),
    _datos: datos,
  };
}

const ejemplo = () => ({
  nombre: 'COUNTER (Makey Makey Apps)',
  url: 'https://apps.makeymakey.com/play/#counter',
  snapshotTexto: '{"formato":1,"cfg":{"btns":{}}}',
  creadoEn: '2026-10-04T12:00:00.000Z',
});

describe('pendiente (restauración guardada)', () => {
  it('guarda, lee y borra', () => {
    const a = almacenFalso();
    expect(pendiente.leer(a)).toBeNull();
    expect(pendiente.guardar(a, ejemplo())).toBe(true);
    expect(pendiente.leer(a)).toEqual(ejemplo());
    pendiente.borrar(a);
    expect(pendiente.leer(a)).toBeNull();
  });

  it('sin almacenamiento no falla: simplemente no persiste', () => {
    expect(pendiente.guardar(null, ejemplo())).toBe(false);
    expect(pendiente.leer(null)).toBeNull();
    expect(() => pendiente.borrar(null)).not.toThrow();
  });

  it('si el almacenamiento tira error (cuota, bloqueado), no propaga', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('cuota');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(pendiente.guardar(roto, ejemplo())).toBe(false);
    expect(pendiente.leer(roto)).toBeNull();
    expect(() => pendiente.borrar(roto)).not.toThrow();
  });

  it('ignora contenido corrupto o con forma inesperada', () => {
    const a = almacenFalso();
    a.setItem(pendiente.CLAVE, 'esto no es json');
    expect(pendiente.leer(a)).toBeNull();
    a.setItem(pendiente.CLAVE, '[]');
    expect(pendiente.leer(a)).toBeNull();
    a.setItem(pendiente.CLAVE, JSON.stringify({ nombre: 5, snapshotTexto: 'x', creadoEn: 'y' }));
    expect(pendiente.leer(a)).toBeNull();
    a.setItem(
      pendiente.CLAVE,
      JSON.stringify({ ...ejemplo(), snapshotTexto: 'x'.repeat(200_001) }),
    );
    expect(pendiente.leer(a)).toBeNull();
  });

  it('una url que no es texto se lee como null (no rompe)', () => {
    const a = almacenFalso();
    a.setItem(pendiente.CLAVE, JSON.stringify({ ...ejemplo(), url: 7 }));
    expect(pendiente.leer(a).url).toBeNull();
  });
});
