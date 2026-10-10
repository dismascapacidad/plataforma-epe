/**
 * eventos.js
 * Eventos de entrada de Barrido: qué eventos hacen falta según cómo se barre,
 * qué tecla dispara cada uno y cómo se reasignan.
 *
 * Un EVENTO DE ENTRADA es algo que hace la persona (apretar un pulsador, una
 * pulsación larga, un parpadeo…). La app solo ve la tecla que llega, así que
 * acá cada evento tiene una tecla. Un mismo pulsador físico puede producir dos
 * eventos distintos (toque corto y pulsación larga): para la app son dos teclas
 * diferentes, y de eso se ocupa el dispositivo (ver "Configurar dispositivo").
 *
 * Módulo puro: no toca el DOM.
 */
import { etiquetaTecla, normalizarTecla } from '../comunicacion-cabeza/config.js';

export { etiquetaTecla, normalizarTecla };

/** Todos los eventos que existen, en el orden en que se muestran. */
export const IDS_EVENTO = ['avanzar', 'seleccionar', 'retroceder', 'reproducir'];

export const NOMBRES_EVENTO = {
  avanzar: 'Avanzar',
  seleccionar: 'Seleccionar',
  retroceder: 'Retroceder',
  reproducir: 'Reproducir la palabra',
};

/** Teclas por defecto: son solo un punto de partida, todas se pueden cambiar. */
/** @type {Record<string, string>} */
export const TECLAS_POR_DEFECTO = {
  avanzar: 'k',
  seleccionar: 'l',
  retroceder: 'j',
  reproducir: 'p',
};

export const METODOS = ['auto', 'dirigido'];
export const NOMBRES_METODO = {
  auto: 'Automático (por tiempo)',
  dirigido: 'Dirigido (con eventos de entrada)',
};

/**
 * Qué hace cada evento, según el método.
 * @param {string} id
 * @param {string} metodo
 */
export function descripcionEvento(id, metodo) {
  if (id === 'seleccionar') {
    return metodo === 'auto'
      ? 'Elige la opción resaltada (el barrido avanza solo).'
      : 'Elige la opción resaltada.';
  }
  if (id === 'avanzar') return 'Pasa a la opción siguiente.';
  if (id === 'retroceder') return 'Vuelve a la opción anterior.';
  return 'Dice en voz alta lo escrito.';
}

/**
 * Eventos que hay que poder generar ahora.
 *  - Automático: 1 evento (Seleccionar); el avance lo hace el tiempo.
 *  - Dirigido: 2 eventos (Avanzar y Seleccionar), o 3 si se suma Retroceder.
 *  - "Reproducir" se suma si la palabra se reproduce con tecla dedicada.
 * @param {{metodo: string, conRetroceso?: boolean, reproduccion?: string}} op
 * @returns {string[]}
 */
export function eventosActivos({ metodo, conRetroceso = false, reproduccion = 'auto' }) {
  /** @type {string[]} */
  const lista = [];
  if (metodo === 'dirigido') {
    lista.push('avanzar', 'seleccionar');
    if (conRetroceso) lista.push('retroceder');
  } else {
    lista.push('seleccionar');
  }
  if (reproduccion === 'tecla') lista.push('reproducir');
  return lista;
}

/** Teclas que no se pueden asignar a un evento. */
const RESERVADAS = new Set([
  'escape', // reabre la configuración
  'shift',
  'control',
  'alt',
  'altgraph',
  'meta',
  'capslock',
  'os',
  'dead',
  'unidentified',
]);

/** @returns {{ok:boolean, tecla?:string, motivo?:string}} */
export function validarTecla(tecla) {
  const t = normalizarTecla(tecla);
  if (!t) return { ok: false, motivo: 'No se detectó ninguna tecla.' };
  if (t === 'escape')
    return { ok: false, motivo: 'Esc reabre la configuración: elegí otra tecla.' };
  if (RESERVADAS.has(t)) return { ok: false, motivo: 'Esa tecla no sirve sola: elegí otra.' };
  return { ok: true, tecla: t };
}

/**
 * Asigna `tecla` al evento `id`. Si otro evento ya la usaba, los dos se
 * INTERCAMBIAN: nunca queda un evento sin tecla ni dos con la misma.
 * @param {Record<string,string>} teclas
 * @param {string} id
 * @param {string} tecla
 * @returns {{teclas: Record<string,string>, intercambio: string|null}}
 */
export function asignarTecla(teclas, id, tecla) {
  const nueva = normalizarTecla(tecla);
  const salida = { ...teclas };
  const anterior = salida[id];
  const otro = IDS_EVENTO.find((otroId) => otroId !== id && salida[otroId] === nueva) ?? null;
  if (otro) salida[otro] = anterior;
  salida[id] = nueva;
  return { teclas: salida, intercambio: otro };
}

/**
 * Qué evento (entre los activos) dispara esta tecla, o null.
 * @param {Record<string,string>} teclas
 * @param {string[]} activos
 * @param {string} tecla
 * @returns {string|null}
 */
export function eventoDeTecla(teclas, activos, tecla) {
  const t = normalizarTecla(tecla);
  return activos.find((id) => teclas[id] === t) ?? null;
}

/**
 * Lo que necesita el widget "Configurar dispositivo": una entrada por evento
 * activo, con la tecla en el formato de las apps (KeyboardEvent.key en minúscula).
 * @param {Record<string,string>} teclas
 * @param {string[]} activos
 * @returns {{id:string, etiqueta:string, tecla:string}[]}
 */
export function entradasParaDispositivo(teclas, activos) {
  return activos.map((id) => ({ id, etiqueta: NOMBRES_EVENTO[id], tecla: teclas[id] }));
}
