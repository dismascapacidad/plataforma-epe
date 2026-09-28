// @ts-check
/**
 * Capa de protocolo serie del configurador dis+ / EpE.
 *
 * Módulo PURO: sin DOM, sin variables globales, sin I/O. Solo construye y parsea
 * las cadenas de texto que se intercambian con el firmware (Arduino Pro Micro /
 * nRF52840) por USB (Web Serial) o BLE (Nordic UART).
 *
 * Portado 1:1 de `src/protocol.js` del repo `configurador-dis-epe` (estado en
 * `main` tras el merge del modo Tap-Hold, ver `protocolo-configurador-dis-epe.md`
 * — es la fuente de verdad; ante cualquier duda de comportamiento, mirar ahí o
 * el `tests/protocol.test.js` de ese repo antes de suponer nada). Lo único que
 * agrega este archivo respecto del original es `esComandoDeConfiguracion()`,
 * la lista blanca que usa `Conexion.aplicar()` — no existe upstream porque el
 * configurador clásico no tiene ese concepto de "solo mandar lo permitido".
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
// Tap-Hold: constantes y detección de soporte
// ─────────────────────────────────────────────────────────────────────────────

/** Umbral por defecto del firmware (ms) y rango útil. */
export const TH_DEFAULT_MS = 1000;
export const TH_MIN_MS = 100;
export const TH_MAX_MS = 5000;

/**
 * ¿La versión de firmware (de `OK:WHO:<modelo>:<version>`) soporta Tap-Hold?
 * Los firmwares que lo soportan terminan en `-TH<n>` (ej. `R013-TH1`,
 * `R019-TH1`). Es la MISMA regla que usa el configurador publicado — no
 * inventar otra.
 * @param {string|null|undefined} version
 * @returns {boolean}
 */
export function supportsTapHold(version) {
  return /-TH\d+$/.test(version || '');
}

/**
 * Normaliza el umbral tipeado: vacío / inválido / 0 → 0 (default del firmware,
 * 1000 ms); si no, se acota a 100..5000.
 * @param {number|string|undefined|null} v
 * @returns {number}
 */
