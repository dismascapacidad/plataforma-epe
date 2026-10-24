/**
 * main.js
 * App EpE — Si-No con pulsadores: un tablero de dos casillas (y una tercera
 * opcional), cada una con imagen y texto. La persona elige una y la app dice
 * el texto en voz alta.
 *
 * Formas de responder:
 *   - Teclas, pulsadores o toque en pantalla: lo resuelven EpeAcceso (panel de
 *     configuración) y EpeEntrada (motor), los mismos que Hanói, N-back y
 *     Stroop: una tecla por casilla, barrido con 2 pulsadores o barrido
 *     automático.
 *   - Seguimiento de cabeza, con pulsador o por permanencia: cabeza-modo.js.
 *
 * Este archivo solo une piezas (DOM, voz, storage, dispositivo). La lógica
 * con tests está en config.js y entradas.js.
 */
import {
  cargarConfig,
  guardarConfig,
  celdasActivas,
  limpiarTexto,
  esImagenValida,
  MAX_TEXTO,
} from './config.js';
import {
  accionesPanel,
  completarTeclasGuardadas,
  entradasCabeza,
  conFranjaDescanso,
} from './entradas.js';
import { crearTablero } from './tablero.js';
import { crearModoCabeza } from './cabeza-modo.js';
import { crearVoz } from '../_comun/voz-web.js';
import { elegirVoz } from '../_comun/voz.js';
import { imagenDesdeArchivo, abrirBuscadorArasaac } from '../_comun/selector-imagen.js';

/** Los scripts clásicos de la plataforma (Epe*) cuelgan de window. */
const G = /** @type {any} */ (window);
const CLAVE_ACCESO = 'epe-acceso-si-no';

