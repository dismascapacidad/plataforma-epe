// @ts-check
/**
 * Utilidades puras sobre la configuración de un dispositivo (`DeviceCfg`):
 * copiar, comparar, armar los comandos para restaurarla y serializar un
 * "snapshot" (copia de respaldo) a texto.
 *
 * Sin DOM ni red: todo se puede probar con tests. Lo usa `conexion.js`
 * para el "volver atrás" y para verificar que lo restaurado quedó igual.
 */

import { cfgToCommands, esComandoDeConfiguracion, REV_KEY, TH_DEFAULT_MS } from './protocolo.js';
import { todasLasEntradas } from './productos.js';

/** @typedef {import('./protocolo.js').DeviceCfg} DeviceCfg */
/** @typedef {import('./protocolo.js').ButtonCfg} ButtonCfg */
/** @typedef {import('./productos.js').Producto} Producto */

/**
 * @typedef {Object} Diferencia
 * @property {string} campo   Ej. `fmode`, `btns.2.accion`.
 * @property {unknown} antes
 * @property {unknown} despues
 */

/**
 * @typedef {Object} Snapshot
 * @property {number} formato        Versión del formato (hoy 1).
 * @property {string} tomadoEn       Fecha ISO.
 * @property {string} modelo         Lo que informó `WHO` (ej. `disMouse`).
 * @property {string} firmware       Ej. `R019-TH1`.
 * @property {DeviceCfg} cfg
 * @property {string[]} lineasCrudas Respuesta de `GETALL` tal cual llegó.
 * @property {string[]} [faltantes]  Datos que se esperaban y no llegaron (vacío o ausente = completo).
 */

const CAMPOS_GLOBALES = /** @type {const} */ (['orient', 'vel', 'acel', 'fmode']);
const CAMPOS_BOTON = /** @type {const} */ (['tipo', 'modo', 'debounce', 'accion', 'mods', 'flags']);
// Campos Tap-Hold (solo presentes en firmware -TH, línea BTN de 11 campos). Ausentes
// (`undefined`, dispositivo sin Tap-Hold) se tratan como "sin dato", igual que los
// campos globales — ver `norm()` más abajo. `0` sigue siendo un valor real.
const CAMPOS_BOTON_TAPHOLD = /** @type {const} */ ([
  'accionLarga',
  'modsLarga',
  'flagsLarga',
  'umbral',
]);

/**
 * Copia profunda de una configuración.
 * @param {DeviceCfg} cfg
 * @returns {DeviceCfg}
 */
export function clonarCfg(cfg) {
  return JSON.parse(JSON.stringify(cfg));
}

/**
 * Lista las diferencias entre dos configuraciones. Vacío = idénticas.
 * `null` y `undefined` cuentan como "sin dato" y se consideran iguales.
 * @param {DeviceCfg} a  Lo esperado (ej. el snapshot).
 * @param {DeviceCfg} b  Lo actual (ej. releído del dispositivo).
 * @returns {Diferencia[]}
 */
export function compararConfiguraciones(a, b) {
  /** @type {Diferencia[]} */
  const dif = [];
  /** @param {unknown} x */
  const norm = (x) => (x === undefined ? null : x);

  for (const campo of CAMPOS_GLOBALES) {
    if (norm(a[campo]) !== norm(b[campo])) {
      dif.push({ campo, antes: norm(a[campo]), despues: norm(b[campo]) });
    }
  }

  const indices = new Set([...Object.keys(a.btns || {}), ...Object.keys(b.btns || {})]);
  for (const i of [...indices].sort((x, y) => Number(x) - Number(y))) {
    const ba = a.btns?.[i];
    const bb = b.btns?.[i];
    if (!ba || !bb) {
      dif.push({ campo: `btns.${i}`, antes: ba ?? null, despues: bb ?? null });
      continue;
    }
    for (const campo of CAMPOS_BOTON) {
      if (ba[campo] !== bb[campo]) {
        dif.push({ campo: `btns.${i}.${campo}`, antes: ba[campo], despues: bb[campo] });
      }
    }
    // Campos Tap-Hold: solo tienen sentido si el botón está en modo T (4) en algún
    // lado de la comparación; si no, quedan en `undefined` en firmware sin Tap-Hold
    // o en 0 en un botón que no está en T, y no se los compara (ver comentario en
    // CAMPOS_BOTON_TAPHOLD). Comparar de más ahí generaría ruido: cualquier CFG
    // sobre un botón no-T resetea esos campos a 0 en el firmware (ver protocolo).
    if (ba.modo === 4 || bb.modo === 4) {
      for (const campo of CAMPOS_BOTON_TAPHOLD) {
        if (norm(ba[campo]) !== norm(bb[campo])) {
          dif.push({
            campo: `btns.${i}.${campo}`,
            antes: norm(ba[campo]),
            despues: norm(bb[campo]),
          });
        }
      }
    }
  }
  return dif;
}

