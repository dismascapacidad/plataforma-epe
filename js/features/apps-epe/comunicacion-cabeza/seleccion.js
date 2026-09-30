/**
 * seleccion.js
 * Máquinas de selección: pulsador y permanencia (dwell). Puras: el tiempo se
 * pasa por parámetro, no hay timers ni DOM, así que se testean sin navegador.
 *
 * Contrato común: `alMover(celdaId|null, t)` cuando el puntero cambia de
 * celda (o sale de todas), y `tick(t)` periódicamente. Devuelven
 * `{ seleccion, progreso }`: `seleccion` es el id elegido en ese instante (o
 * null) y `progreso` va de 0 a 1 (solo dwell; para dibujar el anillo).
 */

/**
 * Pulsador: la celda elegida es la que está bajo el puntero cuando se
 * presiona la tecla. Sin puntero sobre una celda, no elige nada y se avisa
 * el motivo, que le sirve al profesional ("fuera" vs "sin puntero").
 */
export function crearPulsador() {
  let celda = null;
  let hayPuntero = false;
  return {
    modo: 'pulsador',
    alMover(id, _t, { punteroVivo = true } = {}) {
      celda = id;
      hayPuntero = punteroVivo;
      return { seleccion: null, progreso: 0 };
    },
    tick() {
      return { seleccion: null, progreso: 0 };
    },
    /** @returns {{seleccion:string|null, motivo:'ok'|'fuera'|'sin-puntero'}} */
    alPresionar() {
      if (celda) return { seleccion: celda, motivo: 'ok' };
      return { seleccion: null, motivo: hayPuntero ? 'fuera' : 'sin-puntero' };
    },
    reiniciar() {
      celda = null;
    },
  };
}

/**
 * Dwell: se elige la celda tras `ms` ms de permanencia continua. Después de
 * elegir, esa celda queda bloqueada hasta que el puntero salga de ella (si no,
 * elegiría la misma letra en bucle). Al aparecer/cambiar de celda el conteo
 * arranca de cero.
 *
 * `toleranciaSalidaMs`: una salida más corta que esto (temblor que roza el
 * borde) no reinicia el conteo. Es la defensa principal contra el temblor de
 * la cabeza; por defecto 150 ms.
 */
export function crearDwell({ ms = 1200, toleranciaSalidaMs = 150 } = {}) {
  let celda = null; // celda sobre la que se cuenta
  let desde = 0; // cuándo empezó el conteo
  let bloqueada = null; // celda ya elegida, esperando que el puntero salga
  let salioEn = null; // cuándo el puntero dejó `celda` (para la tolerancia)

  function progreso(t) {
    if (!celda || bloqueada === celda) return 0;
    return Math.min(1, Math.max(0, (t - desde) / ms));
  }

  return {
    modo: 'dwell',
    get ms() {
      return ms;
    },
    alMover(id, t) {
      if (id === celda) {
        salioEn = null; // volvió a la misma celda dentro de la tolerancia
        return { seleccion: null, progreso: progreso(t) };
      }
      if (id === null) {
        // Salió de todas las celdas: solo se pierde el conteo si supera la tolerancia (ver tick).
        if (celda && salioEn === null) salioEn = t;
        return { seleccion: null, progreso: progreso(t) };
      }
      // Entró a otra celda.
      if (bloqueada && id !== bloqueada) bloqueada = null;
      celda = id;
      desde = t;
      salioEn = null;
      return { seleccion: null, progreso: 0 };
    },
    tick(t) {
      if (celda && salioEn !== null && t - salioEn > toleranciaSalidaMs) {
        if (bloqueada === celda) bloqueada = null;
        celda = null;
        salioEn = null;
      }
      if (!celda || bloqueada === celda) return { seleccion: null, progreso: 0 };
      const p = progreso(t);
      if (p >= 1 && salioEn === null) {
        bloqueada = celda;
        return { seleccion: celda, progreso: 1 };
      }
      return { seleccion: null, progreso: p };
    },
    reiniciar() {
      celda = null;
      bloqueada = null;
      salioEn = null;
    },
  };
}

export function crearSeleccion(modo, opciones = {}) {
  return modo === 'dwell' ? crearDwell(opciones) : crearPulsador();
}
