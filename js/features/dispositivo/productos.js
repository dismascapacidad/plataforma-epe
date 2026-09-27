// @ts-check
/**
 * Catálogo de productos dis+capacidad que el núcleo sabe configurar.
 *
 * Solo DATOS y funciones puras (sin DOM): qué entradas físicas tiene cada
 * modelo, cómo se llaman, de qué color son, y cómo se traduce el nombre que
 * informa `WHO` al producto. Extraído de `PRODUCTS` y `WHO_TO_PROD` del
 * configurador, quitando lo que es solo de pantalla (títulos de tarjetas,
 * íconos) y los presets de fábrica, que se extraen con el widget.
 *
 * Los códigos de entrada son siempre BR BA BN BC FU FD FL FR (ver
 * `BTN_CODES` en protocolo.js). Cada modelo usa un subconjunto.
 */

/**
 * @typedef {Object} Entrada
 * @property {string} codigo    BR/BA/BN/BC/FU/FD/FL/FR.
 * @property {string} etiqueta  Nombre para mostrar ("Botón Rojo", "Conector 2").
 * @property {string} color     Color de la entrada en la interfaz (hex).
 * @property {string} [nota]    Aclaración ("también Conector 1").
 */

/**
 * @typedef {Object} Producto
 * @property {string} id
 * @property {string} nombre
 * @property {Entrada[]} botones          Entradas principales.
 * @property {Entrada[]} secundarias      Flechas (disMouse/disJoystick), entradas
 *   externas (disHub mini) o conectores centrales (disHub). Vacío si no hay.
 * @property {boolean} secundariasSoloModoIndividual  `true` si las
 *   secundarias solo se configuran una por una cuando `FMODE` es 0 (flechas
 *   de disMouse/disJoystick); en los demás modelos siempre son entradas
 *   independientes.
 */

const ROJO = '#EF4444';
const AZUL = '#3B82F6';
const NARANJA = '#F97316';
const CELESTE = '#06B6D4';
const AMARILLO = '#EAB308';

/** @returns {Entrada[]} */
function botonesEstandar() {
  return [
    { codigo: 'BR', etiqueta: 'Botón Rojo', color: ROJO },
    { codigo: 'BA', etiqueta: 'Botón Azul', color: AZUL },
    { codigo: 'BN', etiqueta: 'Botón Naranja', color: NARANJA },
    { codigo: 'BC', etiqueta: 'Botón Celeste', color: CELESTE },
  ];
}

/** @returns {Entrada[]} */
function flechas() {
  return [
    { codigo: 'FU', etiqueta: 'Flecha ↑', color: AMARILLO },
    { codigo: 'FD', etiqueta: 'Flecha ↓', color: AMARILLO },
    { codigo: 'FL', etiqueta: 'Flecha ←', color: AMARILLO },
    { codigo: 'FR', etiqueta: 'Flecha →', color: AMARILLO },
  ];
}

