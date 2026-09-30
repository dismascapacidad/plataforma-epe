/**
 * sensibilidad.js
 * Mapeo entre un único control de "Sensibilidad" (0 a 100) y los dos
 * sliders de Tracky (horizontal y vertical). Puro y sin DOM.
 *
 * Por qué así: Tracky expone sensibilidad horizontal y vertical por
 * separado (0 a 180; de fábrica 25 y 50, es decir, vertical el doble). Para el
 * profesional alcanza con un solo control que las mueve juntas manteniendo
 * esa proporción; el ajuste fino queda en el panel completo de Tracky. El
 * control es logarítmico: cada paso multiplica por lo mismo, que es como se
 * percibe un cambio de velocidad (de 0,25× a 4×, con 50 = valor de fábrica).
 */

export const BASE = { x: 25, y: 50 };
export const MAX_TRACKY = 180;
export const SENS_MIN = 0;
export const SENS_MAX = 100;
export const SENS_FABRICA = 50;

const PASOS_POR_DUPLICACION = 25; // 25 pasos del slider = el doble de velocidad

const acotar = (n, min, max) => Math.min(max, Math.max(min, n));

/** Factor de velocidad (1 = de fábrica) para un valor del slider. */
export function factorDesdeSlider(v) {
  return 2 ** ((acotar(v, SENS_MIN, SENS_MAX) - SENS_FABRICA) / PASOS_POR_DUPLICACION);
}

/** Valores para los sliders de Tracky (en sus unidades) dado el slider nuestro. */
export function valoresTracky(v) {
  const f = factorDesdeSlider(v);
  return {
    x: acotar(Math.round(BASE.x * f), 0, MAX_TRACKY),
    y: acotar(Math.round(BASE.y * f), 0, MAX_TRACKY),
  };
}

/** Valor de nuestro slider que corresponde al slider horizontal de Tracky. */
export function sliderDesdeX(x) {
  if (!(x > 0)) return SENS_MIN;
  return Math.round(
    acotar(SENS_FABRICA + PASOS_POR_DUPLICACION * Math.log2(x / BASE.x), SENS_MIN, SENS_MAX),
  );
}
