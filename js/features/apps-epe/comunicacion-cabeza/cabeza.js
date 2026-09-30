/**
 * cabeza.js
 * Adaptador de Tracky Mouse (seguimiento de cabeza por cámara).
 *
 * Todo lo que sabemos de Tracky y que no es obvio queda acá, para que el
 * resto de la app no dependa de sus detalles:
 * - Se carga recién al iniciar (import dinámico): las otras apps no pagan
 *   el peso de la librería.
 * - Tracky se sirve como archivos estáticos (`vendor/tracky-mouse`): no se
 *   puede empaquetar porque resuelve sus dependencias respecto de su propia URL.
 * - Tras dar el permiso de cámara puede quedar en pausa por una carrera
 *   interna; se espera a que el video esté andando y, si nadie lo pausó a
 *   propósito, se reanuda una vez.
 * - `_setPaused`, `_video`, `_facemeshPrediction`, etc. son miembros con
 *   guion bajo (no documentados como API pública): por eso están
 *   confinados a este archivo, y la versión de Tracky está fija en vendor/.
 */
import { calidadSeguimiento } from './cabeza-estado.js';
import { valoresTracky, sliderDesdeX } from './sensibilidad.js';

const RUTA_TRACKY = new URL('../../../../vendor/tracky-mouse/', import.meta.url);

export async function crearCabeza({ host, alPuntero, ahora = () => performance.now() }) {
  // Tracky no trae tipos: se lo trata como `any` (ver el aviso de miembros con guion bajo arriba).
  const { TrackyMouse } = /** @type {any} */ (
    await import(/* @vite-ignore */ new URL('src/tracky-mouse.js', RUTA_TRACKY).href)
  );

  /** @type {any} */
  let inst = null;
  let pausaManual = false;
  let recentrando = false; // la pausa de un instante que usamos para recentrar no es una pausa real
  let ultimoPunteroT = null;
  const info = { reanudadoAutomaticamente: false, cargaMs: null, videoListoMs: null };

  TrackyMouse.onPointerMove = (x, y) => {
    ultimoPunteroT = ahora();
    alPuntero(x, y);
  };

  /** Cambia un slider del panel de Tracky como si lo moviera la persona. */
  function ponerSlider(clase, valor) {
    const i = /** @type {HTMLInputElement|null} */ (host.querySelector(`.tracky-mouse-${clase}`));
    if (!i) return false;
    i.value = String(valor);
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true })); // Tracky guarda en "change"
    return true;
  }

  function pausada() {
    return !inst || !!inst._getPaused();
  }

  return {
    info,
    /** Carga modelos, pide la cámara y espera a que haya imagen. */
    /** @param {{alEstado?: (texto: string) => void}} [op] */
    async iniciar({ alEstado = (_texto) => {} } = {}) {
      const t0 = ahora();
      alEstado('Cargando modelos de seguimiento…');
      await TrackyMouse.loadDependencies();
      info.cargaMs = Math.round(ahora() - t0);
      inst = TrackyMouse.init(host);
      await inst._waitForSettingsLoaded();
      alEstado('Pidiendo permiso de cámara…');
      await Promise.resolve(TrackyMouse.useCamera());
      alEstado('Esperando la imagen de la cámara…');
      const tv = ahora();
      while (ahora() - tv < 30000) {
        const v = inst._video;
        if (v && v.readyState >= 2 && v.videoWidth > 0) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      info.videoListoMs = Math.round(ahora() - t0);
      inst._setPaused(false);
      setTimeout(() => {
        if (inst._getPaused() && !pausaManual) {
          inst._setPaused(false);
          info.reanudadoAutomaticamente = true;
        }
      }, 2000);
    },
    pausar() {
      if (!inst) return;
      pausaManual = true;
      inst._setPaused(true);
    },
    reanudar() {
      if (!inst) return;
      pausaManual = false;
      inst._setPaused(false);
    },
    /** F9 lo maneja Tracky; solo registramos que fue a propósito. */
    notificarPausaManual() {
      if (inst) pausaManual = !inst._getPaused();
    },
    /**
     * Devuelve el puntero al centro de la pantalla.
     * Tracky recentra el puntero cada vez que se pausa/reanuda (no hay una
     * llamada directa: la posición es interna). Se pausa y se reanuda al
     * instante; la postura actual de la cabeza pasa a ser la referencia.
     * Con el seguimiento en pausa (a propósito) no hace nada: no se lo
     * reactiva sin querer.
     * @returns {boolean} true si recentró
     */
    recentrar() {
      if (!inst || inst._getPaused() || recentrando) return false;
      recentrando = true;
      inst._setPaused(true);
      setTimeout(() => {
        try {
          if (!pausaManual) inst?._setPaused(false);
        } finally {
          recentrando = false;
        }
      }, 50);
      return true;
    },
    /**
     * Sensibilidad (0 a 100, 50 = de fábrica). Mueve los sliders horizontal y
     * vertical del propio panel de Tracky: así hay una sola fuente de verdad
     * y Tracky guarda el valor por su cuenta. Es lo único que depende de las
     * clases del panel de Tracky (`tracky-mouse-sensitivity-x/-y`).
     * @returns {boolean} false si el panel todavía no existe
     */
    setSensibilidad(v) {
      const { x, y } = valoresTracky(v);
      const okX = ponerSlider('sensitivity-x', x);
      const okY = ponerSlider('sensitivity-y', y);
      return okX && okY;
    },
    /** @returns {number|null} sensibilidad actual (0 a 100) o null sin panel */
    getSensibilidad() {
      const i = host.querySelector('.tracky-mouse-sensitivity-x');
      return i ? sliderDesdeX(Number(/** @type {HTMLInputElement} */ (i).value)) : null;
    },
    estaPausada: pausada,
    iniciada: () => !!inst,
    /** Lectura para el indicador de calidad y las métricas. */
    estado() {
      const pred = inst?._facemeshPrediction;
      const edadPunteroMs = ultimoPunteroT === null ? null : ahora() - ultimoPunteroT;
      const base = {
        iniciada: !!inst,
        pausada: pausada() && !recentrando,
        hayCara: !!pred,
        edadPunteroMs,
      };
      return { ...base, calidad: calidadSeguimiento(base) };
    },
    camara() {
      const track = inst?._video?.srcObject?.getVideoTracks?.()[0];
      if (!track) return null;
      const s = track.getSettings();
      return { etiqueta: track.label, ancho: s.width, alto: s.height, fps: s.frameRate };
    },
    /** Oculta la vista de cámara y los ajustes (Tracky sigue andando). */
    ocultarVista(oculta) {
      host.classList.toggle('oculto', !!oculta);
    },
    destruir() {
      try {
        inst?.dispose?.();
      } finally {
        inst = null;
      }
    },
  };
}