/** @type {Record<string, Producto>} */
export const PRODUCTOS = {
  dismouse: {
    id: 'dismouse',
    nombre: 'disMouse',
    botones: botonesEstandar(),
    secundarias: flechas(),
    secundariasSoloModoIndividual: true,
  },
  disjoystick: {
    id: 'disjoystick',
    nombre: 'disJoystick',
    botones: botonesEstandar(),
    secundarias: flechas(),
    secundariasSoloModoIndividual: true,
  },
  disbutton: {
    id: 'disbutton',
    nombre: 'disButton',
    botones: [{ codigo: 'BR', etiqueta: 'disButton', color: ROJO }],
    secundarias: [],
    secundariasSoloModoIndividual: false,
  },
  dishub: {
    id: 'dishub',
    nombre: 'disHub',
    botones: [
      { codigo: 'BR', etiqueta: 'Botón Rojo', nota: 'también Conector 1', color: ROJO },
      { codigo: 'BA', etiqueta: 'Botón Azul', nota: 'también Conector 8', color: AZUL },
      { codigo: 'BN', etiqueta: 'Conector 2', color: NARANJA },
      { codigo: 'BC', etiqueta: 'Conector 7', color: CELESTE },
    ],
    secundarias: [
      { codigo: 'FU', etiqueta: 'Conector 3', color: AMARILLO },
      { codigo: 'FD', etiqueta: 'Conector 4', color: AMARILLO },
      { codigo: 'FL', etiqueta: 'Conector 5', color: AMARILLO },
      { codigo: 'FR', etiqueta: 'Conector 6', color: AMARILLO },
    ],
    secundariasSoloModoIndividual: false,
  },
  dishubmini: {
    id: 'dishubmini',
    nombre: 'disHub mini',
    botones: [
      { codigo: 'BR', etiqueta: 'Botón Rojo', color: ROJO },
      { codigo: 'BA', etiqueta: 'Botón Azul', color: AZUL },
    ],
    secundarias: [
      { codigo: 'FU', etiqueta: 'Externo 1', color: AMARILLO },
      { codigo: 'FD', etiqueta: 'Externo 2', color: AMARILLO },
      { codigo: 'FL', etiqueta: 'Externo 3', color: AMARILLO },
      { codigo: 'FR', etiqueta: 'Externo 4', color: AMARILLO },
    ],
    secundariasSoloModoIndividual: false,
  },
  dishubkeys: {
    id: 'dishubkeys',
    nombre: 'disHub keys',
    botones: [
      { codigo: 'BR', etiqueta: 'Botón Rojo', color: ROJO },
      { codigo: 'BN', etiqueta: 'Botón Naranja', color: NARANJA },
      { codigo: 'BC', etiqueta: 'Botón Celeste', color: CELESTE },
      { codigo: 'BA', etiqueta: 'Botón Azul', color: AZUL },
    ],
    secundarias: [],
    secundariasSoloModoIndividual: false,
  },
};

/**
 * Nombre que informa `WHO` (en minúscula y sin espacios) → id de producto.
 * Es la misma tabla `WHO_TO_PROD` del configurador. Notas:
 *  - `admouse` se trata como disMouse (deuda pendiente: un AdMouse real
 *    puede necesitar su propio perfil).
 *  - `dishubble` es el disHub BLE (`WHO` lo informa como "disHub BLE").
 * @type {Record<string, string>}
 */
const WHO_A_PRODUCTO = {
  dismouse: 'dismouse',
  admouse: 'dismouse',
  disbutton: 'disbutton',
  disbuttonbt: 'disbutton',
  disjoystick: 'disjoystick',
  dishub: 'dishub',
  dishubbt: 'dishub',
  dishubble: 'dishub',
  dishubmini: 'dishubmini',
  dishubkeys: 'dishubkeys',
};

/**
 * Normaliza el modelo informado por `WHO` para buscarlo en la tabla:
 * minúscula y sin espacios ("disHub BLE" → "dishubble").
 * @param {string | null | undefined} modelo
 * @returns {string}
 */
export function normalizarModelo(modelo) {
  return String(modelo ?? '')
    .toLowerCase()
    .replace(/\s/g, '');
}

/**
 * Producto correspondiente al modelo que informa `WHO`, o `null` si no lo
 * conocemos.
 * @param {string | null | undefined} modelo
 * @returns {Producto | null}
 */
export function productoPorModelo(modelo) {
  const id = WHO_A_PRODUCTO[normalizarModelo(modelo)];
  return id ? (PRODUCTOS[id] ?? null) : null;
}

/**
 * Todas las entradas físicas de un producto: principales primero, después
 * las secundarias.
 * @param {Producto} producto
 * @returns {Entrada[]}
 */
export function todasLasEntradas(producto) {
  return [...producto.botones, ...producto.secundarias];
}

/**
 * Entradas que se pueden asignar de forma independiente en este momento.
 * En disMouse/disJoystick las flechas solo son entradas propias si el modo
 * de flechas (`FMODE`) es 0 (individual): en modo cursor o teclas
 * direccionales, las flechas mueven el cursor o emulan ↑↓←→ y no se asignan
 * una por una. Si `fmode` es desconocido (`null`/`undefined`) se asume que
 * NO son asignables, que es lo seguro.
 * @param {Producto} producto
 * @param {number | null | undefined} fmode
 * @returns {Entrada[]}
 */
export function entradasAsignables(producto, fmode) {
  if (producto.secundariasSoloModoIndividual && fmode !== 0) return [...producto.botones];
  return todasLasEntradas(producto);
}