/**
 * Arma los comandos para dejar el dispositivo con la configuración `cfg`.
 *
 * Parte de `cfgToCommands` y le hace dos ajustes de seguridad:
 *  - Los campos de modificadores y flags salen como `-` (la forma que usan los
 *    presets de fábrica) y no como `'- '` con espacio.
 *  - Todo comando pasa por la lista blanca `esComandoDeConfiguracion`: si uno
 *    no es representable (por ejemplo una tecla `:` que rompería el formato,
 *    o un valor fuera de rango) NO se envía y queda anotado en `advertencias`,
 *    para que se sepa que esa entrada no se pudo restaurar.
 *
 * @param {DeviceCfg} cfg
 * @param {{ tapHold?: boolean }} [opts] `tapHold`: el dispositivo conectado soporta
 *   modo Tap-Hold (`Conexion.info.soportaTapHold`). Sin esto, un botón leído en
 *   modo 4 se restaura como pulsación simple (se pierde la acción larga) — nunca
 *   se manda `T` a un firmware que no lo demostró soportar.
 * @returns {{ comandos: string[], advertencias: string[] }}
 */
export function comandosDeRestauracion(cfg, opts = {}) {
  /** @type {string[]} */
  const comandos = [];
  /** @type {string[]} */
  const advertencias = [];

  for (const crudo of cfgToCommands(cfg, opts)) {
    let linea = crudo;
    if (crudo.startsWith('CFG:')) {
      const p = crudo.split(':');
      // p = ['CFG', code, tipo, modo, debounce, accion, mods, flags, ...Tap-Hold?].
      // La acción puede ser un espacio literal: solo se recortan mods y flags (los
      // dos campos que siguen a la acción, sea formato base de 8 o Tap-Hold de 12).
      if (p.length === 8 || p.length === 12) {
        p[6] = p[6].trim() || '-';
        p[7] = p[7].trim() || '-';
        linea = p.join(':');
      }
    }
    if (esComandoDeConfiguracion(linea)) comandos.push(linea);
    else advertencias.push(`No se puede restaurar: ${JSON.stringify(crudo)}`);
  }
  return { comandos, advertencias };
}

/**
 * Serializa un snapshot a texto (JSON) para guardarlo o copiarlo como
 * respaldo antes de tocar un dispositivo.
 * @param {Snapshot} snapshot
 * @returns {string}
 */
