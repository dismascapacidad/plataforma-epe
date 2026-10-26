// @ts-nocheck - usa módulos de Node (fs, path, assert), que el typecheck del navegador no incluye.
/**
 * Carga los módulos de lógica de "Aprendo con dinero". Son scripts universales (UMD) que la
 * página usa como clásicos: acá se ejecutan como CommonJS, sin pasar por el navegador.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CARPETA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../js/features/apps-epe/dinero',
);
const cache = new Map();

/**
 * @param {string} nombre archivo dentro de js/features/apps-epe/dinero (p. ej. "logica.js")
 * @returns {any}
 */
export function cargar(nombre) {
  const archivo = path.basename(nombre);
  if (cache.has(archivo)) return cache.get(archivo);
  const codigo = readFileSync(path.join(CARPETA, archivo), 'utf8');
  const modulo = { exports: {} };
  new Function('module', 'exports', 'require', codigo)(modulo, modulo.exports, cargar);
  cache.set(archivo, modulo.exports);
  return modulo.exports;
}

/**
 * Los textos se registran en EpeI18n al cargarse: se intercepta ese registro.
 * @returns {any} el diccionario (moneda y textos) de es-AR
 */
export function cargarTextos() {
  let diccionario = null;
  const registrar = (/** @type {string} */ _codigo, /** @type {any} */ d) => {
    diccionario = d;
  };
  new Function('EpeI18n', readFileSync(path.join(CARPETA, 'textos-es-ar.js'), 'utf8'))({
    registrar,
    usar: () => {},
  });
  return diccionario;
}
