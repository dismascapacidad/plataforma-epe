// @ts-check
/**
 * Lectura y comparación de versiones de firmware.
 *
 * El dispositivo responde a `WHO` con una versión como `R019` o `R019-TH1`:
 * una `R` + número de revisión, y opcionalmente un sufijo tras el guion
 * (variante de hardware o de compilación). Para decidir si un dispositivo
 * está desactualizado solo cuenta el NÚMERO; el sufijo se conserva aparte.
 *
 * Corrige un error del configurador actual: allá se hacía
 * `parseInt(version.replace(/\D/g, ''))`, que con `R019-TH1` da 191 (mezcla
 * el `1` del sufijo con el número) y dejaría de avisar cuando salga R020.
 */

/**
 * @typedef {Object} VersionFirmware
 * @property {number} numero  Revisión: `R019` → 19.
 * @property {string} sufijo  Lo que va tras el guion (`R019-TH1` → `TH1`), o ''.
 * @property {string} texto   La versión original, sin espacios en los extremos.
 */

/**
 * Última versión conocida por modelo, con el nombre EXACTO que informa `WHO`.
 * Es la misma tabla que `LATEST_FW` del configurador: un modelo que no figura
 * acá (por ejemplo `disHub BLE`) simplemente no se compara.
 * Actualizar cuando se publique un firmware nuevo.
 * @type {Record<string, string>}
 */
export const ULTIMAS_VERSIONES = {
  disMouse: 'R019',
  disButton: 'R019',
  disHub: 'R013',
  disMouth: 'R001',
};

/**
 * Interpreta una versión de firmware. Devuelve `null` si no tiene el
 * formato esperado (`R` + dígitos, con sufijo opcional tras un guion).
 * @param {string | null | undefined} texto
 * @returns {VersionFirmware | null}
 */
export function leerVersion(texto) {
  const limpio = String(texto ?? '').trim();
  const m = /^R(\d+)(?:-(.*))?$/i.exec(limpio);
  if (!m) return null;
  return { numero: parseInt(m[1], 10), sufijo: m[2] ?? '', texto: limpio };
}

/**
 * Compara dos versiones por número de revisión.
 * @param {string} a
 * @param {string} b
 * @returns {number | null} negativo si `a` es más vieja que `b`, 0 si iguales,
 *   positivo si `a` es más nueva; `null` si alguna no se pudo interpretar.
 */
export function compararVersiones(a, b) {
  const va = leerVersion(a);
  const vb = leerVersion(b);
  if (!va || !vb) return null;
  return va.numero - vb.numero;
}

/**
 * ¿La versión del dispositivo es anterior a la última conocida de su modelo?
 * Conservador: si el modelo no tiene versión conocida, o alguna versión no se
 * puede interpretar, devuelve `false` (no molesta al usuario con un aviso
 * que no podemos sostener).
 * @param {string} modelo   Nombre tal como lo informa `WHO`.
 * @param {string} version  Versión informada por `WHO`.
 * @returns {boolean}
 */
export function estaDesactualizado(modelo, version) {
  const ultima = ULTIMAS_VERSIONES[modelo];
  if (!ultima) return false;
  const cmp = compararVersiones(version, ultima);
  return cmp !== null && cmp < 0;
}
