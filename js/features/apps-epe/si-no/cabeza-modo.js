/**
 * cabeza-modo.js
 * Acceso con seguimiento de cabeza (Tracky Mouse) para Si-No: el puntero lo
 * mueve la cabeza y la casilla se elige con un pulsador (K o Espacio) o por
 * permanencia (dwell). Reutiliza las piezas de la app "Comunicación con
 * seguimiento de cabeza": cabeza.js (adaptador de Tracky), seleccion.js
 * (máquinas pulsador/dwell) y cabeza-estado.js / sensibilidad.js.
 *
 * La cámara se procesa en el dispositivo: no se envía ni se guarda imagen.
 * Este módulo solo une DOM, cámara y selección; no sabe de textos ni voz.
 */
import { crearCabeza } from '../comunicacion-cabeza/cabeza.js';
import { crearSeleccion } from '../comunicacion-cabeza/seleccion.js';
import { CALIDAD, textoCalidad } from '../comunicacion-cabeza/cabeza-estado.js';
import { factorDesdeSlider } from '../comunicacion-cabeza/sensibilidad.js';
import {
  validarTeclaRecentrar,
  normalizarTecla,
  etiquetaTecla,
} from '../comunicacion-cabeza/config.js';
import { DWELL_OPCIONES_MS } from './config.js';
import { TECLAS_PULSADOR_CABEZA } from './entradas.js';

const ESTILOS_VISTA = [
  'top',
  'left',
  'width',
  'height',
  'right',
  'bottom',
  'maxHeight',
  'visibility',
];
const coma = (n, d = 1) => n.toFixed(d).replace('.', ',');

/**
 * @param {{
 *   el: Record<string, any>,
 *   tablero: ReturnType<typeof import('./tablero.js').crearTablero>,
 *   cfg: import('./config.js').ConfigCabeza,
 *   guardar: () => void,
 *   alElegir: (id: string) => void,
 *   aviso: (texto: string, ms?: number) => void,
 * }} op
 */
