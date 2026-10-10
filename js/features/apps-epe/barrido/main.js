/**
 * main.js
 * App EpE — Barrido.
 *
 * Para qué sirve: que un profesional de rehabilitación practique con una
 * persona los distintos modos de barrido (el foco recorre las opciones del
 * tablero y la persona confirma con eventos de entrada), con dos objetivos:
 * copiar una palabra, o comunicarse escribiendo texto libre que se dice en voz
 * alta.
 *
 * Este archivo solo une piezas (DOM, voz, storage, widget del dispositivo). La
 * lógica está en módulos puros con tests: patrones, motor, eventos, config,
 * tablero y objetivos.
 */
import { medirTablero, celdasTablero } from '../comunicacion-cabeza/grilla.js';
import { aplicarCelda, textoParaHablar } from '../comunicacion-cabeza/texto.js';
import { ordenarVoces, elegirVoz } from '../_comun/voz.js';
import { crearVoz } from '../_comun/voz-web.js';
import { cargarConfig, guardarConfig, INTERVALO_MIN_MS, INTERVALO_MAX_MS } from './config.js';
import { NOMBRES_PATRON, PATRONES, construirArbol } from './patrones.js';
import { crearMotor } from './motor.js';
import { posicionarCeldas } from './tablero.js';
import {
  IDS_EVENTO,
  NOMBRES_EVENTO,
  asignarTecla,
  descripcionEvento,
  entradasParaDispositivo,
  etiquetaTecla,
  eventoDeTecla,
  eventosActivos,
  validarTecla,
} from './eventos.js';
import { crearPractica, evaluarCopia, palabraDesdeTexto } from './objetivos.js';

const GAP = 8;
const CELDA_MIN = 60;

/** Widget "Configurar dispositivo" (script propio; puede no haber cargado). */
function dispositivoWidget() {
  return /** @type {any} */ (window).EpeConfigurarDispositivo;
}

