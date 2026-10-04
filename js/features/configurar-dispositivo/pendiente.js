// @ts-check
/**
 * "Restauración pendiente": cuando el dispositivo queda configurado para un
 * recurso externo, se guarda acá (localStorage) el respaldo de cómo estaba. Si
 * la pestaña de la plataforma se cierra o se recarga antes de restaurar, la
 * próxima vez que se abra la plataforma se ofrece restaurarlo igual.
 *
 * Lo guardado es solo la configuración del dispositivo (qué tecla manda cada
 * botón, modelo, firmware) y el nombre/URL del recurso: sin datos personales.
 * localStorage puede no estar disponible (modo privado, bloqueado): todo
 * está envuelto en try/catch y, si no anda, simplemente no hay persistencia.
 */

export const CLAVE = 'epe.dispositivo.pendiente.v1';

/** Tope de tamaño de lo que se acepta leer (un respaldo real pesa pocos KB). */
const MAX_SNAPSHOT = 200_000;

/**
 * @typedef {Object} Pendiente
 * @property {string} nombre         Nombre del recurso (solo para mostrar).
 * @property {string | null} url     URL https del recurso, para "abrir de nuevo".
 * @property {string} snapshotTexto  Respaldo serializado (`snapshotATexto`).
 * @property {string} creadoEn       ISO 8601.
 */

/**
 * @param {Storage | null} almacen
 * @param {Pendiente} pendiente
 * @returns {boolean} `true` si se pudo guardar.
 */
export function guardar(almacen, pendiente) {
  if (!almacen) return false;
  try {
    almacen.setItem(CLAVE, JSON.stringify(pendiente));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Storage | null} almacen
 * @returns {Pendiente | null} `null` si no hay nada o lo guardado no es válido.
 */
export function leer(almacen) {
  if (!almacen) return null;
  try {
    const crudo = almacen.getItem(CLAVE);
    if (!crudo) return null;
    const o = JSON.parse(crudo);
    if (!o || typeof o !== 'object') return null;
    if (typeof o.nombre !== 'string' || o.nombre.length > 200) return null;
    if (typeof o.snapshotTexto !== 'string' || o.snapshotTexto.length > MAX_SNAPSHOT) return null;
    if (typeof o.creadoEn !== 'string') return null;
    const url = typeof o.url === 'string' ? o.url : null;
    return { nombre: o.nombre, url, snapshotTexto: o.snapshotTexto, creadoEn: o.creadoEn };
  } catch {
    return null;
  }
}

/** @param {Storage | null} almacen */
export function borrar(almacen) {
  if (!almacen) return;
  try {
    almacen.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: nada que borrar */
  }
}
