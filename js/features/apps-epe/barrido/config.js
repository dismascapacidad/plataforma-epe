/**
 * config.js
 * Configuración de Barrido y su persistencia. localStorage siempre con
 * try/catch (mismo criterio que theme.js): sin storage, la app anda igual.
 *
 * Solo se guarda la CONFIGURACIÓN. Nunca el texto escrito en "Comunicación" ni
 * las palabras propias: pueden terminar con datos de una persona real.
 */
import { PATRONES } from './patrones.js';
import { IDS_EVENTO, METODOS, TECLAS_POR_DEFECTO, validarTecla } from './eventos.js';

const CLAVE = 'epe-barrido';

export const OBJETIVOS = ['copiar', 'comunicacion'];
export const NOMBRES_OBJETIVO = {
  copiar: 'Copiar una palabra',
  comunicacion: 'Comunicación',
};
export const DISPOSICIONES = ['abc', 'qwerty'];

/** Rango del intervalo del barrido automático (ms entre una opción y la siguiente). */
export const INTERVALO_MIN_MS = 400;
export const INTERVALO_MAX_MS = 3000;
export const VUELTAS_MIN = 1;
export const VUELTAS_MAX = 5;

/**
 * @typedef {{objetivo:string, metodo:string, patron:string, conRetroceso:boolean,
 *   intervaloMs:number, vueltas:number, layout:string, reproduccion:string,
 *   teclas:Record<string,string>, vozNombre:string|null, velocidadVoz:number}} Config
 */

/** @type {Config} */
export const CONFIG_INICIAL = {
  objetivo: 'copiar', // 'copiar' | 'comunicacion'
  metodo: 'auto', // 'auto' | 'dirigido'
  patron: 'celda', // ver PATRONES
  conRetroceso: false, // solo en dirigido: suma el evento Retroceder
  intervaloMs: 1500, // solo en automático
  vueltas: 2, // veces que se recorre un grupo antes de volver al nivel de arriba
  layout: 'abc', // 'abc' | 'qwerty'
  reproduccion: 'auto', // 'auto' (al completar la palabra) | 'tecla' (evento Reproducir)
  teclas: { ...TECLAS_POR_DEFECTO },
  vozNombre: null,
  velocidadVoz: 1,
};

/** Teclas guardadas: solo valen si son válidas y no hay dos eventos con la misma. */
function teclasValidas(t) {
  if (!t || typeof t !== 'object') return { ...TECLAS_POR_DEFECTO };
  /** @type {Record<string, string>} */
  const salida = {};
  for (const id of IDS_EVENTO) {
    const r = typeof t[id] === 'string' ? validarTecla(t[id]) : { ok: false };
    if (!r.ok) return { ...TECLAS_POR_DEFECTO };
    salida[id] = r.tecla;
  }
  if (new Set(Object.values(salida)).size !== IDS_EVENTO.length) return { ...TECLAS_POR_DEFECTO };
  return salida;
}

/** @returns {Config} */
export function validarConfig(c) {
  const salida = { ...CONFIG_INICIAL, teclas: { ...TECLAS_POR_DEFECTO } };
  if (!c || typeof c !== 'object') return salida;
  if (OBJETIVOS.includes(c.objetivo)) salida.objetivo = c.objetivo;
  if (METODOS.includes(c.metodo)) salida.metodo = c.metodo;
  if (PATRONES.includes(c.patron)) salida.patron = c.patron;
  if (typeof c.conRetroceso === 'boolean') salida.conRetroceso = c.conRetroceso;
  if (
    Number.isFinite(c.intervaloMs) &&
    c.intervaloMs >= INTERVALO_MIN_MS &&
    c.intervaloMs <= INTERVALO_MAX_MS
  ) {
    salida.intervaloMs = c.intervaloMs;
  }
  if (Number.isInteger(c.vueltas) && c.vueltas >= VUELTAS_MIN && c.vueltas <= VUELTAS_MAX) {
    salida.vueltas = c.vueltas;
  }
  if (DISPOSICIONES.includes(c.layout)) salida.layout = c.layout;
  if (c.reproduccion === 'auto' || c.reproduccion === 'tecla') salida.reproduccion = c.reproduccion;
  if (typeof c.vozNombre === 'string') salida.vozNombre = c.vozNombre;
  if (Number.isFinite(c.velocidadVoz) && c.velocidadVoz >= 0.5 && c.velocidadVoz <= 1.6) {
    salida.velocidadVoz = c.velocidadVoz;
  }
  salida.teclas = teclasValidas(c.teclas);
  return salida;
}

export function cargarConfig(storage = globalThis.localStorage) {
  try {
    const crudo = storage?.getItem(CLAVE);
    return validarConfig(crudo ? JSON.parse(crudo) : null);
  } catch {
    return validarConfig(null);
  }
}

export function guardarConfig(config, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CLAVE, JSON.stringify(validarConfig(config)));
  } catch {
    /* sin storage: sigue funcionando sin recordar */
  }
}