function iniciar(raiz) {
  const q = (s) => raiz.querySelector(s);
  const el = {
    config: q('[data-bar-config]'),
    empezar: q('[data-bar-empezar]'),
    objetivoRadios: Array.from(raiz.querySelectorAll('[name=bar-objetivo]')),
    metodoRadios: Array.from(raiz.querySelectorAll('[name=bar-metodo]')),
    bloqueCopiar: q('[data-bar-bloque-copiar]'),
    avisoPrivacidad: q('[data-bar-aviso-privacidad]'),
    palabra: q('[data-bar-palabra]'),
    reproduccion: q('[data-bar-reproduccion]'),
    abrirPalabras: q('[data-bar-abrir-palabras]'),
    notaMetodo: q('[data-bar-nota-metodo]'),
    patron: q('[data-bar-patron]'),
    retrocesoWrap: q('[data-bar-retroceso-wrap]'),
    retroceso: q('[data-bar-retroceso]'),
    velocidadWrap: q('[data-bar-velocidad-wrap]'),
    velocidad: q('[data-bar-velocidad]'),
    velocidadOut: q('[data-bar-velocidad-out]'),
    vueltas: q('[data-bar-vueltas]'),
    eventos: q('[data-bar-eventos]'),
    avisoTeclas: q('[data-bar-aviso-teclas]'),
    btnDispositivo: q('[data-configurar-dispositivo]'),
    btnRestaurar: q('[data-restaurar-dispositivo]'),
    layout: q('[data-bar-layout]'),
    voz: q('[data-bar-voz]'),
    vozVel: q('[data-bar-voz-vel]'),
    vozVelOut: q('[data-bar-voz-vel-out]'),
    probarVoz: q('[data-bar-probar-voz]'),
    vozAviso: q('[data-bar-voz-aviso]'),
    modalPalabras: q('[data-bar-modal-palabras]'),
    palabraNueva: q('[data-bar-palabra-nueva]'),
    palabraAgregar: q('[data-bar-palabra-agregar]'),
    palabraAviso: q('[data-bar-palabra-aviso]'),
    cerrarPalabras: q('[data-bar-cerrar-palabras]'),
    bloqueObjetivo: q('[data-bar-bloque-objetivo]'),
    objetivo: q('[data-bar-objetivo]'),
    etiquetaTexto: q('[data-bar-etiqueta-texto]'),
    texto: q('[data-bar-texto]'),
    leyenda: q('[data-bar-leyenda]'),
    estado: q('[data-bar-estado]'),
    grilla: q('[data-bar-grilla]'),
    volver: Array.from(raiz.querySelectorAll('[data-volver-apps]')),
  };

  const config = cargarConfig();
  const voz = crearVoz();
  const practica = crearPractica();
  const coma = (n, d = 1) => n.toFixed(d).replace('.', ',');

  const st = {
    jugando: false,
    iniciado: false,
    bloqueado: false, // mientras se dice la palabra completa: no se aceptan eventos
    texto: '',
    celdas: celdasTablero(config.layout),
    posiciones: [],
    firma: '',
    motor: null,
    timer: null,
    capturando: null, // id del evento cuya tecla se está asignando
    restaurarDispositivo: null,
  };
  const celdaEls = new Map();

  const copiando = () => config.objetivo === 'copiar';
  /** Eventos que hacen falta ahora. Reproducir solo existe al copiar una palabra. */
  const activos = () =>
    eventosActivos({
      metodo: config.metodo,
      conRetroceso: config.conRetroceso,
      reproduccion: copiando() ? config.reproduccion : 'auto',
    });

  function avisoTemporal(texto, ms = 2500) {
    el.estado.textContent = texto;
    setTimeout(() => {
      if (el.estado.textContent === texto) el.estado.textContent = '';
    }, ms);
  }

  // ── Tablero ─────────────────────────────────────────────────────────────
  function construirTablero() {
    el.grilla.innerHTML = '';
    celdaEls.clear();
    st.celdas.forEach((c) => {
      const d = document.createElement('div');
      d.className = 'epe-barrido-celda';
      d.dataset.id = c.id;
      d.dataset.tipo = c.tipo;
      const s = document.createElement('span');
      s.textContent = c.etiqueta;
      d.appendChild(s);
      el.grilla.appendChild(d);
      celdaEls.set(c.id, d);
    });
    st.firma = '';
  }

  function acomodarTablero() {
    const info = medirTablero({
      layout: config.layout,
      ancho: el.grilla.clientWidth,
      alto: el.grilla.clientHeight,
      celdaMin: CELDA_MIN,
      gap: GAP,
    });
    st.posiciones = posicionarCeldas(st.celdas, info.cols, info.spans);
    st.posiciones.forEach((p) => {
      const d = celdaEls.get(p.id);
      if (!d) return;
      const n = info.spans[p.id] ?? 1;
      d.style.gridColumn = `${p.col} / span ${Math.min(n, info.cols)}`;
      d.style.gridRow = String(p.fila);
    });
    el.grilla.style.gridTemplateColumns = `repeat(${info.cols}, minmax(0, 1fr))`;
    el.grilla.style.gridTemplateRows = `repeat(${info.filas}, minmax(0, 1fr))`;
    // Si la forma del tablero cambió, los grupos de filas y columnas ya no valen.
    const firma = `${config.layout}|${info.cols}|${info.filas}`;
    if (firma !== st.firma) {
      st.firma = firma;
      reconstruirMotor();
    }
  }

  // ── Barrido ─────────────────────────────────────────────────────────────
  function reconstruirMotor() {
    if (!st.posiciones.length) return;
    st.motor = crearMotor({
      arbol: construirArbol(config.patron, st.posiciones),
      vueltas: config.vueltas,
    });
    resaltar();
    reiniciarTimer();
  }

  function resaltar() {
    celdaEls.forEach((d) => d.classList.remove('is-resaltada', 'is-grupo'));
    if (!st.motor || !st.jugando) return;
    const e = st.motor.estado();
    (e.grupo ?? []).forEach((id) => celdaEls.get(id)?.classList.add('is-grupo'));
    e.opcion.forEach((id) => celdaEls.get(id)?.classList.add('is-resaltada'));
  }

  function pararTimer() {
    if (st.timer) clearInterval(st.timer);
    st.timer = null;
  }

  /** Automático: el foco avanza solo, con el intervalo completo en cada paso. */
  function reiniciarTimer() {
    pararTimer();
    if (!st.jugando || config.metodo !== 'auto' || !st.motor) return;
    st.timer = setInterval(() => {
      if (st.bloqueado) return;
      const r = st.motor.avanzar();
      resaltar();
      if (r.tipo === 'sube') reiniciarTimer();
    }, config.intervaloMs);
  }

  function alEvento(id) {
    if (!st.jugando || st.bloqueado || !st.motor) return;
    if (id === 'avanzar') {
      st.motor.avanzar();
      resaltar();
    } else if (id === 'retroceder') {
      st.motor.retroceder();
      resaltar();
    } else if (id === 'seleccionar') {
      const r = st.motor.seleccionar();
      if (r.tipo === 'celda') elegir(r.id);
      resaltar();
      // Cada selección da de nuevo el tiempo completo de reacción.
      if (config.metodo === 'auto') reiniciarTimer();
    } else if (id === 'reproducir') {
      accionHablar();
    }
  }

  // ── Texto y objetivos ───────────────────────────────────────────────────
  function renderObjetivo() {
    el.objetivo.innerHTML = '';
    if (!copiando()) return;
    const ev = evaluarCopia(st.texto, practica.actual());
    ev.letras.forEach((l) => {
      const s = document.createElement('span');
      s.className = 'epe-barrido-letra-objetivo';
      if (l.estado === 'correcta') s.classList.add('is-correcta');
      if (l.estado === 'incorrecta') s.classList.add('is-incorrecta');
      s.textContent = l.letra === ' ' ? '␣' : l.letra;
      el.objetivo.appendChild(s);
    });
  }

  function renderTexto() {
    el.texto.textContent = (copiando() ? st.texto.toUpperCase() : st.texto) || '—';
    renderObjetivo();
  }

  function renderLeyenda() {
    el.leyenda.innerHTML = '';
    activos().forEach((id) => {
      const item = document.createElement('span');
      item.className = 'epe-barrido-leyenda-item';
      const k = document.createElement('kbd');
      k.className = 'epe-barrido-tecla';
      k.textContent = etiquetaTecla(config.teclas[id]);
      const t = document.createElement('span');
      t.textContent = NOMBRES_EVENTO[id];
      item.append(k, t);
      el.leyenda.appendChild(item);
    });
  }

  function elegir(id) {
    const celda = st.celdas.find((c) => c.id === id);
    if (!celda) return;
    const r = aplicarCelda(st.texto, celda);
    st.texto = r.texto;
    renderTexto();
    const d = celdaEls.get(id);
    if (d) {
      d.classList.add('is-elegida');
      setTimeout(() => d.classList.remove('is-elegida'), 220);
    }
    if (r.hablar) accionHablar();
    else comprobarCopia();
  }

  function copiaCompleta() {
    return copiando() && evaluarCopia(st.texto, practica.actual()).completa;
  }

  function comprobarCopia() {
    if (!copiaCompleta()) {
      if (el.estado.classList.contains('is-exito')) limpiarEstado();
      return;
    }
    if (config.reproduccion === 'auto') {
      completarPalabra();
    } else {
      el.estado.classList.add('is-exito');
      el.estado.textContent =
        '¡Listo! Usá el evento «Reproducir» (o la celda HABLAR) para escucharla y seguir.';
    }
  }

  function limpiarEstado() {
    el.estado.textContent = '';
    el.estado.classList.remove('is-exito');
  }

  /** Palabra completa: se dice con su pronunciación y recién ahí pasa a la próxima. */
  function completarPalabra() {
    st.bloqueado = true;
    el.estado.classList.add('is-exito');
    el.estado.textContent = '¡Listo! Copiaste la palabra completa.';
    decir(practica.actual().pronunciacion, pasarALaSiguiente);
  }

  function pasarALaSiguiente() {
    practica.siguiente();
    st.texto = '';
    st.bloqueado = false;
    limpiarEstado();
    renderPalabras();
    renderTexto();
    if (st.motor) st.motor.reiniciar();
    resaltar();
    reiniciarTimer();
  }

  /** HABLAR / evento Reproducir: dice lo escrito; si la palabra está completa, además sigue. */
  function accionHablar() {
    if (copiaCompleta()) {
      completarPalabra();
      return;
    }
    decir(st.texto);
  }

  // ── Voz ─────────────────────────────────────────────────────────────────
  // Sin una voz elegida a propósito se prefiere una local: las voces "online"
  // mandan el texto a un servicio externo, y en Comunicación el texto es libre.
  function opcionesVoz() {
    return {
      nombrePreferido: el.voz.value || config.vozNombre,
      sinRed: config.vozNombre === null || !navigator.onLine,
    };
  }

  function vozActual() {
    return elegirVoz(voz.listarVoces(), opcionesVoz());
  }

  function avisoVoz() {
    const v = vozActual();
    el.vozAviso.classList.remove('is-alerta');
    el.vozAviso.textContent =
      v && !v.localService
        ? 'Esta voz necesita internet: lo que se diga se envía al servicio de voz del navegador.'
        : '';
  }

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
      sinRed: config.vozNombre === null || !navigator.onLine,
    });
    if (elegida) el.voz.value = elegida.name;
    avisoVoz();
  }

  /** Dice `texto`; `alTerminar` se llama una sola vez (termine bien, falle o tarde de más). */
  function decir(texto, alTerminar) {
    const t = textoParaHablar(texto);
    if (!t) {
      alTerminar?.();
      return;
    }
    let hecho = false;
    let seguro = 0;
    const fin = () => {
      if (hecho) return;
      hecho = true;
      clearTimeout(seguro);
      alTerminar?.();
    };
    if (alTerminar) seguro = window.setTimeout(fin, Math.max(3000, t.length * 400 + 2500));
    voz.hablar(t, {
      voz: vozActual(),
      velocidad: config.velocidadVoz,
      alEmpezar: () => {
        if (!el.estado.classList.contains('is-exito')) el.estado.textContent = 'Hablando…';
      },
      alTerminar: () => {
        if (el.estado.textContent === 'Hablando…') el.estado.textContent = '';
        fin();
      },
      alFallar: (m) => {
        avisoTemporal(m, 5000);
        fin();
      },
    });
  }

  voz.alCambiarVoces(cargarVoces);

  // ── Interfaz de preparación ──────────────────────────────────────────────
  const intervaloASlider = (ms) => INTERVALO_MIN_MS + INTERVALO_MAX_MS - ms;
  const sliderAIntervalo = (v) => INTERVALO_MIN_MS + INTERVALO_MAX_MS - v;

  function renderPalabras() {
    el.palabra.innerHTML = '';
    practica.lista().forEach((p) => {
      const o = document.createElement('option');
      o.value = p.escritura;
      o.textContent = p.pronunciacion;
      el.palabra.appendChild(o);
    });
    el.palabra.value = practica.actual().escritura;
  }

  function renderEventos() {
    el.eventos.innerHTML = '';
    activos().forEach((id) => {
      const fila = document.createElement('div');
      fila.className = 'epe-barrido-evento';
      const texto = document.createElement('div');
      const nombre = document.createElement('strong');
      nombre.textContent = NOMBRES_EVENTO[id];
      const desc = document.createElement('small');
      desc.textContent = descripcionEvento(id, config.metodo);
      texto.append(nombre, desc);
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'epe-barrido-tecla-boton';
      boton.dataset.evento = id;
      if (st.capturando === id) {
        boton.classList.add('is-capturando');
        boton.textContent = 'Presioná una tecla…';
      } else {
        boton.textContent = etiquetaTecla(config.teclas[id]);
        boton.setAttribute(
          'aria-label',
          `${NOMBRES_EVENTO[id]}: tecla ${etiquetaTecla(config.teclas[id])}. Cambiar.`,
        );
      }
      boton.addEventListener('click', () => empezarCaptura(id));
      fila.append(texto, boton);
      el.eventos.appendChild(fila);
    });
  }

  function empezarCaptura(id) {
    st.capturando = id;
    el.avisoTeclas.classList.remove('is-alerta');
    el.avisoTeclas.textContent = 'Presioná la tecla nueva. Esc cancela.';
    renderEventos();
    el.eventos.querySelector(`[data-evento="${id}"]`)?.focus();
  }

  function terminarCaptura(mensaje = '', alerta = false) {
    const id = st.capturando;
    st.capturando = null;
    el.avisoTeclas.classList.toggle('is-alerta', alerta);
    el.avisoTeclas.textContent = mensaje;
    renderEventos();
    if (id) el.eventos.querySelector(`[data-evento="${id}"]`)?.focus();
    renderLeyenda();
  }

  function aplicarConfigAlDom() {
    el.objetivoRadios.forEach((r) => (r.checked = r.value === config.objetivo));
    el.metodoRadios.forEach((r) => (r.checked = r.value === config.metodo));
    el.reproduccion.value = config.reproduccion;
    el.patron.value = config.patron;
    el.retroceso.checked = config.conRetroceso;
    el.velocidad.value = String(intervaloASlider(config.intervaloMs));
    el.vueltas.value = String(config.vueltas);
    el.layout.value = config.layout;
    el.vozVel.value = String(config.velocidadVoz);
    actualizarVisibilidad();
  }

  function actualizarVisibilidad() {
    const auto = config.metodo === 'auto';
    el.bloqueCopiar.hidden = !copiando();
    el.avisoPrivacidad.hidden = copiando();
    el.retrocesoWrap.hidden = auto;
    el.velocidadWrap.hidden = !auto;
    el.notaMetodo.textContent = auto
      ? 'El foco avanza solo y un evento de entrada confirma.'
      : 'Un evento mueve el foco y otro confirma (y, si querés, un tercero retrocede).';
    el.velocidadOut.textContent = `pasa cada ${coma(config.intervaloMs / 1000)} s`;
    el.vozVelOut.textContent = `${coma(config.velocidadVoz)}×`;
    el.bloqueObjetivo.hidden = !copiando();
    el.etiquetaTexto.textContent = copiando() ? 'Escribiste' : 'Texto';
    el.btnDispositivo.hidden = activos().length === 0;
    renderEventos();
    renderLeyenda();
  }

  function guardarYActualizar() {
    guardarConfig(config);
    actualizarVisibilidad();
  }

  PATRONES.forEach((p) => {
    const o = document.createElement('option');
    o.value = p;
    o.textContent = NOMBRES_PATRON[p];
    el.patron.appendChild(o);
  });

  el.objetivoRadios.forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      config.objetivo = r.value;
      st.texto = '';
      limpiarEstado();
      guardarYActualizar();
      renderTexto();
    }),
  );
  el.metodoRadios.forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      config.metodo = r.value;
      guardarYActualizar();
      st.motor?.reiniciar();
      reiniciarTimer();
    }),
  );
  el.patron.addEventListener('change', () => {
    config.patron = el.patron.value;
    guardarConfig(config);
    reconstruirMotor();
  });
  el.retroceso.addEventListener('change', () => {
    config.conRetroceso = el.retroceso.checked;
    guardarYActualizar();
  });
  el.velocidad.addEventListener('input', () => {
    config.intervaloMs = sliderAIntervalo(Number(el.velocidad.value));
    guardarYActualizar();
    reiniciarTimer();
  });
  el.vueltas.addEventListener('change', () => {
    config.vueltas = Number(el.vueltas.value);
    guardarConfig(config);
    reconstruirMotor();
  });
  el.reproduccion.addEventListener('change', () => {
    config.reproduccion = el.reproduccion.value;
    guardarYActualizar();
  });
  el.layout.addEventListener('change', () => {
    config.layout = el.layout.value;
    guardarConfig(config);
    st.celdas = celdasTablero(config.layout);
    construirTablero();
    acomodarTablero();
  });
  el.palabra.addEventListener('change', () => {
    practica.elegir(el.palabra.value);
    st.texto = '';
    limpiarEstado();
    renderTexto();
  });
  el.voz.addEventListener('change', () => {
    config.vozNombre = el.voz.value;
    guardarConfig(config);
    avisoVoz();
  });
  el.vozVel.addEventListener('input', () => {
    config.velocidadVoz = Number(el.vozVel.value);
    guardarYActualizar();
  });
  el.probarVoz.addEventListener('click', () => {
    voz.hablar('Hola, esta es la voz de Barrido.', {
      voz: vozActual(),
      velocidad: config.velocidadVoz,
      alFallar: (m) => {
        el.vozAviso.textContent = m;
        el.vozAviso.classList.add('is-alerta');
      },
    });
  });

  // ── Palabras propias ────────────────────────────────────────────────────
  function abrirPalabras() {
    el.palabraAviso.textContent = '';
    el.modalPalabras.hidden = false;
    el.palabraNueva.focus();
  }
  function cerrarPalabras() {
    el.modalPalabras.hidden = true;
  }
  function agregarPalabra() {
    const r = palabraDesdeTexto(el.palabraNueva.value, practica.lista());
    el.palabraAviso.classList.toggle('is-alerta', !r.ok);
    if ('motivo' in r) {
      el.palabraAviso.textContent = r.motivo;
      return;
    }
    practica.agregar(r.palabra);
    st.texto = '';
    renderPalabras();
    renderTexto();
    el.palabraNueva.value = '';
    el.palabraAviso.textContent = `Agregada: ${r.palabra.pronunciacion}. Ya está elegida.`;
    el.palabraNueva.focus();
  }
  el.abrirPalabras.addEventListener('click', abrirPalabras);
  el.cerrarPalabras.addEventListener('click', cerrarPalabras);
  el.palabraAgregar.addEventListener('click', agregarPalabra);
  el.palabraNueva.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      agregarPalabra();
    }
  });

  // ── Empezar / reabrir ────────────────────────────────────────────────────
  function empezar() {
    terminarCapturaSiHay();
    el.config.hidden = true;
    el.modalPalabras.hidden = true;
    st.jugando = true;
    if (!st.iniciado) {
      st.iniciado = true;
      el.empezar.textContent = 'Continuar';
    }
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    st.motor?.reiniciar();
    renderTexto();
    renderLeyenda();
    acomodarTablero();
    resaltar();
    reiniciarTimer();
  }

  function reabrirConfig() {
    if (!st.iniciado || !el.config.hidden) return;
    st.jugando = false;
    pararTimer();
    resaltar();
    el.config.hidden = false;
  }

  function terminarCapturaSiHay() {
    if (st.capturando) terminarCaptura();
  }

  el.empezar.addEventListener('click', empezar);

  // ── Dispositivo físico ───────────────────────────────────────────────────
  function actualizarBotonRestaurar() {
    if (el.btnRestaurar) el.btnRestaurar.hidden = !st.restaurarDispositivo;
  }

  el.btnDispositivo.addEventListener('click', () => {
    if (!dispositivoWidget()) return;
    dispositivoWidget()
      .abrir(entradasParaDispositivo(config.teclas, activos()), {
        titulo: 'Configurar dispositivo — Barrido',
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

  // Antes de salir de la app, recuerda restaurar el dispositivo si quedó algo pendiente.
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

  // ── Teclado ──────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (ev) => {
    // Asignando la tecla de un evento.
    if (st.capturando) {
      ev.preventDefault();
      if (ev.key === 'Escape') {
        terminarCaptura();
        return;
      }
      const v = validarTecla(ev.key);
      if (!v.ok) {
        el.avisoTeclas.classList.add('is-alerta');
        el.avisoTeclas.textContent = `${v.motivo} Probá de nuevo o Esc para cancelar.`;
        return;
      }
      const id = st.capturando;
      const r = asignarTecla(config.teclas, id, v.tecla);
      config.teclas = r.teclas;
      guardarConfig(config);
      terminarCaptura(
        r.intercambio
          ? `Tecla asignada. «${NOMBRES_EVENTO[r.intercambio]}» pasó a usar la que tenía antes.`
          : `Tecla asignada: ${etiquetaTecla(v.tecla)}.`,
      );
      return;
    }
    if (ev.repeat) return;
    if (ev.key === 'Escape') {
      if (!el.modalPalabras.hidden) cerrarPalabras();
      else reabrirConfig();
      return;
    }
    if (!st.jugando) return;
    const id = eventoDeTecla(config.teclas, activos(), ev.key);
    if (!id) return;
    // Que Espacio no scrollee ni active el botón con foco.
    ev.preventDefault();
    alEvento(id);
  });

  // ── Arranque ─────────────────────────────────────────────────────────────
  construirTablero();
  renderPalabras();
  aplicarConfigAlDom();
  renderTexto();
  cargarVoces();
  actualizarBotonRestaurar();
  new ResizeObserver(acomodarTablero).observe(el.grilla);
  acomodarTablero();

  // Gancho para pruebas automáticas (no lo usa la interfaz).
  /** @type {any} */ (window).__barrido = {
    alEvento,
    config,
    practica,
    get st() {
      return st;
    },
    IDS_EVENTO,
  };
}

const raiz = document.querySelector('[data-bar-raiz]');
if (raiz) iniciar(raiz);
