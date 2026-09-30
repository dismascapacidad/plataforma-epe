/**
 * main.js
 * App EpE — Comunicación con seguimiento de cabeza.
 *
 * Para qué sirve: que un profesional pruebe con una persona si puede
 * comunicarse escribiendo con el movimiento de la cabeza (Tracky Mouse,
 * cámara web) y eligiendo con un pulsador (tecla) o por permanencia
 * (dwell), y que la app reproduzca el texto por voz. Al final de cada tramo
 * de uso queda un resumen medido para decidir si el equipo sirve.
 *
 * Este archivo solo une piezas (DOM, cámara, voz, storage). La lógica está
 * en módulos puros con tests: grilla, texto, voz, seleccion, metricas.
 */
import { medirTablero, celdasTablero, plantillaTablero } from './grilla.js';
import { aplicarCelda, textoParaHablar } from './texto.js';
import { ordenarVoces, elegirVoz } from './voz.js';
import { crearSeleccion } from './seleccion.js';
import { crearSesion, resumenTexto, desvioEstandar } from './metricas.js';
import { CALIDAD, textoCalidad } from './cabeza-estado.js';
import {
  cargarConfig,
  guardarConfig,
  validarTeclaRecentrar,
  normalizarTecla,
  etiquetaTecla,
} from './config.js';
import { crearCabeza } from './cabeza.js';
import { crearVoz } from './voz-web.js';
import { factorDesdeSlider } from './sensibilidad.js';

const GAP = 8;
const TECLAS_PULSADOR = ['k', ' '];

/** Widget "Configurar dispositivo" (script propio; puede no haber cargado). */
function dispositivoWidget() {
  return /** @type {any} */ (window).EpeConfigurarDispositivo;
}

