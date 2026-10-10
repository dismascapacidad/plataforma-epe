/**
 * toque.js
 * La pantalla táctil como pulsador de Barrido: a qué evento corresponde cada
 * parte de la pantalla y cómo se filtran los toques accidentales.
 *
 * Zonas: la pantalla se divide en franjas verticales iguales, una por evento
 * activo. Con un solo evento (barrido automático) toda la pantalla es ese
 * pulsador; con dos (dirigido) la izquierda avanza y la derecha selecciona.
 *
 * Filtros (los mismos dos que ofrecen los comunicadores dedicados y Switch
 * Control de iOS para evitar activaciones involuntarias, por ejemplo por
 * temblor):
 *   - "Mantener al menos": el toque solo cuenta si se sostiene ese tiempo.
 *   - "Esperar entre toques": después de una activación se ignora todo lo que
 *     llegue durante ese tiempo.
 *
 * Módulo puro: no toca el DOM. El reloj y los temporizadores se pueden
 * inyectar para probarlo sin esperar.
 */

/** Opciones que ofrece la interfaz (en milisegundos). */
export const MANTENER_OPCIONES_MS = [0, 200, 500, 1000];
export const ESPERA_OPCIONES_MS = [0, 300, 500, 1000, 2000];

export const MANTENER_POR_DEFECTO_MS = 0;
export const ESPERA_POR_DEFECTO_MS = 300;

/** Orden de las zonas de izquierda a derecha: lo más usado queda a la derecha. */
const ORDEN_ZONAS = ['reproducir', 'retroceder', 'avanzar', 'seleccionar'];

/**
 * Eventos que tienen zona, en el orden en que aparecen en pantalla.
 * @param {string[]} activos eventos activos (ver eventos.js)
 * @returns {string[]}
 */
export function zonasToque(activos) {
  return ORDEN_ZONAS.filter((id) => activos.includes(id));
}

/**
 * Cómo se nombra cada franja de izquierda a derecha, según cuántas hay.
 * @param {number} cantidad
 * @returns {string[]}
 */
export function nombresZonas(cantidad) {
  if (cantidad <= 1) return ['Toda la pantalla'];
  if (cantidad === 2) return ['Izquierda', 'Derecha'];
  if (cantidad === 3) return ['Izquierda', 'Centro', 'Derecha'];
  return ['Izquierda', 'Centro-izquierda', 'Centro-derecha', 'Derecha'];
}

/**
 * Evento que corresponde a un toque en la posición `x` de un área de `ancho`.
 * Un toque fuera del área se asigna a la zona del borde más cercano.
 * @param {number} x
 * @param {number} ancho
 * @param {string[]} zonas
 * @returns {string|null}
 */
export function zonaDeToque(x, ancho, zonas) {
  if (!zonas.length || !(ancho > 0) || !Number.isFinite(x)) return null;
  const i = Math.floor((x / ancho) * zonas.length);
  return zonas[Math.min(zonas.length - 1, Math.max(0, i))];
}

/**
 * Filtro de toques. Un toque se informa con apoyar() al apoyar el dedo y con
 * soltar() al levantarlo (o cancelar() si el navegador lo interrumpe).
 *
 * @param {{
 *   leer: () => {mantenerMs: number, esperaMs: number},
 *   alActivar: (zona: string) => void,
 *   ahora?: () => number,
 *   programar?: (fn: () => void, ms: number) => any,
 *   cancelarTemporizador?: (id: any) => void,
 * }} op
 */
export function crearFiltroToque(op) {
  const ahora = op.ahora ?? (() => performance.now());
  const programar = op.programar ?? ((fn, ms) => setTimeout(fn, ms));
  const cancelarTemporizador = op.cancelarTemporizador ?? ((id) => clearTimeout(id));

  let ultimaActivacion = -Infinity;
  let apoyado = false; // hay un dedo apoyado (aunque su toque se haya descartado)
  let pendiente = null; // temporizador de "mantener al menos"

  function activar(zona) {
    ultimaActivacion = ahora();
    op.alActivar(zona);
  }

  function limpiarPendiente() {
    if (pendiente !== null) cancelarTemporizador(pendiente);
    pendiente = null;
  }

  return {
    /**
     * @param {string|null} zona evento de la zona tocada
     * @returns {boolean} true si el toque se acepta (ya se activó o está por activarse)
     */
    apoyar(zona) {
      // Un segundo dedo mientras hay uno apoyado no cuenta.
      if (apoyado) return false;
      apoyado = true;
      if (!zona) return false;
      const { mantenerMs, esperaMs } = op.leer();
      if (ahora() - ultimaActivacion < esperaMs) return false;
      if (!(mantenerMs > 0)) {
        activar(zona);
        return true;
      }
      pendiente = programar(() => {
        pendiente = null;
        activar(zona);
      }, mantenerMs);
      return true;
    },
    /** Se levantó el dedo: si todavía faltaba tiempo de "mantener", el toque no cuenta. */
    soltar() {
      apoyado = false;
      limpiarPendiente();
    },
    /** El navegador interrumpió el toque. */
    cancelar() {
      apoyado = false;
      limpiarPendiente();
    },
  };
}