export function crearModoCabeza({ el, tablero, cfg, guardar, alElegir, aviso }) {
  const ahora = () => performance.now();
  const st = {
    cabeza: /** @type {any} */ (null),
    activo: false,
    seleccion: /** @type {any} */ (null),
    celdaBajoPuntero: /** @type {string|null} */ (null),
    capturando: false,
  };

  const usaMouse = () => !!el.usarMouse.checked;
  const camaraAbierta = () => !el.modalCamara.hidden;

  // ── Interfaz de configuración ────────────────────────────────────────
  function pintarConfig() {
    el.radiosSeleccion.forEach((r) => (r.checked = r.value === cfg.seleccion));
    el.dwell.value = String(cfg.dwellMs);
    el.descanso.checked = cfg.descanso;
    el.ocultar.checked = cfg.ocultarVista;
    el.dwellWrap.hidden = cfg.seleccion !== 'dwell';
    el.descansoWrap.hidden = cfg.seleccion !== 'dwell';
    el.recentrarTecla.textContent = etiquetaTecla(cfg.teclaRecentrar);
    el.quitarRecentrar.disabled = !cfg.teclaRecentrar;
  }

  el.radiosSeleccion.forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      cfg.seleccion = r.value === 'dwell' ? 'dwell' : 'pulsador';
      guardar();
      pintarConfig();
      el.alCambiarModo?.();
    }),
  );
  el.dwell.addEventListener('change', () => {
    const ms = Number(el.dwell.value);
    if (DWELL_OPCIONES_MS.includes(ms)) cfg.dwellMs = ms;
    guardar();
  });
  el.descanso.addEventListener('change', () => {
    cfg.descanso = el.descanso.checked;
    guardar();
  });
  el.ocultar.addEventListener('change', () => {
    cfg.ocultarVista = el.ocultar.checked;
    guardar();
    aplicarVisibilidadVista();
  });

  // ── Tecla de recentrar ───────────────────────────────────────────────
  function terminarCaptura(mensaje = '', alerta = false) {
    st.capturando = false;
    el.recentrarTecla.classList.remove('is-capturando');
    pintarConfig();
    el.recentrarAviso.classList.toggle('is-alerta', alerta);
    el.recentrarAviso.textContent = mensaje;
    el.alCambiarModo?.();
  }
  el.asignarRecentrar.addEventListener('click', () => {
    st.capturando = true;
    el.recentrarTecla.textContent = 'Presioná una tecla…';
    el.recentrarTecla.classList.add('is-capturando');
    el.recentrarAviso.classList.remove('is-alerta');
    el.recentrarAviso.textContent = 'Esc cancela.';
  });
  el.quitarRecentrar.addEventListener('click', () => {
    cfg.teclaRecentrar = null;
    guardar();
    terminarCaptura('Sin tecla de recentrado.');
  });

  // ── Puntero y selección ──────────────────────────────────────────────
  function nuevaSeleccion() {
    st.seleccion = crearSeleccion(cfg.seleccion, { ms: cfg.dwellMs });
    tablero.limpiarCabeza();
    st.celdaBajoPuntero = null;
  }

  function alPuntero(x, y, fuente) {
    if (fuente === 'cabeza' && usaMouse()) return;
    if (fuente === 'mouse' && !usaMouse()) return;
    if (!st.activo || !st.seleccion) return;
    const id = tablero.celdaEnPunto(x, y);
    if (id !== st.celdaBajoPuntero) {
      tablero.marcarBajoPuntero(id);
      st.celdaBajoPuntero = id;
    }
    st.seleccion.alMover(id, ahora(), { punteroVivo: true });
  }
  window.addEventListener('pointermove', (e) => alPuntero(e.clientX, e.clientY, 'mouse'));

  // Dwell: el reloj corre aunque el puntero no se mueva.
  setInterval(() => {
    if (!st.activo || cfg.seleccion !== 'dwell' || !st.seleccion) return;
    const r = st.seleccion.tick(ahora());
    tablero.progreso(st.celdaBajoPuntero, r.progreso);
    if (r.seleccion) alElegir(r.seleccion);
  }, 40);

  // Cámara sin ver la cara o en pausa: con pulsador cuenta como "sin puntero".
  function punteroVivo() {
    if (usaMouse()) return true;
    const e = st.cabeza?.estado();
    if (!e) return false;
    return ![CALIDAD.PAUSA, CALIDAD.SIN_CARA, CALIDAD.SIN_INICIAR].includes(e.calidad);
  }

  function presionarPulsador() {
    if (!punteroVivo()) st.seleccion.alMover(null, ahora(), { punteroVivo: false });
    const r = st.seleccion.alPresionar();
    if (r.seleccion) alElegir(r.seleccion);
    else {
      aviso(
        r.motivo === 'sin-puntero'
          ? 'No hay puntero: la cámara no ve la cara o el seguimiento está en pausa.'
          : 'El puntero no está sobre ninguna casilla.',
        1800,
      );
    }
  }

  function recentrar() {
    if (usaMouse()) return aviso('Con el mouse no hace falta recentrar.', 1500);
    if (!st.cabeza?.recentrar()) {
      return aviso('No se puede recentrar: el seguimiento está en pausa o sin iniciar.', 1500);
    }
    st.seleccion?.reiniciar();
    tablero.limpiarCabeza();
    st.celdaBajoPuntero = null;
    aviso('Recentrado', 1500);
    el.centro.hidden = true;
    void el.centro.offsetWidth; // reinicia la animación
    el.centro.hidden = false;
    setTimeout(() => (el.centro.hidden = true), 700);
  }

  /**
   * Teclas del modo cabeza. Devuelve true si la tecla se usó.
   * @param {KeyboardEvent} ev
   */
  function alTecla(ev) {
    if (st.capturando) {
      ev.preventDefault();
      if (ev.key === 'Escape') {
        terminarCaptura();
        return true;
      }
      const r = validarTeclaRecentrar(ev.key);
      if (!r.ok) {
        el.recentrarAviso.classList.add('is-alerta');
        el.recentrarAviso.textContent = `${r.motivo} Probá de nuevo o Esc para cancelar.`;
        return true;
      }
      cfg.teclaRecentrar = r.tecla ?? null;
      guardar();
      terminarCaptura(`Tecla asignada: ${etiquetaTecla(cfg.teclaRecentrar)}.`);
      return true;
    }
    if (ev.key === 'F9') {
      st.cabeza?.notificarPausaManual();
      return true;
    }
    if (!st.activo || ev.repeat) return false;
    if (cfg.teclaRecentrar && normalizarTecla(ev.key) === cfg.teclaRecentrar) {
      ev.preventDefault();
      recentrar();
      return true;
    }
    if (cfg.seleccion === 'pulsador' && TECLAS_PULSADOR_CABEZA.includes(ev.key.toLowerCase())) {
      ev.preventDefault(); // que Espacio no scrollee ni active el botón con foco
      presionarPulsador();
      return true;
    }
    return false;
  }

  // ── Seguimiento (Tracky) ─────────────────────────────────────────────
  function estadoTexto(texto, alerta = false) {
    el.estado.textContent = texto;
    el.estado.classList.toggle('is-alerta', alerta);
  }

  el.iniciar.addEventListener('click', async () => {
    el.iniciar.disabled = true;
    try {
      if (!st.cabeza) {
        st.cabeza = await crearCabeza({
          host: el.trackyHost,
          alPuntero: (x, y) => alPuntero(x, y, 'cabeza'),
        });
      }
      await st.cabeza.iniciar({ alEstado: (t) => estadoTexto(t) });
      el.iniciar.textContent = 'Seguimiento iniciado';
      el.pausa.hidden = false;
      estadoTexto('Activo. F9 o el botón pausan y reanudan.');
      abrirCamara(); // lo que sigue es encuadrar y, si hace falta, ajustar la sensibilidad
    } catch (err) {
      estadoTexto(`No se pudo iniciar: ${String(/** @type {any} */ (err)?.message || err)}`, true);
      el.iniciar.disabled = false;
      st.cabeza = null;
    }
  });
  el.pausa.addEventListener('click', () => {
    if (!st.cabeza) return;
    if (st.cabeza.estaPausada()) st.cabeza.reanudar();
    else st.cabeza.pausar();
  });
  el.usarMouse.addEventListener('change', () => {
    st.seleccion?.reiniciar();
    el.alCambiarModo?.();
  });

  // ── Cámara y sensibilidad ────────────────────────────────────────────
  // La vista de cámara de Tracky es un elemento fijo: no se la puede mover en
  // el DOM (el navegador pausaría el video). Con el modal de cámara abierto se
  // la acomoda encima de su hueco; si no, vuelve a su rincón o se oculta.
  function acomodarVista() {
    const host = el.trackyHost;
    if (host.classList.contains('oculto') || !host.firstElementChild || !camaraAbierta()) {
      ESTILOS_VISTA.forEach((p) => (host.style[p] = ''));
      return;
    }
    const s = el.vistaSlot.getBoundingClientRect();
    const m = el.modalCamaraCaja.getBoundingClientRect();
    const visible = s.top >= m.top && s.bottom <= m.bottom && s.width > 0;
    host.style.visibility = visible ? '' : 'hidden';
    host.style.top = `${s.top}px`;
    const ancho = Math.min(s.width, 600);
    host.style.left = `${s.left + (s.width - ancho) / 2}px`;
    host.style.width = `${ancho}px`;
    host.style.height = `${s.height}px`;
    host.style.maxHeight = `${s.height}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';
  }
  setInterval(acomodarVista, 150);
  window.addEventListener('resize', acomodarVista);

  function aplicarVisibilidadVista() {
    const oculto = camaraAbierta() ? false : st.activo ? cfg.ocultarVista : true;
    el.trackyHost.classList.toggle('oculto', oculto);
    acomodarVista();
  }

  function textoSens(v) {
    return `${coma(factorDesdeSlider(v), 2)}× (${v === 50 ? 'de fábrica' : v < 50 ? 'más lento' : 'más rápido'})`;
  }
  function sincronizarSensibilidad() {
    const v = st.cabeza?.getSensibilidad?.();
    const disponible = v !== null && v !== undefined;
    el.sens.disabled = !disponible;
    el.sensAviso.textContent = disponible
      ? 'Un cambio se nota enseguida: mové la cabeza y mirá el puntero.'
      : 'Se habilita al iniciar el seguimiento.';
    if (disponible) {
      el.sens.value = String(v);
      el.sensOut.textContent = textoSens(v);
    } else {
      el.sensOut.textContent = '—';
    }
  }
  el.sens.addEventListener('input', () => {
    const v = Number(el.sens.value);
    el.sensOut.textContent = textoSens(v);
    st.cabeza?.setSensibilidad(v);
  });

  function abrirCamara() {
    el.modalCamara.hidden = false;
    sincronizarSensibilidad();
    aplicarVisibilidadVista();
  }
  function cerrarCamara() {
    el.modalCamara.hidden = true;
    aplicarVisibilidadVista();
  }
  el.abrirCamara.addEventListener('click', abrirCamara);
  el.cerrarCamara.addEventListener('click', cerrarCamara);

  // ── Indicador de calidad (chip del encabezado) ───────────────────────
  function refrescarChip() {
    let calidad;
    let texto;
    if (usaMouse()) {
      calidad = 'mouse';
      texto = 'Mouse (modo de prueba)';
    } else {
      const e = st.cabeza?.estado();
      calidad = e ? e.calidad : CALIDAD.SIN_INICIAR;
      texto = textoCalidad(calidad);
    }
    el.chip.textContent = texto;
    el.chip.dataset.calidad = calidad;
    el.pausa.textContent = st.cabeza?.estaPausada() ? 'Reanudar' : 'Pausar';
  }
  setInterval(refrescarChip, 300);

  pintarConfig();
  refrescarChip();

  return {
    alTecla,
    camaraAbierta,
    cerrarCamara,
    capturandoTecla: () => st.capturando,
    /** ¿Se puede empezar? Hace falta seguimiento iniciado o el mouse de prueba. */
    listoParaEmpezar() {
      return usaMouse() || !!st.cabeza;
    },
    activar() {
      st.activo = true;
      el.modalCamara.hidden = true;
      nuevaSeleccion();
      aplicarVisibilidadVista();
      el.chip.hidden = false;
    },
    desactivar() {
      st.activo = false;
      tablero.limpiarCabeza();
      st.celdaBajoPuntero = null;
      el.chip.hidden = true;
      aplicarVisibilidadVista();
    },
    pintarConfig,
  };
}