function iniciar(raiz) {
  const q = (s) => raiz.querySelector(s);
  const el = {
    config: q('[data-sn-config]'),
    editor: q('[data-sn-editor]'),
    tercera: q('[data-sn-tercera]'),
    leerResaltar: q('[data-sn-leer-resaltar]'),
    errorImagen: q('[data-sn-error-imagen]'),
    atrib: q('[data-sn-atrib-arasaac]'),
    radiosAcceso: Array.from(raiz.querySelectorAll('[name=sn-acceso]')),
    secPulsadores: q('[data-sn-sec-pulsadores]'),
    secCabeza: q('[data-sn-sec-cabeza]'),
    panel: q('[data-sn-panel]'),
    empezar: q('[data-sn-empezar]'),
    avisoEmpezar: q('[data-sn-aviso-empezar]'),
    aviso: q('[data-sn-aviso]'),
    abrirConfig: q('[data-sn-abrir-config]'),
    cuerpo: q('[data-sn-cuerpo]'),
    tablero: q('[data-sn-tablero]'),
    btnDispositivo: q('[data-configurar-dispositivo]'),
    btnRestaurar: q('[data-restaurar-dispositivo]'),
    volver: Array.from(raiz.querySelectorAll('[data-volver-apps]')),
  };

  const config = cargarConfig();
  const tablero = crearTablero(el.tablero);
  const voz = crearVoz();
  const st = {
    jugando: false,
    iniciado: false,
    entrada: /** @type {any} */ (null),
    panel: /** @type {any} */ (null),
    acciones: /** @type {any[]} */ ([]),
    quitarObservador: /** @type {null|(() => void)} */ (null),
    restaurar: /** @type {any} */ (null),
    respondiendo: false, // mientras se dice la respuesta no se lee el resaltado
    tResp: /** @type {any} */ (0),
    tAviso: /** @type {any} */ (0),
    arasaac: /** @type {any} */ (null),
  };

  // ── Avisos y storage ─────────────────────────────────────────────────
  function avisar(texto, ms = 3000) {
    el.aviso.textContent = texto;
    clearTimeout(st.tAviso);
    st.tAviso = setTimeout(() => {
      if (el.aviso.textContent === texto) el.aviso.textContent = '';
    }, ms);
  }

  function errorImagen(texto) {
    el.errorImagen.textContent = texto;
    el.errorImagen.hidden = !texto;
  }

  function guardar() {
    if (!guardarConfig(config)) {
      errorImagen(
        'No se pudo guardar en este navegador (almacenamiento lleno o bloqueado). La app funciona igual, pero no va a recordar los cambios.',
      );
    }
  }

  // ── Voz ──────────────────────────────────────────────────────────────
  function mejorVoz() {
    return elegirVoz(voz.listarVoces(), { sinRed: !navigator.onLine });
  }

  function hablar(texto, extra = {}) {
    const t = limpiarTexto(texto);
    if (!t) return;
    voz.hablar(t, { voz: mejorVoz(), alFallar: (m) => avisar(m, 5000), ...extra });
  }

  /** iOS solo deja hablar después de un gesto: se "destraba" con un habla vacía en el primer toque. */
  function destrabarVoz() {
    try {
      G.speechSynthesis?.speak(new SpeechSynthesisUtterance(''));
    } catch {
      /* sin voz: la app muestra el aviso al intentar hablar */
    }
  }

  function terminarRespuesta() {
    clearTimeout(st.tResp);
    st.respondiendo = false;
  }

  function elegir(id) {
    const celda = celdasActivas(config).find((c) => c.id === id);
    if (!celda) return;
    tablero.elegida(id);
    st.respondiendo = true;
    clearTimeout(st.tResp);
    st.tResp = setTimeout(terminarRespuesta, 8000); // por si la voz nunca avisa que terminó
    if (!limpiarTexto(celda.texto)) {
      terminarRespuesta();
      return;
    }
    hablar(celda.texto, {
      alTerminar: () => setTimeout(terminarRespuesta, 300),
      alFallar: (m) => {
        terminarRespuesta();
        avisar(m, 5000);
      },
    });
  }

  function leerResaltada(id) {
    if (st.respondiendo) return;
    const celda = celdasActivas(config).find((c) => c.id === id);
    if (celda) hablar(celda.texto);
  }

  // ── Editor de casillas ───────────────────────────────────────────────
  const arasaacActivo = () => !!st.arasaac?.ARASAAC_HABILITADO;

  function ponerImagen(indice, imagen, fuente) {
    config.celdas[indice].imagen = imagen;
    config.celdas[indice].fuente = imagen ? fuente : null;
    errorImagen('');
    guardar();
    renderEditor();
  }

  function renderEditor() {
    el.editor.textContent = '';
    celdasActivas(config).forEach((c) => {
      const i = c.indice;
      const fila = document.createElement('div');
      fila.className = 'epe-sn-editor-fila';
      fila.setAttribute('role', 'group');
      fila.setAttribute('aria-label', `Casilla ${i + 1}`);

      const mini = document.createElement('div');
      mini.className = 'epe-sn-miniatura';
      if (esImagenValida(c.imagen)) {
        const img = document.createElement('img');
        img.src = /** @type {string} */ (c.imagen);
        img.alt = '';
        mini.appendChild(img);
      } else {
        const vacio = document.createElement('span');
        vacio.textContent = 'Sin imagen';
        mini.appendChild(vacio);
      }
      fila.appendChild(mini);

      const texto = document.createElement('input');
      texto.type = 'text';
      texto.className = 'epe-sn-texto-input';
      texto.maxLength = MAX_TEXTO;
      texto.placeholder = 'Texto a decir';
      texto.setAttribute('aria-label', `Texto de la casilla ${i + 1}`);
      texto.value = c.texto;
      texto.addEventListener('input', () => {
        config.celdas[i].texto = limpiarTexto(texto.value);
      });
      // Al terminar de escribir se actualizan las etiquetas del panel de teclas.
      texto.addEventListener('change', () => {
        guardar();
        construirPanel();
      });
      const botones = document.createElement('div');
      botones.className = 'epe-sn-editor-botones';
      fila.append(texto, botones);

      const archivoId = `sn-archivo-${i}`;
      const archivo = document.createElement('input');
      archivo.type = 'file';
      archivo.accept = 'image/png,image/jpeg,image/webp';
      archivo.id = archivoId;
      archivo.className = 'epe-sn-archivo';
      archivo.addEventListener('change', async () => {
        const f = archivo.files?.[0];
        if (!f) return;
        try {
          ponerImagen(i, await imagenDesdeArchivo(f), 'archivo');
        } catch (e) {
          errorImagen(String(/** @type {any} */ (e)?.message || e));
        }
      });
      const subir = document.createElement('label');
      subir.className = 'epe-btn-ghost epe-btn-sm';
      subir.setAttribute('for', archivoId);
      subir.textContent = 'Subir imagen';
      botones.append(subir, archivo);

      if (arasaacActivo()) {
        const ara = document.createElement('button');
        ara.type = 'button';
        ara.className = 'epe-btn-ghost epe-btn-sm';
        ara.textContent = 'ARASAAC';
        ara.addEventListener('click', () =>
          abrirBuscadorArasaac(st.arasaac, {
            alElegir: (imagen, palabra) => {
              if (!config.celdas[i].texto && palabra) {
                config.celdas[i].texto = limpiarTexto(palabra);
                construirPanel();
              }
              ponerImagen(i, imagen, 'arasaac');
            },
          }),
        );
        botones.appendChild(ara);
      }

      if (esImagenValida(c.imagen)) {
        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'epe-btn-ghost epe-btn-sm';
        quitar.textContent = 'Quitar imagen';
        quitar.addEventListener('click', () => ponerImagen(i, null, null));
        botones.appendChild(quitar);
      }

      el.editor.appendChild(fila);
    });
    el.atrib.hidden = !arasaacActivo();
  }

  el.tercera.addEventListener('change', () => {
    config.tercera = el.tercera.checked;
    guardar();
    renderEditor();
    construirPanel();
  });
  el.leerResaltar.addEventListener('change', () => {
    config.leerAlResaltar = el.leerResaltar.checked;
    guardar();
  });

  // ── Panel de acceso (teclas, barrido, toque) ─────────────────────────
  // EpeAcceso descarta lo guardado si le falta la tecla de alguna acción;
  // por eso, antes de armarlo, se completan las teclas de la casilla nueva.
  function construirPanel() {
    st.panel?.leer(); // cancela una captura de tecla a medias
    st.acciones = accionesPanel(celdasActivas(config));
    const completo = completarTeclasGuardadas(G.EpeTeclas.leerJSON(CLAVE_ACCESO), st.acciones);
    if (completo) G.EpeTeclas.guardarJSON(CLAVE_ACCESO, completo);
    st.panel = G.EpeAcceso.crearPanel(el.panel, { id: 'si-no', acciones: st.acciones });
  }

  function mostrarSecciones() {
    el.radiosAcceso.forEach((r) => (r.checked = r.value === config.acceso));
    el.secPulsadores.hidden = config.acceso !== 'pulsadores';
    el.secCabeza.hidden = config.acceso !== 'cabeza';
    actualizarBotonDispositivo();
  }
  el.radiosAcceso.forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      config.acceso = r.value === 'cabeza' ? 'cabeza' : 'pulsadores';
      guardar();
      mostrarSecciones();
    }),
  );

  // ── Modo cabeza ──────────────────────────────────────────────────────
  const cabeza = crearModoCabeza({
    el: {
      iniciar: q('[data-sn-iniciar-cabeza]'),
      pausa: q('[data-sn-pausa]'),
      estado: q('[data-sn-estado-cabeza]'),
      abrirCamara: q('[data-sn-abrir-camara]'),
      cerrarCamara: q('[data-sn-cerrar-camara]'),
      modalCamara: q('[data-sn-modal-camara]'),
      modalCamaraCaja: q('[data-sn-modal-camara] .epe-juego-modal'),
      vistaSlot: q('[data-sn-vista-slot]'),
      sens: q('[data-sn-sens]'),
      sensOut: q('[data-sn-sens-out]'),
      sensAviso: q('[data-sn-sens-aviso]'),
      ocultar: q('[data-sn-ocultar]'),
      usarMouse: q('[data-sn-usar-mouse]'),
      radiosSeleccion: Array.from(raiz.querySelectorAll('[name=sn-seleccion]')),
      dwell: q('[data-sn-dwell]'),
      dwellWrap: q('[data-sn-dwell-wrap]'),
      descanso: q('[data-sn-descanso]'),
      descansoWrap: q('[data-sn-descanso-wrap]'),
      recentrarTecla: q('[data-sn-recentrar-tecla]'),
      asignarRecentrar: q('[data-sn-asignar-recentrar]'),
      quitarRecentrar: q('[data-sn-quitar-recentrar]'),
      recentrarAviso: q('[data-sn-recentrar-aviso]'),
      trackyHost: q('[data-sn-tracky-host]'),
      centro: q('[data-sn-centro]'),
      chip: q('[data-sn-chip]'),
      alCambiarModo: () => actualizarBotonDispositivo(),
    },
    tablero,
    cfg: config.cabeza,
    guardar,
    alElegir: elegir,
    aviso: avisar,
  });

  // ── Configuración ↔ uso ──────────────────────────────────────────────
  function textosCompletos() {
    return celdasActivas(config).every((c) => limpiarTexto(c.texto));
  }

  function empezar() {
    if (!textosCompletos()) {
      el.avisoEmpezar.textContent = 'Escribí el texto que se va a decir en cada casilla.';
      return;
    }
    if (config.acceso === 'cabeza' && !cabeza.listoParaEmpezar()) {
      el.avisoEmpezar.textContent =
        'Iniciá el seguimiento de cabeza (o tildá "usar el mouse" para probar la app).';
      return;
    }
    el.avisoEmpezar.textContent = '';
    destrabarVoz();
    el.config.hidden = true;
    el.cuerpo.hidden = false;
    el.abrirConfig.hidden = false;
    st.jugando = true;
    if (!st.iniciado) {
      st.iniciado = true;
      el.empezar.textContent = 'Continuar';
    }
    tablero.dibujar(celdasActivas(config), { franjaDescanso: conFranjaDescanso(config) });
    if (config.acceso === 'pulsadores') iniciarBarrido();
    else cabeza.activar();
  }

  function iniciarBarrido() {
    const cfg = st.panel.leer();
    if (config.leerAlResaltar && cfg.modo !== 'directo') {
      st.quitarObservador = tablero.alResaltar(leerResaltada);
    }
    st.entrada = G.EpeEntrada.crear({
      cfg,
      getObjetivos: () => tablero.objetivos(),
      alAccion: elegir,
      alEscape: volverAConfig,
    });
    st.entrada.iniciar();
  }

  function volverAConfig() {
    if (!st.jugando) return;
    st.entrada?.detener();
    st.entrada = null;
    st.quitarObservador?.();
    st.quitarObservador = null;
    cabeza.desactivar();
    voz.parar();
    terminarRespuesta();
    st.jugando = false;
    tablero.vaciar();
    el.cuerpo.hidden = true;
    el.abrirConfig.hidden = true;
    el.config.hidden = false;
  }

  el.empezar.addEventListener('click', empezar);
  el.abrirConfig.addEventListener('click', volverAConfig);

  // Casilla tocada o clickeada directamente (sin barrido ni cabeza).
  el.tablero.addEventListener('click', (ev) => {
    if (!st.jugando || config.acceso !== 'pulsadores') return;
    const b = /** @type {HTMLElement|null} */ (
      /** @type {Element} */ (ev.target).closest?.('[data-celda]')
    );
    if (b?.dataset.celda) elegir(b.dataset.celda);
  });

  document.addEventListener('keydown', (ev) => {
    if (cabeza.alTecla(ev)) return;
    if (ev.key !== 'Escape') return;
    if (cabeza.camaraAbierta()) {
      cabeza.cerrarCamara();
      return;
    }
    // En los modos de teclas/barrido, Escape lo atiende EpeEntrada (alEscape).
    if (st.jugando && config.acceso === 'cabeza') volverAConfig();
  });

  // ── Dispositivo físico ───────────────────────────────────────────────
  function entradasDispositivo() {
    if (config.acceso === 'cabeza') return entradasCabeza(config.cabeza);
    return G.EpeAcceso.entradasNecesarias(st.panel.leer(), st.acciones);
  }

  function actualizarBotonDispositivo() {
    el.btnDispositivo.hidden =
      config.acceso === 'cabeza' && entradasCabeza(config.cabeza).length === 0;
  }

  function actualizarBotonRestaurar() {
    el.btnRestaurar.hidden = !st.restaurar;
  }

  el.btnDispositivo.addEventListener('click', () => {
    if (!G.EpeConfigurarDispositivo) return; // widget.js no cargó
    G.EpeConfigurarDispositivo.abrir(entradasDispositivo(), {
      titulo: 'Configurar dispositivo — Si-No con pulsadores',
      // Con pocos botones, un mismo botón puede dar dos eventos (toque y pulsación larga).
      combinar: config.acceso === 'pulsadores',
    }).then((r) => {
      if (r?.restaurar) st.restaurar = r.restaurar;
      actualizarBotonRestaurar();
      if (r?.continuar) empezar();
    });
  });

  el.btnRestaurar.addEventListener('click', () => {
    if (!st.restaurar) return;
    const fn = st.restaurar;
    st.restaurar = null;
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

  // Antes de salir (desde donde sea) se ofrece restaurar el dispositivo si quedó algo pendiente.
  function salirConfirmado(luego) {
    if (!(G.EpeConfigurarDispositivo && st.restaurar)) {
      luego();
      return;
    }
    G.EpeConfigurarDispositivo.confirmarSalida(st.restaurar).then((r) => {
      if (!r.salir) return;
      if (r.restaurado) {
        st.restaurar = null;
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

  // ── Arranque ─────────────────────────────────────────────────────────
  el.tercera.checked = config.tercera;
  el.leerResaltar.checked = config.leerAlResaltar;
  construirPanel();
  renderEditor();
  mostrarSecciones();
  actualizarBotonRestaurar();

  // ARASAAC es un módulo aparte (con su interruptor de habilitación). Si no
  // carga, la opción simplemente no aparece y todo lo demás funciona igual.
  import('../vincular-imagen/arasaac.js')
    .then((m) => {
      st.arasaac = m;
      el.atrib.textContent = m.ATRIBUCION_CORTA;
      renderEditor();
    })
    .catch(() => {
      st.arasaac = null;
    });

  // Gancho para pruebas automáticas (no lo usa la interfaz).
  G.__sn = {
    st,
    config,
    elegir,
    empezar,
    volverAConfig,
  };
}

const raiz = document.querySelector('[data-sn-raiz]');
if (raiz) iniciar(raiz);
