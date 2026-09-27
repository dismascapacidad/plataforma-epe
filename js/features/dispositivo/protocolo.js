// @ts-check
/**
 * Capa de protocolo serie del configurador dis+ / EpE.
 *
 * Módulo PURO: sin DOM, sin variables globales, sin I/O. Solo construye y parsea
 * las cadenas de texto que se intercambian con el firmware (Arduino Pro Micro /
 * nRF52840) por USB (Web Serial) o BLE (Nordic UART).
 *
 * Extraído 1:1 de `index.html` (Fase 1 del plan de deuda técnica). No cambia el
 * comportamiento actual — los "quirks" conocidos se preservan y se marcan con
 * `QUIRK:` para resolverlos más adelante con su propio test.
 *
 * Referencia de comandos: ver CONTEXTO_app_configurador.md §7.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Códigos de botón / conector
// ─────────────────────────────────────────────────────────────────────────────

/** Orden canónico de botones. El índice (0..7) es el que usa el firmware en `BTN:`. */
export const BTN_CODES = /** @type {const} */ (['BR', 'BA', 'BN', 'BC', 'FU', 'FD', 'FL', 'FR']);

/** @type {Record<string, number>} code → índice */
export const CODE_TO_IDX = { BR: 0, BA: 1, BN: 2, BC: 3, FU: 4, FD: 5, FL: 6, FR: 7 };