export function normalizeThreshold(v) {
  const n = parseInt(String(v ?? '').trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(TH_MAX_MS, Math.max(TH_MIN_MS, n));
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción de comandos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acción larga de Tap-Hold. Comparte el `tipo` (M/K) de la acción corta.
 * @typedef {Object} LongSpec
 * @property {'1'|'2'|'4'|'SU'|'SD'} [mouseAction='1'] Solo tipo 'M'.
 * @property {boolean} [mantener]  Mantener clic (solo tipo 'M', no con scroll).
 * @property {string}  [key='']    Solo tipo 'K'.
 * @property {boolean} [ctrl]
 * @property {boolean} [shift]
 * @property {boolean} [alt]
 * @property {boolean} [gui]
 */

/**
 * @typedef {Object} ButtonSpec
 * @property {string}  code        Código de botón: BR/BA/BN/BC/FU/FD/FL/FR.
 * @property {'K'|'M'|'X'} tipo    Teclado / Mouse / Desactivado.
 * @property {'P'|'R'|'O'|'T'} [modo='P']  Al presionar / al soltar / una vez / Tap-Hold
 *   (solo firmware `-TH`). El modo `'H'` (holdeable, heredado) está retirado: el
 *   firmware nuevo responde `ERR:MODE` si se manda, así que nunca se envía (se
 *   degrada a `'P'`).
 * @property {number|string} [debounce=0] Milisegundos.
 * @property {'1'|'1D'|'1M'|'2'|'4'|'SU'|'SD'} [mouseAction='1'] Solo tipo 'M'.
 * @property {string}  [key='']    Solo tipo 'K'. Token o carácter; '' = solo modificadores.
 * @property {boolean} [ctrl]      Solo tipo 'K'.
 * @property {boolean} [shift]     Solo tipo 'K'.
 * @property {boolean} [alt]       Solo tipo 'K'.
 * @property {boolean} [gui]       Solo tipo 'K'.
 * @property {LongSpec} [largo]    Acción larga. Solo se usa con modo 'T'.
 * @property {number|string} [umbral] Umbral de pulsación larga en ms. Solo modo 'T'.
 *   Vacío / 0 = default del firmware (1000). Se acota a 100..5000.
 */

/**
 * Construye una línea `CFG:...` para un botón. Equivale a `applyBtn()` de
 * `index.html` pero sin leer el DOM.
 *
 *   `CFG:<code>:<tipo>:<modo>:<debounce>:<accion>:<mods>:<flags>`
 *   modo 'T' (solo firmware -TH) agrega 4 campos:
 *   `...:<accionLarga>:<modsLarga>:<flagsLarga>:<umbralMs>`
 *
 * @param {ButtonSpec} spec
 * @returns {string}
 */
export function buildButtonCfg(spec) {
  const { code, tipo } = spec;
  /** @type {string} */
  let modo = spec.modo ?? 'P';
  if (modo === 'H') modo = 'P'; // retirado: el firmware nuevo responde ERR:MODE
  if (modo === 'T' && tipo === 'X') modo = 'P'; // un botón desactivado no tiene acción larga
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
      flags = modo === 'T' ? '-' : 'M'; // en Tap-Hold el tap es instantáneo
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

  const base = `CFG:${code}:${tipo}:${modo}:${debounce}:${accion}:${mods}:${flags}`;
  if (modo !== 'T') return base;

  const lg = spec.largo || {};
  let accionL;
  let modsL = '0';
  let flagsL = '0';
  if (tipo === 'M') {
    accionL = lg.mouseAction || '1';
    if (lg.mantener && accionL !== 'SU' && accionL !== 'SD') flagsL = 'M';
  } else {
    const raw = (lg.key || '').trim();
    accionL = raw ? cvKey(raw) : '0';
    modsL =
      (lg.ctrl ? 'C' : '') + (lg.shift ? 'S' : '') + (lg.alt ? 'A' : '') + (lg.gui ? 'G' : '') ||
      '0';
  }
  return `${base}:${accionL}:${modsL}:${flagsL}:${normalizeThreshold(spec.umbral)}`;
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
 * Convierte una config (leída del dispositivo, o guardada como preset — donde
 * los campos globales pueden faltar) en la secuencia de comandos para
 * reaplicarla. Equivale al cuerpo de `applyCustom()`.
 *
 * QUIRK: cuando no hay modificadores ni flags el separador queda como `'- '`
 * (con espacio final), distinto de `buildButtonCfg` que usa `'-'`. Se preserva
 * el comportamiento actual del configurador publicado; ver
 * `tests/protocolo.test.js` → "QUIRK".
 *
 * @param {StoredCfg} cfg
 * @param {{ tapHold?: boolean }} [opts] `tapHold`: el firmware conectado soporta modo 'T'.
 *   Sin esto (o en `false`) un botón leído en modo Tap-Hold (4) se degrada a
 *   `'P'` con solo la acción corta — nunca se manda `T` a un firmware que no
 *   demostró soportarlo.
 * @returns {string[]}
 */
export function cfgToCommands(cfg, opts = {}) {
  const TL = { 0: 'M', 1: 'K', 2: 'X' };
  // 2 (holdeable heredado) se degrada a 'P', igual que el firmware nuevo. 4 (Tap-Hold)
  // solo se emite si el firmware lo soporta; si no, queda como 'P' con la acción corta.
  const ML = { 0: 'P', 1: 'R', 2: 'P', 3: 'O', 4: opts.tapHold ? 'T' : 'P' };
  /** @type {string[]} */
  const cmds = [];

  /** Acción como viaja en `CFG:` (mouse: SU/SD/dígito; teclado: carácter o código). */
  const wireAction = (/** @type {number} */ tipo, /** @type {number} */ accion) => {
    if (accion === 8) return 'SU';
    if (accion === 16) return 'SD';
    if (tipo === 1 && accion > 0 && accion < 128) return String.fromCharCode(accion);
    return String(accion);
  };

  for (const [idx, c] of Object.entries(cfg.btns || {})) {
    const code = IDX_TO_CODE[parseInt(idx, 10)];
    if (!code) continue;

    const ac = wireAction(c.tipo, c.accion);

    const mm = [];
    if (c.mods & 0x01) mm.push('C');
    if (c.mods & 0x02) mm.push('S');
    if (c.mods & 0x04) mm.push('A');
    if (c.mods & 0x08) mm.push('G');

    const fl = [];
    if (c.flags & 0x01) fl.push('D');
    if (c.flags & 0x02) fl.push('M');

    const modo = ML[c.modo] || 'P';
    let line =
      `CFG:${code}:${TL[c.tipo] || 'X'}:${modo}:${c.debounce}:${ac}:` +
      `${mm.join('') || '- '}:${fl.join('') || '- '}`; // QUIRK: '- ' con espacio
    if (modo === 'T') {
      const ml = [];
      const modsL = c.modsLarga || 0;
      if (modsL & 0x01) ml.push('C');
      if (modsL & 0x02) ml.push('S');
      if (modsL & 0x04) ml.push('A');
      if (modsL & 0x08) ml.push('G');
      const flagsL = (c.flagsLarga || 0) & 0x02 ? 'M' : '0';
      line += `:${wireAction(c.tipo, c.accionLarga || 0)}:${ml.join('') || '0'}:${flagsL}:${c.umbral || 0}`;
    }
    cmds.push(line);
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
 * @property {number} modo      0 press · 1 release · 3 once · 4 Tap-Hold. (2 = holdeable
 *   heredado del protocolo viejo: el parser lo degrada a 0, nunca llega así hasta acá.)
 * @property {number} debounce  ms.
 * @property {number} accion    keycode / char code / acción de mouse.
 * @property {number} mods      bitmask: 1 Ctrl · 2 Shift · 4 Alt · 8 GUI.
 * @property {number} flags     bitmask: 1 doble · 2 toggle/mantener.
 * @property {number} [accionLarga] Solo firmware -TH (línea BTN de 11 campos).
 * @property {number} [modsLarga]   Idem.
 * @property {number} [flagsLarga]  Idem: 2 = mantener clic.
 * @property {number} [umbral]      Idem: ms; 0 = default (1000).
 */

/**
 * Config completa, tal como la produce `emptyCfg()` / `parseDeviceLine()`.
 * @typedef {Object} DeviceCfg
 * @property {number|null} [orient]
 * @property {number|null} [vel]
 * @property {number|null} [acel]
 * @property {number|null} [fmode]
 * @property {Record<string, ButtonCfg>} btns  clave = índice de botón "0".."7".
 */

/**
 * Config posiblemente parcial (un preset guardado puede no tener los campos
 * globales). Es lo que consume `cfgToCommands()`. Un `DeviceCfg` es un
 * `StoredCfg` válido.
 * @typedef {Object} StoredCfg
 * @property {Record<string, ButtonCfg>} btns
 * @property {number|null} [fmode]
 * @property {number|null} [orient]
 * @property {number|null} [vel]
 * @property {number|null} [acel]
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
 * ¿Es una línea `BTN:` de 11 campos (firmware con Tap-Hold)?
 * Los "7 campos" del formato viejo no cuentan el literal `BTN`.
 * @param {string} line
 * @returns {boolean}
 */
export function isExtendedBtnLine(line) {
  return line.startsWith('BTN:') && line.split(':').length >= 12;
}

/**
 * Vuelca una línea de respuesta de `GETALL` (`ORIENT:`, `VEL:`, `ACEL:`,
 * `FMODE:`, `BTN:`) dentro de `cfg`, mutándolo. Ignora `OK:WHO:` (eso lo maneja
 * `parseWho`) y cualquier línea desconocida. Equivale a `parseLine()` de
 * `index.html` sin el efecto colateral sobre la promesa de WHO.
 *
 * Las líneas `BTN:` tienen 7 campos (firmware viejo) u 11 (firmware -TH, con
 * acción larga y umbral). Con `opts.requireTapHold` una línea de 7 campos se
 * descarta (el firmware ya se declaró compatible, sería un dato corrupto).
 * @param {string} line
 * @param {DeviceCfg} cfg
 * @param {{ requireTapHold?: boolean }} [opts]
 * @returns {DeviceCfg} el mismo `cfg`, por conveniencia.
 */
export function parseDeviceLine(line, cfg, opts = {}) {
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
    const extended = isExtendedBtnLine(line);
    if (opts.requireTapHold && !extended) return cfg;
    /** @type {ButtonCfg} */
    const b = {
      tipo: +p[2],
      modo: +p[3] === 2 ? 0 : +p[3], // 2 (holdeable heredado) → "Al presionar"
      debounce: +p[4],
      accion: +p[5],
      mods: +p[6],
      flags: +p[7],
    };
    if (extended) {
      b.accionLarga = +p[8];
      b.modsLarga = +p[9];
      b.flagsLarga = +p[10];
      b.umbral = +p[11];
    }
    cfg.btns[p[1]] = b;
  }
  return cfg;
}

/**
 * Mensaje legible para los errores del firmware ligados a modo de disparo /
 * Tap-Hold. `null` para cualquier otra línea (no se toca su manejo actual).
 * @param {string} line
 * @returns {string | null}
 */
export function describeDeviceError(line) {
  const m = /^ERR:(MODE|ACTIONLARGA|MODSLARGA|FLAGSLARGA|THRESHOLD)\b/.exec(line);
  if (!m) return null;
  /** @type {Record<string, string>} */
  const msgs = {
    MODE: 'El dispositivo no acepta ese modo de disparo.',
    ACTIONLARGA: 'Acción larga inválida: revisá la tecla o acción elegida para la pulsación larga.',
    MODSLARGA: 'Modificadores inválidos en la acción larga.',
    FLAGSLARGA: 'Opción inválida en la acción larga (mantener clic solo aplica al mouse).',
    THRESHOLD: 'Falta o es inválido el umbral de pulsación larga.',
  };
  return msgs[m[1]];
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación de comandos de configuración
//
// Esto NO existe en el configurador publicado — es la lista blanca propia del
// núcleo nuevo (ver conexion.js → aplicar()). Tiene que aceptar exactamente lo
// que protocol.js real puede llegar a construir (base de 7 campos, o Tap-Hold
// de 11) y nada más: nunca SAVE, RESET, WHO, GETALL ni un comando crudo.
// ─────────────────────────────────────────────────────────────────────────────

const RE_CODIGO = 'BR|BA|BN|BC|FU|FD|FL|FR';
const RE_CFG = new RegExp(`^CFG:(${RE_CODIGO}):[KMX]:[PRO]:\\d{1,4}:[^:]+:[^:]+:[^:]+$`);
const RE_CFG_TAPHOLD = new RegExp(
  `^CFG:(${RE_CODIGO}):[KMX]:T:\\d{1,4}:[^:]+:[^:]+:[^:]+:[^:]+:[^:]+:[^:]+:\\d{1,4}$`,
);
const RE_FMODE = /^FMODE:[0-2]$/;
const RE_ORIENT = /^ORIENT:[0-3]$/;
const RE_VEL = /^VEL:(\d{1,2})$/;
const RE_ACEL = /^ACEL:[01]$/;

/**
 * ¿Es una línea de configuración que el núcleo acepta enviar con `aplicar()`?
 * Lista blanca estricta: `CFG:` (formato base o Tap-Hold), `FMODE:`, `ORIENT:`,
 * `VEL:` y `ACEL:` bien formados. Deja afuera a propósito `SAVE`, `RESET`,
 * `WHO`, `GETALL` y cualquier comando crudo: esos tienen su propio método
 * explícito (o no se mandan), para que un preset mal armado no pueda
 * restablecer el dispositivo. El modo `H` nunca matchea — está retirado del
 * protocolo (el firmware responde `ERR:MODE`).
 * @param {string} linea
 * @returns {boolean}
 */
export function esComandoDeConfiguracion(linea) {
  if (typeof linea !== 'string') return false;
  if (RE_CFG.test(linea)) {
    const debounce = parseInt(linea.split(':')[4], 10);
    return debounce <= 5000;
  }
  if (RE_CFG_TAPHOLD.test(linea)) {
    const p = linea.split(':');
    const debounce = parseInt(p[4], 10);
    const umbral = parseInt(p[11], 10);
    return debounce <= 5000 && (umbral === 0 || (umbral >= TH_MIN_MS && umbral <= TH_MAX_MS));
  }
  if (RE_FMODE.test(linea) || RE_ORIENT.test(linea) || RE_ACEL.test(linea)) return true;
  const v = RE_VEL.exec(linea);
  if (v) {
    const n = parseInt(v[1], 10);
    return n >= 1 && n <= 50;
  }
  return false;
}
