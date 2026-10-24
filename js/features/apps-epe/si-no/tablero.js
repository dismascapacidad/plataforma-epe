/**
 * tablero.js
 * El tablero de juego: dos o tres casillas grandes (imagen + texto) y, en el
 * modo cabeza con permanencia, un espacio de descanso que no elige nada
 * (ver reparto() en entradas.js para su ubicación y medidas).
 *
 * Todo el texto del usuario se pone con textContent y la imagen solo si pasa
 * esImagenValida(): nunca innerHTML con datos del usuario.
 */
import { esImagenValida } from './config.js';
import { reparto } from './entradas.js';

const CLASE_BAJO_PUNTERO = 'is-bajo-puntero';
const CLASE_ELEGIDA = 'is-elegida';
const MS_ELEGIDA = 1100;

/**
 * @param {HTMLElement} raiz contenedor del tablero
 */
export function crearTablero(raiz) {
  /** @type {Map<string, HTMLElement>} */
  const celdaEls = new Map();
  /** @type {HTMLElement[]} */
  let orden = [];
  let franja = /** @type {HTMLElement|null} */ (null);
  let cantidad = 0;
  let conDescanso = false;
  const temporizadores = new Map();

  const zona = document.createElement('div');
  zona.className = 'epe-sn-celdas';
  raiz.appendChild(zona);

  function acomodar() {
    if (!cantidad) return;
    const r = reparto(cantidad, zona.clientWidth, zona.clientHeight, conDescanso);
    zona.style.gridTemplateColumns = r.columnas;
    zona.style.gridTemplateRows = r.filas;
    orden.forEach((el, i) => {
      const c = r.celdas[i];
      el.style.gridColumn = String(c.col);
      el.style.gridRow = c.filas > 1 ? `${c.fila} / span ${c.filas}` : String(c.fila);
    });
    if (franja && r.descanso) {
      franja.style.gridColumn = String(r.descanso.col);
      franja.style.gridRow = String(r.descanso.fila);
      franja.classList.toggle('vertical', r.descanso.vertical);
    }
  }

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(acomodar).observe(zona);

  /**
   * @param {{id:string, texto:string, imagen:string|null}[]} celdas
   * @param {{franjaDescanso?:boolean}} [op]
   */
  function dibujar(celdas, { franjaDescanso = false } = {}) {
    zona.textContent = '';
    celdaEls.clear();
    temporizadores.forEach((t) => clearTimeout(t));
    temporizadores.clear();
    franja = null;
    cantidad = celdas.length;
    conDescanso = franjaDescanso && cantidad > 0;
    orden = [];
    celdas.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'epe-sn-celda';
      b.dataset.celda = c.id;
      b.setAttribute('aria-label', c.texto || `Casilla ${i + 1}`);

      const marco = document.createElement('span');
      marco.className = 'epe-sn-imagen';
      if (esImagenValida(c.imagen)) {
        const img = document.createElement('img');
        img.src = /** @type {string} */ (c.imagen);
        img.alt = '';
        img.draggable = false;
        marco.appendChild(img);
      } else {
        marco.classList.add('sin-imagen');
      }
      b.appendChild(marco);

      const t = document.createElement('span');
      t.className = 'epe-sn-texto';
      t.textContent = c.texto;
      if (!c.texto) t.hidden = true;
      b.appendChild(t);

      zona.appendChild(b);
      celdaEls.set(c.id, b);
      orden.push(b);
    });
    if (conDescanso) {
      franja = document.createElement('div');
      franja.className = 'epe-sn-descanso';
      franja.setAttribute('aria-hidden', 'true');
      franja.title = 'Descanso: acá el puntero no elige nada';
      franja.textContent = 'Descanso';
      zona.appendChild(franja);
    }
    acomodar();
  }

  return {
    dibujar,
    acomodar,
    /** Opciones para el motor de barrido: en el orden en que se muestran. */
    objetivos() {
      return orden.map((el) => ({ id: /** @type {string} */ (el.dataset.celda), el }));
    },
    celdaEl: (id) => celdaEls.get(id) ?? null,
    /** id de la casilla bajo un punto de la pantalla, o null. */
    celdaEnPunto(x, y) {
      const e = document.elementFromPoint(x, y);
      const celda = /** @type {HTMLElement|null|undefined} */ (e?.closest?.('[data-celda]'));
      return celda && raiz.contains(celda) ? (celda.dataset.celda ?? null) : null;
    },
    marcarBajoPuntero(id) {
      celdaEls.forEach((el, k) => el.classList.toggle(CLASE_BAJO_PUNTERO, k === id));
    },
    /** Progreso de permanencia (0 a 1) de una casilla; las demás a 0. */
    progreso(id, p) {
      celdaEls.forEach((el, k) => el.style.setProperty('--p', k === id ? String(p) : '0'));
    },
    limpiarCabeza() {
      celdaEls.forEach((el) => {
        el.classList.remove(CLASE_BAJO_PUNTERO);
        el.style.setProperty('--p', '0');
      });
    },
    /** Marca la casilla elegida un momento (confirmación visual de la selección). */
    elegida(id) {
      const el = celdaEls.get(id);
      if (!el) return;
      el.classList.add(CLASE_ELEGIDA);
      clearTimeout(temporizadores.get(id));
      temporizadores.set(
        id,
        setTimeout(() => el.classList.remove(CLASE_ELEGIDA), MS_ELEGIDA),
      );
    },
    /** Avisa cuando el barrido resalta otra casilla (para leerla en voz alta). */
    alResaltar(cb) {
      const obs = new MutationObserver((lista) => {
        for (const m of lista) {
          const el = /** @type {HTMLElement} */ (m.target);
          if (
            el.classList.contains('epe-scan-actual') &&
            !(m.oldValue ?? '').includes('epe-scan-actual')
          ) {
            cb(/** @type {string} */ (el.dataset.celda));
          }
        }
      });
      obs.observe(zona, {
        attributes: true,
        attributeFilter: ['class'],
        attributeOldValue: true,
        subtree: true,
      });
      return () => obs.disconnect();
    },
    vaciar() {
      dibujar([]);
    },
  };
}