/** @type {Record<number, string>} índice → code */
export const IDX_TO_CODE = {
  0: 'BR',
  1: 'BA',
  2: 'BN',
  3: 'BC',
  4: 'FU',
  5: 'FD',
  6: 'FL',
  7: 'FR',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tabla de keycodes (firmware R009+) y su inversa (incluye tabla legacy)
// ─────────────────────────────────────────────────────────────────────────────

/** token de tecla especial → valor que espera el firmware (R009+). */
const KEY_TO_WIRE = {
  SPACE: ' ',
  ENTER: '215',
  TAB: '214',
  ESC: '216',
  BACKSPACE: '213',
  DELETE: '218',
  INSERT: '217',
  HOME: '221',
  END: '222',
  PAGE_UP: '219',
  PAGE_DOWN: '220',
  UP_ARROW: '209',
  DOWN_ARROW: '210',
  LEFT_ARROW: '211',
  RIGHT_ARROW: '212',
  F1: '193',
  F2: '194',
  F3: '195',
  F4: '196',
  F5: '197',
  F6: '198',
  F7: '199',
  F8: '200',
  F9: '201',
  F10: '202',
  F11: '203',
  F12: '204',
};

/**
 * Convierte un token (`'ENTER'`, `'F5'`, `'SPACE'`…) o un carácter suelto al valor
 * que viaja en el comando `CFG:`. Los caracteres y dígitos van en minúscula.
 * Equivalente a `cvKey()` de `index.html`.
 * @param {string} token
 * @returns {string}
 */
export function cvKey(token) {
  return KEY_TO_WIRE[token.toUpperCase()] ?? token.toLowerCase();
}

/**
 * Inversa de la tabla de keycodes: valor de wire (string) → token legible.
 * Incluye la tabla **legacy** (firmware anterior a R009) para poder leer
 * configuraciones viejas; en caso de colisión gana el código actual.
 * Equivalente a `REV_KEY` de `index.html`.
 * @type {Record<string, string>}
 */
export const REV_KEY = (() => {
  const fwd = {
    SPACE: ' ',
    ENTER: '215',
    TAB: '214',
    ESC: '216',
    BACKSPACE: '213',
    DELETE: '218',
    INSERT: '217',
    HOME: '221',
    END: '222',
    PAGE_UP: '219',
    PAGE_DOWN: '220',
    UP_ARROW: '209',
    DOWN_ARROW: '210',
    LEFT_ARROW: '211',
    RIGHT_ARROW: '212',
    F1: '193',
    F2: '194',
    F3: '195',
    F4: '196',
    F5: '197',
    F6: '198',
    F7: '199',
    F8: '200',
    F9: '201',
    F10: '202',
    F11: '203',
    F12: '204',
  };
  /** @type {Record<string, string>} */
  const rev = {};
  for (const [name, code] of Object.entries(fwd)) rev[String(code)] = name;
  rev['32'] = 'SPACE'; // ASCII espacio
  const legacy = {
    ENTER: '176',
    TAB: '179',
    ESC: '177',
    BACKSPACE: '178',
    DELETE: '212',
    INSERT: '209',
    HOME: '210',
    END: '213',
    PAGE_UP: '211',
    PAGE_DOWN: '214',
    UP_ARROW: '218',
    DOWN_ARROW: '217',
    LEFT_ARROW: '216',
    RIGHT_ARROW: '215',
    F1: '194',
    F2: '195',
    F3: '196',
    F4: '197',
    F5: '198',
    F6: '199',
    F7: '200',
    F8: '201',
    F9: '202',
    F10: '203',
    F11: '204',
    F12: '205',
  };
  for (const [name, code] of Object.entries(legacy)) {
    if (!rev[String(code)]) rev[String(code)] = name; // no pisar los actuales
  }
  return rev;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Modificador principal según sistema operativo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Letra del modificador principal: `'G'` (GUI/⌘) en Mac, `'C'` (Ctrl) en Windows.
 * @param {'mac'|'win'|string} osMode
 * @returns {'G'|'C'}
 */
export function primaryMod(osMode) {
  return osMode === 'mac' ? 'G' : 'C';
}

/**
 * Sustituye el placeholder `%P%` de los presets de fábrica por el modificador
 * principal. Equivale a lo que hace `applyPreset()` antes de enviar cada comando.
 * @param {string[]} cmds
 * @param {'mac'|'win'|string} osMode
 * @returns {string[]}
 */
export function resolvePreset(cmds, osMode) {
  const p = primaryMod(osMode);
  return cmds.map((c) => (c.includes('%P%') ? c.replace('%P%', p) : c));
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción de comandos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ButtonSpec
 * @property {string}  code        Código de botón: BR/BA/BN/BC/FU/FD/FL/FR.
 * @property {'K'|'M'|'X'} tipo    Teclado / Mouse / Desactivado.
 * @property {'P'|'R'|'H'|'O'} [modo='P']  Al presionar / al soltar / larga / una vez.
 * @property {number|string} [debounce=0] Milisegundos.
 * @property {'1'|'1D'|'1M'|'2'|'4'|'SU'|'SD'} [mouseAction='1'] Solo tipo 'M'.
 * @property {string}  [key='']    Solo tipo 'K'. Token o carácter; '' = solo modificadores.
 * @property {boolean} [ctrl]      Solo tipo 'K'.
 * @property {boolean} [shift]     Solo tipo 'K'.
 * @property {boolean} [alt]       Solo tipo 'K'.
 * @property {boolean} [gui]       Solo tipo 'K'.
 */

/**
 * Construye una línea `CFG:...` para un botón. Equivale a `applyBtn()` de
 * `index.html` pero sin leer el DOM.
 *
 *   `CFG:<code>:<tipo>:<modo>:<debounce>:<accion>:<mods>:<flags>`
 *
 * @param {ButtonSpec} spec
 * @returns {string}
 */
export function buildButtonCfg(spec) {
  const { code, tipo } = spec;
  const modo = spec.modo ?? 'P';
  const debounce = spec.debounce ?? 0;

  let accion;
  let mods = '-';
  let flags = '-';

  if (tipo === 'X') {
    accion = '0';
  } else if (tipo === 'M') {
    const sel = spec.mouseAction || '1';
    if (sel === '1D') {
      accion = '1';
      flags = 'D';
    } else if (sel === '1M') {
      accion = '1';
      flags = 'M';
    } else if (sel === 'SU') {
      accion = 'SU';
    } else if (sel === 'SD') {
      accion = 'SD';
    } else {
      accion = sel;
    }
  } else {
    // tipo 'K'
    const raw = (spec.key || '').trim();
    accion = raw ? cvKey(raw) : '0';
    mods =
      (spec.ctrl ? 'C' : '') +
        (spec.shift ? 'S' : '') +
        (spec.alt ? 'A' : '') +
        (spec.gui ? 'G' : '') || '-';
  }

  return `CFG:${code}:${tipo}:${modo}:${debounce}:${accion}:${mods}:${flags}`;
}

/**
 * @typedef {Object} ArrowSpec
 * @property {number|string} fmode   0 individual · 1 cursor · 2 teclas ↑↓←→.
 * @property {number|string} [orient] 0..3.
 * @property {number|string} [vel]    1..50 (solo fmode 0/1).
 * @property {boolean}       [acel]   (solo fmode 0/1).
 */

/**
 * Construye la secuencia de comandos de la sección "flechas" / "conectores
 * centrales". Equivale a `applyArrows()` / `applyDishubCenter()`.
 * @param {ArrowSpec} spec
 * @returns {string[]}
 */
export function buildArrowCommands(spec) {
  const m = parseInt(String(spec.fmode), 10);
  const cmds = [`FMODE:${m}`, `ORIENT:${spec.orient}`];
  if (m === 0 || m === 1) {
    cmds.push(`VEL:${spec.vel}`);
    cmds.push(`ACEL:${spec.acel ? '1' : '0'}`);
  }
  return cmds;
}

/**
 * Convierte un `DeviceCfg` (config leída del dispositivo o guardada como preset)
 * en la secuencia de comandos para reaplicarla. Equivale al cuerpo de
 * `applyCustom()`.
 *
 * QUIRK: cuando no hay modificadores ni flags el separador queda como `'- '`
 * (con espacio final), distinto de `buildButtonCfg` que usa `'-'`. Se preserva
 * el comportamiento actual; ver `tests/protocol.test.js` → "QUIRK".
 *
 * @param {DeviceCfg} cfg
 * @returns {string[]}
 */
export function cfgToCommands(cfg) {
  const TL = { 0: 'M', 1: 'K', 2: 'X' };
  // Se agrega 3 → 'O' (una vez por pulsación): el `GETALL` lo informa como 3 y sin esta
  // entrada un botón en ese modo se restauraba como 'P' (cambio silencioso al volver atrás).
  const ML = { 0: 'P', 1: 'R', 2: 'H', 3: 'O' };
  /** @type {string[]} */
  const cmds = [];

  for (const [idx, c] of Object.entries(cfg.btns || {})) {
    const code = IDX_TO_CODE[parseInt(idx, 10)];
    if (!code) continue;

    let ac = String(c.accion);
    if (c.accion === 8) ac = 'SU';
    else if (c.accion === 16) ac = 'SD';
    else if (c.tipo === 1 && c.accion > 0 && c.accion < 128) ac = String.fromCharCode(c.accion);

    const mm = [];
    if (c.mods & 0x01) mm.push('C');
    if (c.mods & 0x02) mm.push('S');
    if (c.mods & 0x04) mm.push('A');
    if (c.mods & 0x08) mm.push('G');

    const fl = [];
    if (c.flags & 0x01) fl.push('D');
    if (c.flags & 0x02) fl.push('M');

    cmds.push(
      `CFG:${code}:${TL[c.tipo] || 'X'}:${ML[c.modo] || 'P'}:${c.debounce}:${ac}:` +
        `${mm.join('') || '- '}:${fl.join('') || '- '}`, // QUIRK: '- ' con espacio
    );
  }

  if (cfg.fmode != null) cmds.push(`FMODE:${cfg.fmode}`);
  if (cfg.orient != null) cmds.push(`ORIENT:${cfg.orient}`);
  if (cfg.vel != null) cmds.push(`VEL:${cfg.vel}`);
  if (cfg.acel != null) cmds.push(`ACEL:${cfg.acel}`);

  return cmds;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parseo de las respuestas del dispositivo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ButtonCfg
 * @property {number} tipo      0 mouse · 1 teclado · 2 desactivado.
 * @property {number} modo      0 press · 1 release · 2 hold · 3 once.
 * @property {number} debounce  ms.
 * @property {number} accion    keycode / char code / acción de mouse.
 * @property {number} mods      bitmask: 1 Ctrl · 2 Shift · 4 Alt · 8 GUI.
 * @property {number} flags     bitmask: 1 doble · 2 toggle/mantener.
 */

/**
 * @typedef {Object} DeviceCfg
 * @property {number|null} [orient]
 * @property {number|null} [vel]
 * @property {number|null} [acel]
 * @property {number|null} [fmode]
 * @property {Record<string, ButtonCfg>} btns  clave = índice de botón "0".."7".
 */

/**
 * Config vacía. Equivale a `mkCfg()` de `index.html`.
 * @returns {DeviceCfg}
 */
export function emptyCfg() {
  return { orient: null, vel: null, acel: null, fmode: null, btns: {} };
}

/**
 * Si la línea es una respuesta `OK:WHO:<modelo>:<version>`, devuelve
 * `{ model, version }`. Si no, `null`.
 * @param {string} line
 * @returns {{ model: string, version: string } | null}
 */
export function parseWho(line) {
  if (!line.startsWith('OK:WHO:')) return null;
  const p = line.split(':'); // ['OK','WHO','disMouse','R019']
  return { model: p[2], version: p[3] };
}

/**
 * Vuelca una línea de respuesta de `GETALL` (`ORIENT:`, `VEL:`, `ACEL:`,
 * `FMODE:`, `BTN:`) dentro de `cfg`, mutándolo. Ignora `OK:WHO:` (eso lo maneja
 * `parseWho`) y cualquier línea desconocida. Equivale a `parseLine()` de
 * `index.html` sin el efecto colateral sobre la promesa de WHO.
 * @param {string} line
 * @param {DeviceCfg} cfg
 * @returns {DeviceCfg} el mismo `cfg`, por conveniencia.
 */
export function parseDeviceLine(line, cfg) {
  if (line.startsWith('OK:WHO:')) {
    // no-op acá — ver parseWho()
  } else if (line.startsWith('ORIENT:')) {
    cfg.orient = parseInt(line.slice(7), 10);
  } else if (line.startsWith('VEL:')) {
    cfg.vel = parseInt(line.slice(4), 10);
  } else if (line.startsWith('ACEL:')) {
    cfg.acel = parseInt(line.slice(5), 10);
  } else if (line.startsWith('FMODE:')) {
    cfg.fmode = parseInt(line.slice(6), 10);
  } else if (line.startsWith('BTN:')) {
    const p = line.split(':');
    cfg.btns[p[1]] = {
      tipo: +p[2],
      modo: +p[3],
      debounce: +p[4],
      accion: +p[5],
      mods: +p[6],
      flags: +p[7],
    };
  }
  return cfg;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación de comandos de configuración
// ─────────────────────────────────────────────────────────────────────────────

const RE_CFG = /^CFG:(BR|BA|BN|BC|FU|FD|FL|FR):[KMX]:[PRHO]:\d{1,4}:[^:]+:[^:]+:[^:]+$/;
const RE_FMODE = /^FMODE:[0-2]$/;
const RE_ORIENT = /^ORIENT:[0-3]$/;
const RE_VEL = /^VEL:(\d{1,2})$/;
const RE_ACEL = /^ACEL:[01]$/;

/**
 * ¿Es una línea de configuración que el núcleo acepta enviar con `aplicar()`?
 * Lista blanca estricta: `CFG:`, `FMODE:`, `ORIENT:`, `VEL:` y `ACEL:` bien
 * formados. Deja afuera a propósito `SAVE`, `RESET`, `WHO`, `GETALL` y
 * cualquier comando crudo: esos tienen su propio método explícito (o no se
 * mandan), para que un preset mal armado no pueda restablecer el dispositivo.
 * @param {string} linea
 * @returns {boolean}
 */
export function esComandoDeConfiguracion(linea) {
  if (typeof linea !== 'string') return false;
  if (RE_CFG.test(linea)) {
    const debounce = parseInt(linea.split(':')[4], 10);
    return debounce <= 5000;
  }
  if (RE_FMODE.test(linea) || RE_ORIENT.test(linea) || RE_ACEL.test(linea)) return true;
  const v = RE_VEL.exec(linea);
  if (v) {
    const n = parseInt(v[1], 10);
    return n >= 1 && n <= 50;
  }
  return false;
}
