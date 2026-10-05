// @ts-check
/**
 * Conexión al dispositivo compartida por toda la página.
 *
 * El puerto USB (o Bluetooth) se abre UNA vez por página y queda abierto: si
 * cada "Configurar mi dispositivo" intentara abrirlo de nuevo, el navegador
 * respondería "puerto ocupado" (ya lo tiene esta misma pestaña). Entonces la
 * primera vez se conecta, y las siguientes se reutiliza la conexión abierta
 * (sin volver a mostrar el selector). Si el dispositivo se desenchufa o se
 * pierde la conexión, la entrada se borra sola y la próxima vez se reconecta.
 *
 * Es solo un registro: no manda ningún comando.
 */

import { crearConexionUsb, crearConexionBle } from '../dispositivo/index.js';

/** @typedef {ReturnType<typeof crearConexionUsb>['conexion']} Conexion */

/** @type {Map<'usb'|'ble', Conexion>} */
const activas = new Map();

/**
 * Respaldo del estado ORIGINAL de cada conexión: la configuración que tenía el
 * dispositivo antes de que la plataforma lo tocara por primera vez. Si se
 * configura un segundo recurso sin haber restaurado, el respaldo no se
 * reemplaza: "Restaurar" siempre vuelve al estado inicial, no al del recurso anterior.
 * @type {WeakMap<object, object>}
 */
const originales = new WeakMap();

/**
 * Devuelve el respaldo original de esa conexión; si todavía no hay, guarda `candidato`
 * (el que se acaba de leer, o uno recuperado del almacenamiento) y lo devuelve.
 * @template T @param {Conexion} conexion @param {T} candidato @returns {T}
 */
export function respaldoOriginal(conexion, candidato) {
  const previo = /** @type {T | undefined} */ (originales.get(conexion));
  if (previo) return previo;
  originales.set(conexion, /** @type {any} */ (candidato));
  return candidato;
}

/** Olvida el respaldo original (después de restaurar con éxito): el próximo parte de cero. @param {Conexion} conexion */
export function olvidarRespaldoOriginal(conexion) {
  originales.delete(conexion);
}

/** @param {Conexion | undefined} c */
function viva(c) {
  return !!c && c.estado === 'conectado';
}

/**
 * La conexión abierta (y con modelo detectado) de esta página, si hay alguna.
 * @returns {{ tipo: 'usb'|'ble', conexion: Conexion } | null}
 */
export function obtenerActiva() {
  for (const [tipo, conexion] of activas) {
    if (viva(conexion) && conexion.info) return { tipo, conexion };
  }
  return null;
}

/**
 * Conecta, o reutiliza la conexión que ya está abierta de ese tipo.
 * @param {'usb'|'ble'} tipo
 * @param {{ silencioso?: boolean }} [opciones] `silencioso`: USB sin selector (puerto ya autorizado).
 * @returns {Promise<{ conexion: Conexion, info: NonNullable<Conexion['info']>, reutilizada: boolean }>}
 */
export async function conectarCompartida(tipo, { silencioso = false } = {}) {
  const previa = activas.get(tipo);
  if (viva(previa) && previa && previa.info) {
    return { conexion: previa, info: previa.info, reutilizada: true };
  }
  activas.delete(tipo);

  const { conexion } = tipo === 'usb' ? crearConexionUsb() : crearConexionBle();
  const info = await conexion.conectar({ silencioso });
  activas.set(tipo, conexion);
  conexion.alCambioDeEstado((estado) => {
    if (estado === 'desconectado' && activas.get(tipo) === conexion) activas.delete(tipo);
  });
  return { conexion, info, reutilizada: false };
}

/** Cierra y olvida todas las conexiones (por si una quedó en mal estado). */
export async function soltarActivas() {
  const todas = [...activas.values()];
  activas.clear();
  for (const c of todas) {
    try {
      await c.desconectar();
    } catch {
      /* ya estaba cerrada */
    }
  }
}