function iniciar(raiz) {
  const q = (s) => raiz.querySelector(s);
  const el = {
    config: q('[data-cc-config]'),
    empezar: q('[data-cc-empezar]'),
    avisoEmpezar: q('[data-cc-aviso-empezar]'),
    iniciarCabeza: q('[data-cc-iniciar-cabeza]'),
    pausa: q('[data-cc-pausa]'),
    estadoCabeza: q('[data-cc-estado-cabeza]'),
    ocultar: q('[data-cc-ocultar]'),
    usarMouse: q('[data-cc-usar-mouse]'),
    quietud: q('[data-cc-quietud]'),
    quietudRes: q('[data-cc-quietud-res]'),
    dwellWrap: q('[data-cc-dwell-wrap]'),
    dwell: q('[data-cc-dwell]'),
    celda: q('[data-cc-celda]'),
    celdaOut: q('[data-cc-celda-out]'),
    celdaAviso: q('[data-cc-celda-aviso]'),
    voz: q('[data-cc-voz]'),
    vel: q('[data-cc-vel]'),
    velOut: q('[data-cc-vel-out]'),
    probarVoz: q('[data-cc-probar-voz]'),
    vozAviso: q('[data-cc-voz-aviso]'),
    modalCamara: q('[data-cc-modal-camara]'),
    abrirCamara: q('[data-cc-abrir-camara]'),
    cerrarCamara: q('[data-cc-cerrar-camara]'),
    modalResumen: q('[data-cc-modal-resumen]'),
    abrirResumen: q('[data-cc-abrir-resumen]'),
    cerrarResumen: q('[data-cc-cerrar-resumen]'),
    sens: q('[data-cc-sens]'),
    sensOut: q('[data-cc-sens-out]'),
    sensAviso: q('[data-cc-sens-aviso]'),
    ajustesTracky: q('[data-cc-ajustes-tracky]'),
    layout: q('[data-cc-layout]'),
    descansoWrap: q('[data-cc-descanso-wrap]'),
    descanso: q('[data-cc-descanso]'),
    descansoTam: q('[data-cc-descanso-tam]'),
    resumen: q('[data-cc-resumen]'),
    copiarResumen: q('[data-cc-copiar-resumen]'),
    trackyHost: q('[data-cc-tracky-host]'),
    chip: q('[data-cc-chip]'),
    texto: q('[data-cc-texto]'),
    estadoVoz: q('[data-cc-estado-voz]'),
    grilla: q('[data-cc-grilla]'),
    btnDispositivo: q('[data-configurar-dispositivo]'),
    recentrarTecla: q('[data-cc-recentrar-tecla]'),
    asignarRecentrar: q('[data-cc-asignar-recentrar]'),
    quitarRecentrar: q('[data-cc-quitar-recentrar]'),
    recentrarAviso: q('[data-cc-recentrar-aviso]'),
    centro: q('[data-cc-centro]'),
    vistaSlot: q('[data-cc-vista-slot]'),
    modalCamaraCaja: q('[data-cc-modal-camara] .epe-cc-modal'),
    btnRestaurar: q('[data-restaurar-dispositivo]'),
    volver: Array.from(raiz.querySelectorAll('[data-volver-apps]')),
    radiosSeleccion: Array.from(raiz.querySelectorAll('[name=cc-seleccion]')),
  };

  const config = cargarConfig();
  let celdas = celdasTablero(config.layout);
  const celdaEls = new Map();
  const voz = crearVoz();
  const coma = (n, d = 1) => n.toFixed(d).replace('.', ',');

  const st = {
    cabeza: null,
    jugando: false,
    iniciado: false,
    texto: '',
    tramo: null, // sesión del tramo en curso (entre "Empezar" y el próximo Esc)
    historial: [], // resúmenes de tramos ya cerrados
    seleccion: null,
    celdaBajoPuntero: null,
    capturandoRecentrar: false,
    quietud: null, // { hasta, xs, ys } mientras se mide
    posicionesQuietud: [],
    restaurarDispositivo: null,
    grillaInfo: null,
  };

  const usaMouse = () => el.usarMouse.checked;
  const ahora = () => performance.now();

  // ── Persistencia de configuración ────────────────────────────────────
  function aplicarConfigAlDom() {
    el.radiosSeleccion.forEach((r) => (r.checked = r.value === config.seleccion));
    el.dwell.value = String(config.dwellMs);
    el.celda.value = String(config.celdaMin);
    el.layout.value = config.layout;
    el.descanso.checked = config.descanso;
    el.descansoTam.value = config.descansoTam;
    el.vel.value = String(config.velocidad);
    el.ocultar.checked = config.ocultarVista;
    actualizarEtiquetasConfig();
  }

  function actualizarEtiquetasConfig() {
    el.dwellWrap.hidden = config.seleccion !== 'dwell';
    el.descansoWrap.hidden = config.seleccion !== 'dwell';
    el.descansoTam.disabled = !config.descanso;
    // El botón de dispositivo se muestra si hay alguna tecla que programar:
    // la del pulsador (solo en modo pulsador) y/o la de recentrar.
    el.btnDispositivo.hidden = entradasDispositivo().length === 0;
    el.recentrarTecla.textContent = etiquetaTecla(config.teclaRecentrar);
    el.quitarRecentrar.disabled = !config.teclaRecentrar;
    el.celdaOut.textContent = `${config.celdaMin} px`;
    el.velOut.textContent = `${coma(config.velocidad)}×`;
  }

  // ── Tablero ────────────────────────────────────────────────────────
  /** Tamaño de la zona de descanso en uso, o null (solo existe en dwell). */
  const descansoActivo = () =>
    config.seleccion === 'dwell' && config.descanso ? config.descansoTam : null;
  /** Hueco central: no es una celda (sin data-celda), así que no elige nada. */
  let descansoEl = null;

  function construirTablero() {
    el.grilla.innerHTML = '';
    celdaEls.clear();
    descansoEl = document.createElement('div');
    descansoEl.className = 'epe-cc-descanso';
    descansoEl.hidden = true;
    descansoEl.setAttribute('aria-hidden', 'true');
    descansoEl.textContent = 'Descanso';
    el.grilla.appendChild(descansoEl);
    const spans = plantillaTablero(config.layout)?.spans ?? {};
    celdas.forEach((c) => {
      const d = document.createElement('div');
      d.className = 'epe-cc-celda';
      d.dataset.celda = c.id;
      d.dataset.id = c.id;
      d.dataset.tipo = c.tipo;
      if (spans[c.id] > 1) d.style.gridColumn = `span ${spans[c.id]}`;
      const s = document.createElement('span');
      s.textContent = c.etiqueta;
      d.appendChild(s);
      el.grilla.appendChild(d);
      celdaEls.set(c.id, d);
    });
  }

  function acomodarTablero() {
    const info = medirTablero({
      layout: config.layout,
      ancho: el.grilla.clientWidth,
      alto: el.grilla.clientHeight,
      celdaMin: config.celdaMin,
      gap: GAP,
      descanso: descansoActivo(),
    });
    st.grillaInfo = info;
    celdaEls.forEach((d, id) => {
      const p = info.posiciones?.[id];
      d.style.gridColumn = p
        ? `${p.col} / span ${p.cols}`
        : info.spans[id] > 1
          ? `span ${info.spans[id]}`
          : '';
      d.style.gridRow = p ? String(p.fila) : '';
    });
    if (descansoEl) {
      const h = info.hueco;
      descansoEl.hidden = !h;
      descansoEl.style.gridColumn = h ? `${h.col} / span ${h.cols}` : '';
      descansoEl.style.gridRow = h ? `${h.fila} / span ${h.filas}` : '';
    }
    el.grilla.style.gridTemplateColumns = `repeat(${info.cols}, minmax(0, 1fr))`;
    el.grilla.style.gridTemplateRows = `repeat(${info.filas}, minmax(0, 1fr))`;
    const lado = Math.min(info.celdaAncho, info.celdaAlto);
    el.celdaAviso.textContent = info.cumpleMinimo
      ? `En esta pantalla las celdas quedan de unos ${lado} px.`
      : `En esta pantalla las celdas quedan de unos ${lado} px, menos que el mínimo. Probá una pantalla más grande o bajá el mínimo.`;
    el.celdaAviso.classList.toggle('is-alerta', !info.cumpleMinimo);
  }

  function renderTexto() {
    el.texto.textContent = st.texto || '—';
  }

  // ── Selección ─────────────────────────────────────────────────────────
  function nuevaSeleccion() {
    st.seleccion = crearSeleccion(config.seleccion, { ms: config.dwellMs });
    limpiarProgreso();
  }

  function limpiarProgreso() {
    celdaEls.forEach((d) => {
      d.style.setProperty('--p', '0');
      d.classList.remove('is-bajo-puntero');
    });
    st.celdaBajoPuntero = null;
  }

  function celdaEnPunto(x, y) {
    const e = document.elementFromPoint(x, y);
    const celda = /** @type {HTMLElement|null|undefined} */ (e?.closest?.('[data-celda]'));
    return celda?.dataset.celda || null;
  }

  function alPuntero(x, y, fuente) {
    if (fuente === 'cabeza' && usaMouse()) return;
    if (fuente === 'mouse' && !usaMouse()) return;
    if (st.quietud && ahora() < st.quietud.hasta) {
      st.quietud.xs.push(x);
      st.quietud.ys.push(y);
    }
    if (!st.jugando) return;
    st.tramo?.eventoPuntero();
    const id = celdaEnPunto(x, y);
    if (id !== st.celdaBajoPuntero) {
      if (st.celdaBajoPuntero)
        celdaEls.get(st.celdaBajoPuntero)?.classList.remove('is-bajo-puntero');
      if (id) celdaEls.get(id)?.classList.add('is-bajo-puntero');
      st.celdaBajoPuntero = id;
    }
    st.seleccion.alMover(id, ahora(), { punteroVivo: true });
  }

  function elegir(id) {
    const celda = celdas.find((c) => c.id === id);
    if (!celda) return;
    const r = aplicarCelda(st.texto, celda);
    st.texto = r.texto;
    renderTexto();
    st.tramo?.seleccion(ahora(), celda);
    const d = celdaEls.get(id);
    if (d) {
      d.classList.add('is-elegida');
      setTimeout(() => d.classList.remove('is-elegida'), 220);
    }
    if (r.hablar) hablarTexto();
  }

  // Cámara sin ver la cara o en pausa: con pulsador cuenta como "sin puntero",
  // no como mala puntería.
  function punteroVivoParaPulsador() {
    if (usaMouse()) return true;
    const e = st.cabeza?.estado();
    if (!e) return false;
    return ![CALIDAD.PAUSA, CALIDAD.SIN_CARA, CALIDAD.SIN_INICIAR].includes(e.calidad);
  }

  function alPresionarPulsador() {
    const vivo = punteroVivoParaPulsador();
    if (!vivo) st.seleccion.alMover(null, ahora(), { punteroVivo: false });
    const r = st.seleccion.alPresionar();
    if (r.seleccion) {
      elegir(r.seleccion);
    } else {
      st.tramo?.intentoSinEfecto(r.motivo);
      el.estadoVoz.textContent =
        r.motivo === 'sin-puntero'
          ? 'No hay puntero: la cámara no ve la cara o el seguimiento está en pausa.'
          : 'El puntero no está sobre ninguna celda.';
      setTimeout(() => {
        if (
          el.estadoVoz.textContent.startsWith('No hay puntero') ||
          el.estadoVoz.textContent.startsWith('El puntero')
        ) {
          el.estadoVoz.textContent = '';
        }
      }, 1800);
    }
  }

  // Dwell: el reloj corre aunque el puntero no se mueva.
  setInterval(() => {
    if (!st.jugando || config.seleccion !== 'dwell' || !st.seleccion) return;
    const r = st.seleccion.tick(ahora());
    celdaEls.forEach((d, id) => {
      d.style.setProperty('--p', id === st.celdaBajoPuntero ? String(r.progreso) : '0');
    });
    if (r.seleccion) elegir(r.seleccion);
  }, 40);

  // ── Tramos de sesión y resumen ─────────────────────────────────────────
  function iniciarTramo() {
    st.tramo = crearSesion(
      {
        modo: config.seleccion,
        dwellMs: config.dwellMs,
        celdaMin: config.celdaMin,
        layout: config.layout,
        descansoTam: descansoActivo(),
      },
      ahora(),
    );
  }

  function cerrarTramo() {
    if (!st.tramo) return;
    st.posicionesQuietud.forEach((p) => st.tramo.posicion(p.x, p.y));
    st.tramo.cerrar(ahora());
    const r = st.tramo.resumen(ahora());
    if (
      r.selecciones > 0 ||
      r.recentrados > 0 ||
      r.intentosFuera + r.intentosSinPuntero > 0 ||
      r.duracionS >= 10
    ) {
      st.historial.push(
        resumenTexto(r) + (usaMouse() ? '\n(Sesión con mouse, no con cabeza)' : ''),
      );
    }
    st.tramo = null;
  }

  function mostrarResumen() {
    el.abrirResumen.hidden = st.historial.length === 0;
    el.resumen.textContent = st.historial.join('\n\n— — —\n\n');
  }

  function abrirResumen() {
    mostrarResumen();
    el.modalResumen.hidden = false;
  }
  el.abrirResumen.addEventListener('click', abrirResumen);
  el.cerrarResumen.addEventListener('click', () => (el.modalResumen.hidden = true));

  el.copiarResumen.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(el.resumen.textContent);
      el.copiarResumen.textContent = 'Copiado';
    } catch {
      el.copiarResumen.textContent = 'Seleccioná el texto y copialo';
    }
    setTimeout(() => (el.copiarResumen.textContent = 'Copiar resumen'), 2000);
  });

  // Una muestra por segundo de si hay puntero fresco, para el % sin puntero.
  setInterval(() => {
    if (!st.jugando || !st.tramo || usaMouse()) return;
    st.tramo.muestra(ahora(), st.cabeza?.estado().calidad === CALIDAD.OK);
  }, 1000);

  // ── Indicador de calidad ───────────────────────────────────────────────
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
  refrescarChip();

  // ── Cabeza ───────────────────────────────────────────────────────────
  function estadoCabeza(texto, alerta = false) {
    el.estadoCabeza.textContent = texto;
    el.estadoCabeza.classList.toggle('is-alerta', alerta);
  }

  el.iniciarCabeza.addEventListener('click', async () => {
    el.iniciarCabeza.disabled = true;
    try {
      if (!st.cabeza) {
        st.cabeza = await crearCabeza({
          host: el.trackyHost,
          alPuntero: (x, y) => alPuntero(x, y, 'cabeza'),
        });
      }
      await st.cabeza.iniciar({ alEstado: (t) => estadoCabeza(t) });
      el.iniciarCabeza.textContent = 'Seguimiento iniciado';
      el.pausa.hidden = false;
      estadoCabeza('Activo. F9 o el botón pausan y reanudan.');
      abrirCamara(); // lo que sigue es encuadrar y, si hace falta, ajustar la sensibilidad
    } catch (err) {
      estadoCabeza(`No se pudo iniciar: ${String(err?.message || err)}`, true);
      el.iniciarCabeza.disabled = false;
      st.cabeza = null;
    }
  });

  el.pausa.addEventListener('click', () => {
    if (!st.cabeza) return;
    if (st.cabeza.estaPausada()) st.cabeza.reanudar();
    else st.cabeza.pausar();
  });

  el.usarMouse.addEventListener('change', () => {
    el.avisoEmpezar.textContent = '';
    st.seleccion?.reiniciar();
  });
  window.addEventListener('pointermove', (e) => alPuntero(e.clientX, e.clientY, 'mouse'));

  // La vista de cámara de Tracky es un elemento fijo: no se lo puede mover de
  // lugar en el DOM (el navegador pausaría el video). Con el modal de cámara
  // abierto se lo acomoda encima de su hueco; jugando, vuelve a su rincón (o se
  // saca de pantalla); con el modal principal abierto se saca de pantalla.
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
  const camaraAbierta = () => !el.modalCamara.hidden;

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
  el.modalCamaraCaja.addEventListener('scroll', acomodarVista);
  window.addEventListener('resize', acomodarVista);

  function aplicarVisibilidadVista() {
    const oculto = camaraAbierta() ? false : st.jugando ? config.ocultarVista : true;
    el.trackyHost.classList.toggle('oculto', oculto);
    acomodarVista();
  }

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

  el.ajustesTracky.addEventListener('click', () => {
    const on = el.trackyHost.classList.toggle('mostrar-ajustes');
    el.ajustesTracky.setAttribute('aria-pressed', String(on));
  });

  // Sensibilidad: un solo slider que mueve los de Tracky (ver sensibilidad.js).
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

  el.ocultar.addEventListener('change', () => {
    config.ocultarVista = el.ocultar.checked;
    guardarConfig(config);
    aplicarVisibilidadVista();
  });

  // Medir temblor: con la cabeza quieta, cuánto se mueve el puntero solo.
  el.quietud.addEventListener('click', () => {
    if (!st.cabeza && !usaMouse()) {
      el.quietudRes.textContent = 'Primero iniciá el seguimiento.';
      return;
    }
    el.quietud.disabled = true;
    el.quietudRes.textContent = 'Midiendo… quedate quieto 5 segundos.';
    st.quietud = { hasta: ahora() + 5000, xs: [], ys: [] };
    setTimeout(() => {
      const { xs, ys } = st.quietud;
      st.quietud = null;
      el.quietud.disabled = false;
      const dx = desvioEstandar(xs);
      const dy = desvioEstandar(ys);
      if (dx === null || dy === null) {
        el.quietudRes.textContent =
          'No llegó ningún puntero: revisá que el seguimiento esté activo.';
        el.quietudRes.classList.add('is-alerta');
        return;
      }
      el.quietudRes.classList.remove('is-alerta');
      const temblor = Math.hypot(dx, dy);
      st.posicionesQuietud = xs.map((x, i) => ({ x, y: ys[i] }));
      el.quietudRes.textContent = `Temblor: ${coma(temblor)} px (${xs.length} muestras). Celdas más chicas que ~${Math.ceil(temblor * 6)} px pueden ser difíciles.`;
    }, 5000);
  });

  // ── Voz ─────────────────────────────────────────────────────────────────
  function cargarVoces() {
    const lista = ordenarVoces(voz.listarVoces());
    el.voz.innerHTML = '';
    lista.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.name;
      o.textContent = `${v.name} (${v.lang}${v.localService ? '' : ', requiere internet'})`;
      el.voz.appendChild(o);
    });
    if (lista.length === 0) {
      el.vozAviso.textContent = voz.disponible
        ? 'No se encontraron voces en español en este equipo.'
        : 'Este navegador no tiene texto a voz.';
      el.vozAviso.classList.add('is-alerta');
      return;
    }
    const elegida = elegirVoz(lista, {
      nombrePreferido: config.vozNombre,
      sinRed: !navigator.onLine,
    });
    if (elegida) el.voz.value = elegida.name;
    avisoVoz();
  }

  function vozActual() {
    return elegirVoz(voz.listarVoces(), {
      nombrePreferido: el.voz.value || config.vozNombre,
      sinRed: !navigator.onLine,
    });
  }

  function avisoVoz() {
    const v = vozActual();
    el.vozAviso.classList.remove('is-alerta');
    el.vozAviso.textContent =
      v && !v.localService ? 'Esta voz necesita internet. Sin conexión se usa una local.' : '';
  }

  function hablarTexto() {
    const t = textoParaHablar(st.texto);
    if (!t) return;
    voz.hablar(t, {
      voz: vozActual(),
      velocidad: config.velocidad,
      alEmpezar: () => (el.estadoVoz.textContent = 'Hablando…'),
      alTerminar: () => (el.estadoVoz.textContent = ''),
      alFallar: (m) => {
        el.estadoVoz.textContent = m;
        setTimeout(() => {
          if (el.estadoVoz.textContent === m) el.estadoVoz.textContent = '';
        }, 5000);
      },
    });
  }

  voz.alCambiarVoces(cargarVoces);
  cargarVoces();

  el.voz.addEventListener('change', () => {
    config.vozNombre = el.voz.value;
    guardarConfig(config);
    avisoVoz();
  });
  el.vel.addEventListener('input', () => {
    config.velocidad = Number(el.vel.value);
    guardarConfig(config);
    actualizarEtiquetasConfig();
  });
  el.probarVoz.addEventListener('click', () => {
    voz.hablar('Hola, esta es la voz del comunicador.', {
      voz: vozActual(),
      velocidad: config.velocidad,
      alFallar: (m) => {
        el.vozAviso.textContent = m;
        el.vozAviso.classList.add('is-alerta');
      },
    });
  });

  // ── Selección: opciones ──────────────────────────────────────────────
  el.radiosSeleccion.forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      config.seleccion = r.value;
      guardarConfig(config);
      actualizarEtiquetasConfig();
      nuevaSeleccion();
      acomodarTablero();
    }),
  );
  el.descanso.addEventListener('change', () => {
    config.descanso = el.descanso.checked;
    guardarConfig(config);
    actualizarEtiquetasConfig();
    limpiarProgreso();
    nuevaSeleccion();
    acomodarTablero();
  });
  el.descansoTam.addEventListener('change', () => {
    config.descansoTam = el.descansoTam.value;
    guardarConfig(config);
    limpiarProgreso();
    nuevaSeleccion();
    acomodarTablero();
  });
  el.dwell.addEventListener('change', () => {
    config.dwellMs = Number(el.dwell.value);
    guardarConfig(config);
    nuevaSeleccion();
  });
  el.layout.addEventListener('change', () => {
    config.layout = el.layout.value;
    guardarConfig(config);
    celdas = celdasTablero(config.layout);
    construirTablero();
    limpiarProgreso();
    nuevaSeleccion();
    acomodarTablero();
  });
  el.celda.addEventListener('input', () => {
    config.celdaMin = Number(el.celda.value);
    guardarConfig(config);
    actualizarEtiquetasConfig();
    acomodarTablero();
  });

  // ── Recentrar el puntero ────────────────────────────────────────────
  // Con puntero relativo, la cabeza deriva o el puntero se pega a un borde.
  // Recentrar deja el puntero al medio de la pantalla y toma la postura
  // actual como referencia (ver cabeza.recentrar()).
  function avisoTemporal(texto) {
    el.estadoVoz.textContent = texto;
    setTimeout(() => {
      if (el.estadoVoz.textContent === texto) el.estadoVoz.textContent = '';
    }, 1500);
  }

  function recentrar() {
    if (usaMouse()) {
      avisoTemporal('Con el mouse no hace falta recentrar.');
      return;
    }
    if (!st.cabeza?.recentrar()) {
      avisoTemporal('No se puede recentrar: el seguimiento está en pausa o sin iniciar.');
      return;
    }
    // Lo que estaba en curso ya no vale: el puntero salta al centro.
    st.seleccion?.reiniciar();
    limpiarProgreso();
    st.tramo?.recentrado();
    avisoTemporal('Recentrado');
    el.centro.hidden = true;
    void el.centro.offsetWidth; // reinicia la animación
    el.centro.hidden = false;
    setTimeout(() => (el.centro.hidden = true), 700);
  }

  // Asignar la tecla: se presiona la que se quiere usar (mismo criterio que
  // el resto de Apps EpE). Esc cancela.
  function empezarCaptura() {
    st.capturandoRecentrar = true;
    el.recentrarTecla.textContent = 'Presioná una tecla…';
    el.recentrarTecla.classList.add('is-capturando');
    el.recentrarAviso.classList.remove('is-alerta');
    el.recentrarAviso.textContent = 'Esc cancela.';
  }

  function terminarCaptura(mensaje = '', alerta = false) {
    st.capturandoRecentrar = false;
    el.recentrarTecla.classList.remove('is-capturando');
    actualizarEtiquetasConfig();
    el.recentrarAviso.classList.toggle('is-alerta', alerta);
    el.recentrarAviso.textContent = mensaje;
  }

  el.asignarRecentrar.addEventListener('click', empezarCaptura);
  el.quitarRecentrar.addEventListener('click', () => {
    config.teclaRecentrar = null;
    guardarConfig(config);
    terminarCaptura('Sin tecla de recentrado.');
  });

  // ── Modal: empezar / reabrir ─────────────────────────────────────────
  function empezar() {
    if (!usaMouse() && !st.cabeza) {
      el.avisoEmpezar.textContent =
        'Iniciá el seguimiento de cabeza (o tildá "usar el mouse" para probar la app).';
      el.avisoEmpezar.classList.add('is-alerta');
      return;
    }
    el.avisoEmpezar.textContent = '';
    el.avisoEmpezar.classList.remove('is-alerta');
    el.config.hidden = true;
    el.modalCamara.hidden = true;
    st.jugando = true;
    if (!st.iniciado) {
      st.iniciado = true;
      el.empezar.textContent = 'Continuar';
    }
    nuevaSeleccion();
    iniciarTramo();
    aplicarVisibilidadVista();
    acomodarTablero();
  }

  function reabrirConfig() {
    if (!st.iniciado || !el.config.hidden) return;
    st.jugando = false;
    cerrarTramo();
    limpiarProgreso();
    mostrarResumen();
    el.modalResumen.hidden = true;
    el.config.hidden = false;
    aplicarVisibilidadVista();
  }

  el.empezar.addEventListener('click', empezar);

  // ── Dispositivo físico ────────────────────────────────────────────────
  function entradasDispositivo() {
    const entradas = [];
    if (config.seleccion === 'pulsador') {
      entradas.push({ id: 'k', etiqueta: 'Seleccionar la celda bajo el puntero', tecla: 'k' });
    }
    if (config.teclaRecentrar) {
      entradas.push({
        id: 'recentrar',
        etiqueta: 'Recentrar el puntero al centro',
        tecla: config.teclaRecentrar,
      });
    }
    return entradas;
  }

  function actualizarBotonRestaurar() {
    if (el.btnRestaurar) el.btnRestaurar.hidden = !st.restaurarDispositivo;
  }

  el.btnDispositivo.addEventListener('click', () => {
    if (!dispositivoWidget()) return;
    dispositivoWidget()
      .abrir(entradasDispositivo(), {
        titulo: 'Configurar dispositivo — Comunicación con seguimiento de cabeza',
      })
      .then((r) => {
        if (r?.restaurar) st.restaurarDispositivo = r.restaurar;
        actualizarBotonRestaurar();
        if (r?.continuar) empezar();
      });
  });

  el.btnRestaurar.addEventListener('click', () => {
    if (!st.restaurarDispositivo) return;
    const fn = st.restaurarDispositivo;
    st.restaurarDispositivo = null;
    el.btnRestaurar.disabled = true;
    el.btnRestaurar.textContent = 'Restaurando…';
    fn()
      .then((r) => {
        el.btnRestaurar.textContent = r?.ok ? 'Listo' : 'Quedó distinto en algún campo';
      })
      .catch(() => {
        el.btnRestaurar.textContent = 'No se pudo restaurar';
      })
      .then(() => {
        setTimeout(() => {
          el.btnRestaurar.disabled = false;
          el.btnRestaurar.textContent = 'Restaurar dispositivo';
          actualizarBotonRestaurar();
        }, 2500);
      });
  });

  function salirConfirmado(luego) {
    if (!(dispositivoWidget() && st.restaurarDispositivo)) {
      luego();
      return;
    }
    dispositivoWidget()
      .confirmarSalida(st.restaurarDispositivo)
      .then((r) => {
        if (!r.salir) return;
        if (r.restaurado) {
          st.restaurarDispositivo = null;
          actualizarBotonRestaurar();
        }
        luego();
      });
  }

  el.volver.forEach((a) =>
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      salirConfirmado(() => {
        window.location.href = 'index.html';
      });
    }),
  );

  // ── Teclado ─────────────────────────────────────────────────────────
  document.addEventListener('keydown', (ev) => {
    if (st.capturandoRecentrar) {
      ev.preventDefault();
      if (ev.key === 'Escape') {
        terminarCaptura();
        return;
      }
      const r = validarTeclaRecentrar(ev.key);
      if (!r.ok) {
        el.recentrarAviso.classList.add('is-alerta');
        el.recentrarAviso.textContent = `${r.motivo} Probá de nuevo o Esc para cancelar.`;
        return;
      }
      config.teclaRecentrar = r.tecla;
      guardarConfig(config);
      terminarCaptura(`Tecla asignada: ${etiquetaTecla(r.tecla)}.`);
      return;
    }
    if (ev.key === 'F9') {
      st.cabeza?.notificarPausaManual();
      return;
    }
    if (ev.repeat) return;
    // Esc cierra primero el modal secundario que esté abierto.
    if (ev.key === 'Escape' && !el.modalResumen.hidden) {
      el.modalResumen.hidden = true;
      return;
    }
    if (ev.key === 'Escape' && camaraAbierta()) {
      cerrarCamara();
      return;
    }
    if (ev.key === 'Escape') {
      reabrirConfig();
      return;
    }
    if (st.jugando && config.teclaRecentrar && normalizarTecla(ev.key) === config.teclaRecentrar) {
      ev.preventDefault();
      recentrar();
      return;
    }
    if (!st.jugando || config.seleccion !== 'pulsador') return;
    if (TECLAS_PULSADOR.includes(ev.key.toLowerCase())) {
      // Que Espacio no scrollee ni active el botón con foco.
      ev.preventDefault();
      alPresionarPulsador();
    }
  });

  // ── Arranque ────────────────────────────────────────────────────────
  construirTablero();
  aplicarConfigAlDom();
  nuevaSeleccion();
  renderTexto();
  actualizarBotonRestaurar();
  new ResizeObserver(acomodarTablero).observe(el.grilla);
  acomodarTablero();

  // Gancho para pruebas automáticas (no lo usa la interfaz).
  /** @type {any} */ (window).__cc = {
    alPuntero,
    elegir,
    get st() {
      return st;
    },
    config,
  };
}

const raiz = document.querySelector('[data-cc-raiz]');
if (raiz) iniciar(raiz);
