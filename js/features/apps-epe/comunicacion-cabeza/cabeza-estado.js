/**
 * cabeza-estado.js
 * Cómo se resume el estado del seguimiento para mostrárselo al profesional.
 * Puro: recibe lecturas ya tomadas de Tracky.
 *
 * Por qué "hay predicción + edad del último puntero" y no la confianza de
 * Tracky: en las pruebas `faceInViewConfidence` se satura en 1,0 y no
 * distingue una cara bien vista de una mal vista.
 */

export const CALIDAD = {
  SIN_INICIAR: 'sin-iniciar',
  PAUSA: 'pausa',
  SIN_CARA: 'sin-cara',
  SIN_SENIAL: 'sin-senial',
  OK: 'ok',
};

/** Sin eventos de puntero por más de esto = el seguimiento no está entregando. */
export const PUNTERO_VIVO_MS = 300;

export function calidadSeguimiento({ iniciada, pausada, hayCara, edadPunteroMs }) {
  if (!iniciada) return CALIDAD.SIN_INICIAR;
  if (pausada) return CALIDAD.PAUSA;
  if (!hayCara) return CALIDAD.SIN_CARA;
  if (edadPunteroMs === null || edadPunteroMs > PUNTERO_VIVO_MS) return CALIDAD.SIN_SENIAL;
  return CALIDAD.OK;
}

const TEXTOS = {
  [CALIDAD.SIN_INICIAR]: 'Seguimiento sin iniciar',
  [CALIDAD.PAUSA]: 'Seguimiento en pausa (F9 o el botón lo reanuda)',
  [CALIDAD.SIN_CARA]: 'La cámara no ve la cara: revisá la luz y el encuadre',
  [CALIDAD.SIN_SENIAL]: 'Cara detectada pero sin movimiento del puntero',
  [CALIDAD.OK]: 'Seguimiento activo',
};

export function textoCalidad(calidad) {
  return TEXTOS[calidad] || '';
}