export function snapshotATexto(snapshot) {
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Lee un snapshot guardado como texto. Lanza un error claro si no tiene la
 * forma esperada (no acepta cualquier JSON).
 * @param {string} texto
 * @returns {Snapshot}
 */
export function snapshotDeTexto(texto) {
  let obj;
  try {
    obj = JSON.parse(texto);
  } catch {
    throw new Error('El respaldo no es un JSON válido.');
  }
  if (!obj || obj.formato !== 1 || typeof obj.cfg !== 'object' || !obj.cfg || !obj.cfg.btns) {
    throw new Error('El respaldo no tiene el formato esperado.');
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// Descripciones legibles
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Record<string, string>} */
const NOMBRES_TECLA = {
  SPACE: 'Espacio',
  ENTER: 'Enter',
  TAB: 'Tab',
  ESC: 'Esc',
  BACKSPACE: 'Retroceso',
  DELETE: 'Supr',
  INSERT: 'Insert',
  HOME: 'Inicio',
  END: 'Fin',
  PAGE_UP: 'Re Pág',
  PAGE_DOWN: 'Av Pág',
  UP_ARROW: '↑',
  DOWN_ARROW: '↓',
  LEFT_ARROW: '←',
  RIGHT_ARROW: '→',
};

/** @type {Record<number, string>} */
const ACCIONES_MOUSE = {
  1: 'clic izquierdo',
  2: 'clic derecho',
  4: 'clic central',
  8: 'scroll hacia arriba',
  16: 'scroll hacia abajo',
};

/** @type {Record<number, string>} */
const MODOS = {
  0: 'al presionar',
  1: 'al soltar',
  3: 'una vez por pulsación',
  // 4 (Tap-Hold) no usa esta tabla: describirBoton() lo compone aparte, con la
  // acción larga y el umbral. 2 (holdeable heredado) nunca debería llegar hasta
  // acá — parseDeviceLine() lo degrada a 0 — pero se deja un fallback razonable.
  2: 'al presionar',
};

/**
 * Nombre legible de la tecla que emite un botón de tipo teclado.
 * @param {number} accion  Código que informa `GETALL` (carácter o keycode especial).
 * @returns {string}
 */
export function nombreDeTecla(accion) {
  const token = REV_KEY[String(accion)];
  if (token) return NOMBRES_TECLA[token] ?? token; // F1..F12 quedan como token
  if (accion > 32 && accion < 127) return String.fromCharCode(accion).toUpperCase();
  return `tecla de código ${accion}`;
}

/**
 * Frase legible de lo que hace una acción de mouse o teclado, sin el modo ni
 * el antirrebote — la parte que comparten la acción corta y, en Tap-Hold, la
 * acción larga.
 * @param {number} tipo    0 mouse · 1 teclado (2/desactivado se maneja aparte).
 * @param {number} accion
 * @param {number} mods
 * @param {number} flags   bit 0x01 doble clic · bit 0x02 mantener (solo acción corta).
 * @returns {string}
 */
function describirAccion(tipo, accion, mods, flags) {
  if (tipo === 0) {
    let que = `Mouse: ${ACCIONES_MOUSE[accion] ?? `acción ${accion}`}`;
    if (flags & 0x01) que += ' (doble clic)';
    if (flags & 0x02) que += ' (mantener presionado)';
    return que;
  }
  const nombresMods = [];
  if (mods & 0x01) nombresMods.push('Ctrl');
  if (mods & 0x02) nombresMods.push('Mayús');
  if (mods & 0x04) nombresMods.push('Alt');
  if (mods & 0x08) nombresMods.push('Win/⌘');
  const tecla = accion === 0 ? '' : nombreDeTecla(accion);
  return `Teclado: ${[...nombresMods, tecla].filter(Boolean).join(' + ') || '(sin tecla)'}`;
}

/**
 * Frase legible de lo que hace un botón, por ejemplo
 * `Teclado: Ctrl + C · una vez por pulsación · antirrebote 30 ms`, o para
 * Tap-Hold `Mouse: clic izquierdo · corta: clic izquierdo — larga (500 ms):
 * clic derecho`.
 * @param {ButtonCfg} b
 * @returns {string}
 */
export function describirBoton(b) {
  if (b.tipo === 2) return 'Desactivado';

  const que = describirAccion(b.tipo, b.accion, b.mods, b.flags);

  if (b.modo === 4) {
    const umbral = b.umbral || TH_DEFAULT_MS;
    const larga = describirAccion(b.tipo, b.accionLarga || 0, b.modsLarga || 0, b.flagsLarga || 0);
    const partes = [`Tap-Hold — corta: ${que}`, `larga (${umbral} ms): ${larga}`];
    if (b.debounce > 0) partes.push(`antirrebote ${b.debounce} ms`);
    return partes.join(' · ');
  }

  const partes = [que, MODOS[b.modo] ?? `modo ${b.modo}`];
  if (b.debounce > 0) partes.push(`antirrebote ${b.debounce} ms`);
  return partes.join(' · ');
}

/**
 * Resumen de una configuración para mostrar al usuario: una fila por entrada
 * física del producto, más los ajustes globales que aplican a ese modelo.
 * @param {DeviceCfg} cfg
 * @param {Producto} producto
 * @returns {Array<{ clave: string, etiqueta: string, texto: string }>}
 */
export function resumirConfiguracion(cfg, producto) {
  const filas = [];
  const CODIGO_A_INDICE = { BR: 0, BA: 1, BN: 2, BC: 3, FU: 4, FD: 5, FL: 6, FR: 7 };
  for (const e of todasLasEntradas(producto)) {
    const idx = CODIGO_A_INDICE[/** @type {keyof typeof CODIGO_A_INDICE} */ (e.codigo)];
    const b = cfg.btns?.[idx];
    filas.push({
      clave: e.codigo,
      etiqueta: e.nota ? `${e.etiqueta} (${e.nota})` : e.etiqueta,
      texto: b ? describirBoton(b) : 'sin datos',
    });
  }
  if (producto.secundariasSoloModoIndividual && cfg.fmode != null) {
    const modos = [
      'cada flecha con su propia acción',
      'las flechas mueven el cursor del mouse',
      'las flechas emulan las teclas ↑ ↓ ← →',
    ];
    filas.push({
      clave: 'FMODE',
      etiqueta: 'Modo de flechas',
      texto: modos[cfg.fmode] ?? `modo ${cfg.fmode}`,
    });
  }
  return filas;
}

/**
 * Arma un CSV con el mismo formato que exporta e importa el configurador
 * actual (`name,date,prodId,notes,cfg_json`), para poder cargar un respaldo
 * como "configuración propia" desde ahí si hiciera falta volver atrás por
 * otro camino.
 * @param {Snapshot} snapshot
 * @param {string | null} prodId  Id de producto del configurador (`dismouse`, `dishub`…).
 * @returns {string}
 */
export function snapshotACsvDelConfigurador(snapshot, prodId) {
  const fecha = snapshot.tomadoEn.slice(0, 16).replace('T', ' ');
  const nombre = `Respaldo ${snapshot.modelo || 'dispositivo'} ${fecha}`;
  const filas = [
    ['name', 'date', 'prodId', 'notes', 'cfg_json'],
    [
      nombre,
      snapshot.tomadoEn,
      prodId ?? '',
      'Respaldo tomado antes de probar el núcleo nuevo',
      JSON.stringify(snapshot.cfg),
    ],
  ];
  return filas
    .map((f) => f.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','))
    .join('\r\n');
}

const CODIGO_A_INDICE_CFG = { BR: 0, BA: 1, BN: 2, BC: 3, FU: 4, FD: 5, FL: 6, FR: 7 };

/**
 * ¿Qué datos esperados no llegaron en la lectura? Sirve para no confiar en un
 * respaldo incompleto (por ejemplo si el dispositivo tardó en contestar y la
 * lectura se cerró antes de tiempo).
 *
 * Se espera una línea `BTN` por cada entrada del producto y, en los modelos
 * con flechas (disMouse/disJoystick), también `ORIENT`, `VEL`, `ACEL` y
 * `FMODE`. Si el producto no se reconoce, solo se exige al menos una entrada.
 * @param {DeviceCfg} cfg
 * @param {Producto | null} producto
 * @returns {string[]}  Vacío si está completo.
 */
export function entradasFaltantes(cfg, producto) {
  /** @type {string[]} */
  const faltan = [];
  const btns = cfg.btns ?? {};
  if (!producto) {
    if (!Object.keys(btns).length) faltan.push('BTN (ninguna entrada)');
    return faltan;
  }
  for (const e of todasLasEntradas(producto)) {
    const idx = CODIGO_A_INDICE_CFG[/** @type {keyof typeof CODIGO_A_INDICE_CFG} */ (e.codigo)];
    if (!btns[idx]) faltan.push(`BTN ${idx} (${e.etiqueta})`);
  }
  if (producto.secundariasSoloModoIndividual) {
    for (const campo of CAMPOS_GLOBALES) {
      if (cfg[campo] == null) faltan.push(campo.toUpperCase());
    }
  }
  return faltan;
}
