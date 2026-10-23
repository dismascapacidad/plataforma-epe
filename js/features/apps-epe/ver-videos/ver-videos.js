/**
 * ver-videos.js
 * App EpE — Ver videos con pulsadores. Reproduce videos de YouTube con un
 * reproductor centrado y, debajo, solo lo imprescindible: dos botones con listas
 * de reproducción ya enlazadas y tres controles (Pausa, Play, Siguiente video).
 * Opcional: Play y Pausa en un solo botón, cuyo ícono cambia con el estado del
 * reproductor (muestra lo que pasa al pulsar: pausa si suena, play si no).
 * Ampliar: el video ocupa casi toda la pantalla (botón para quien acompaña, fuera
 * del barrido). Es una ampliación de la propia página, no la pantalla completa de
 * YouTube: con la nativa el teclado le llegaría al reproductor (otro origen) y los
 * pulsadores dejarían de funcionar. Los botones quedan en una barra debajo, nunca
 * encima del reproductor (políticas de YouTube).
 *
 * Pensado para manejarse sin puntero, como el resto de las Apps EpE:
 * - Cinco acciones (lista 1, lista 2, pausa, play, siguiente; cuatro si Play y Pausa
 *   comparten botón) con una tecla cada una (A S D F G por defecto, reasignables), o
 *   barrido de 1 o 2 pulsadores, o la
 *   pantalla táctil como pulsador. Todo eso lo resuelven acceso.js y entrada.js.
 * - El dispositivo dis+capacidad se configura con el widget «Configurar
 *   dispositivo». No hay medición de tiempos, así que se admite «un botón, dos
 *   eventos» (Tap-Hold): `combinar: true`.
 * - El puntero también funciona, pero el teclado nunca depende de él. Los botones
 *   responden al soltar (click) y no al apoyar: en iOS el reproductor de YouTube
 *   solo acepta empezar si la orden nace de un gesto del usuario, y pointerdown
 *   táctil no cuenta como gesto (ver «Regla de plataforma: acceso táctil»).
 *
 * Preparación (modal): enlazar las dos listas pegando el enlace de YouTube (de una
 * lista de reproducción o de un video) y ponerles un nombre. «Buscar en YouTube»
 * abre YouTube en otra pestaña: en esta versión no hay buscador propio.
 *
 * Lo guardado (listas.js) vive solo en este navegador. El reproductor
 * (youtube.js) no se pide hasta que se elige una lista.
 *
 * Script clásico. Namespace: EpeVerVideos. Depende de teclas.js, entrada.js,
 * acceso.js y youtube.js, y carga listas.js (módulo ES) con import().
 */

var EpeVerVideos = (function () {
  var ACCIONES = [
    { id: "lista0", etiqueta: "Lista 1", tecla: "a" },
    { id: "lista1", etiqueta: "Lista 2", tecla: "s" },
    { id: "pausa", etiqueta: "Pausa", tecla: "d" },
    { id: "play", etiqueta: "Play", tecla: "f" },
    { id: "siguiente", etiqueta: "Siguiente video", tecla: "g" },
  ];
  // Con Play y Pausa en un solo botón son cuatro acciones. Cada modo guarda sus
  // propias teclas y su propio barrido (el panel se identifica por modo).
  var ACCIONES_UN_BOTON = [
    { id: "lista0", etiqueta: "Lista 1", tecla: "a" },
    { id: "lista1", etiqueta: "Lista 2", tecla: "s" },
    { id: "alternar", etiqueta: "Play / Pausa", tecla: "d" },
    { id: "siguiente", etiqueta: "Siguiente video", tecla: "f" },
  ];

  var TEXTO_VACIA = "Enlazá tu video";
  var NS_SVG = "http://www.w3.org/2000/svg";

  // Textos de error del reproductor de YouTube (onError).
  var ERRORES = {
    2: "El enlace de ese video no es válido.",
    5: "El reproductor tuvo un problema con ese video.",
    100: "Ese video no está disponible (puede ser privado o estar borrado).",
    101: "Ese video no permite reproducirse fuera de YouTube.",
    150: "Ese video no permite reproducirse fuera de YouTube.",
  };

  function init(root) {
    if (!root) return;
    import("./listas.js").then(
      function (L) {
        arrancar(root, L);
      },
      function () {
        var intro = root.querySelector("[data-juego-config] .epe-juego-intro");
        if (intro) intro.textContent = "No se pudo cargar la aplicación. Recargá la página.";
      }
    );
  }

  // Dibuja un ícono SVG chico con el DOM (sin innerHTML).
  function svg(formas) {
    var el = document.createElementNS(NS_SVG, "svg");
    el.setAttribute("viewBox", "0 0 24 24");
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", "currentColor");
    el.setAttribute("stroke-width", "2");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
    el.setAttribute("aria-hidden", "true");
    formas.forEach(function (f) {
      var p = document.createElementNS(NS_SVG, "path");
      p.setAttribute("d", f.d);
      if (f.relleno) p.setAttribute("fill", "currentColor");
      el.appendChild(p);
    });
    return el;
  }

  var ICONO_LISTA = [{ d: "M3 6h12M3 12h12M3 18h7" }, { d: "M15 13v8l6-4z", relleno: true }];
  var ICONO_VIDEO = [{ d: "M3 5h18v14H3z" }, { d: "M10 9v6l5-3z", relleno: true }];

  function arrancar(root, L) {
    // ── DOM ──────────────────────────────────────────────────────────
    var elConfig = root.querySelector("[data-juego-config]");
    var elEmpezar = root.querySelector("[data-juego-empezar]");
    var grupos = Array.prototype.slice.call(root.querySelectorAll("[data-vv-grupo]"));
    var formBuscar = root.querySelector("[data-vv-buscar]");
    var inBusqueda = root.querySelector("[data-vv-busqueda]");
    var btnBorrar = root.querySelector("[data-vv-borrar]");
    var elJuego = root.querySelector("[data-vv-juego]");
    var elPantalla = root.querySelector("[data-vv-pantalla]");
    var elVacio = root.querySelector("[data-vv-vacio]");
    var elMensaje = root.querySelector("[data-vv-mensaje]");
    var elAyuda = root.querySelector("[data-juego-ayuda]");
    var btnsLista = Array.prototype.slice.call(root.querySelectorAll("[data-vv-lista]"));
    var btnsAccion = {
      pausa: root.querySelector('[data-vv-accion="pausa"]'),
      play: root.querySelector('[data-vv-accion="play"]'),
      alternar: root.querySelector('[data-vv-accion="alternar"]'),
      siguiente: root.querySelector('[data-vv-accion="siguiente"]'),
    };
    var elBotonera = root.querySelector(".epe-vv-botonera");
    var chkUnBoton = root.querySelector("[data-vv-un-boton]");
    var elPanelAcceso = root.querySelector("[data-acceso-panel]");
    var btnSalir = root.querySelector("[data-vv-salir]");
    var btnAmpliar = root.querySelector("[data-vv-ampliar]");
    var btnReducir = root.querySelector("[data-vv-reducir]");
    var btnConfigurarDispositivo = root.querySelector("[data-configurar-dispositivo]");
    var btnRestaurarDispositivo = root.querySelector("[data-restaurar-dispositivo]");
    var enlacesVolverApps = Array.prototype.slice.call(root.querySelectorAll("[data-volver-apps]"));

    // ── Estado ───────────────────────────────────────────────────────
    var opciones = L.cargarOpciones(); // { unBoton, ampliado }
    var acciones = opciones.unBoton ? ACCIONES_UN_BOTON : ACCIONES;
    var panel = crearPanelDeAcceso();
    var reproduciendo = false; // según el último estado que informó el reproductor
    var soloVideo = false; // un Mix que YouTube no aceptó: suena solo su video
    var listas = L.cargarListas(); // [item|null, item|null]
    var avisosEnlace = [null, null]; // mensaje pasajero bajo cada enlace
    var cfg = null;
    var entrada = null;
    var actual = null; // índice de la lista que se eligió, o null
    var promesaReproductor = null;
    var timerBorrar = null;
    var restaurarDispositivo = null; // función para volver el dispositivo a como estaba, o null

    function crearPanelDeAcceso() {
      return EpeAcceso.crearPanel(elPanelAcceso, {
        id: opciones.unBoton ? "ver-videos-un-boton" : "ver-videos",
        acciones: acciones,
        permitirBarrido: true,
      });
    }

    // Muestra los controles que corresponden al modo (Pausa y Play, o uno solo).
    function aplicarModoControles() {
      btnsAccion.pausa.hidden = opciones.unBoton;
      btnsAccion.play.hidden = opciones.unBoton;
      btnsAccion.alternar.hidden = !opciones.unBoton;
      elBotonera.classList.toggle("es-un-boton", opciones.unBoton);
      renderAlternar();
    }

    // Video ampliado: solo mientras se ve la pantalla de juego (la preparación no).
    function aplicarAmpliado() {
      var enJuego = !elJuego.hidden;
      var ampliado = opciones.ampliado && enJuego;
      root.classList.toggle("is-ampliado", ampliado);
      btnReducir.hidden = !ampliado;
    }

    // Ampliar y Reducir son botones para quien acompaña: no entran al barrido.
    // Tras el toque se quita el foco, así Espacio/Enter de un pulsador no lo repiten.
    function ampliar(valor) {
      opciones.ampliado = valor;
      L.guardarOpciones(opciones);
      aplicarAmpliado();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }

    // El ícono muestra lo que pasa al pulsar: pausa mientras suena, play si no.
    function renderAlternar() {
      var btn = btnsAccion.alternar;
      // Los <svg> no tienen la propiedad `hidden`: se usa el atributo.
      btn.querySelector('[data-vv-icono="play"]').toggleAttribute("hidden", reproduciendo);
      btn.querySelector('[data-vv-icono="pausa"]').toggleAttribute("hidden", !reproduciendo);
      btn.setAttribute("aria-label", reproduciendo ? "Pausa" : "Play");
    }

    function cambiarModo() {
      EpeTeclas.cancelarCaptura();
      acciones = opciones.unBoton ? ACCIONES_UN_BOTON : ACCIONES;
      elPanelAcceso.textContent = "";
      panel = crearPanelDeAcceso();
      aplicarModoControles();
    }

    // ── Preparación ──────────────────────────────────────────────────
    function textoEstadoEnlace(i) {
      if (avisosEnlace[i]) return avisosEnlace[i].texto;
      var item = listas[i];
      if (!item) return "Todavía sin enlace.";
      return "Enlazada: " + (item.tipo === "lista" ? "una lista" : "un video") + " de YouTube.";
    }

    function renderConfig() {
      grupos.forEach(function (g, i) {
        var estado = g.querySelector("[data-vv-enlace-estado]");
        estado.textContent = textoEstadoEnlace(i);
        estado.classList.toggle("is-error", !!(avisosEnlace[i] && avisosEnlace[i].error));
        g.querySelector("[data-vv-quitar]").hidden = !listas[i];
        g.classList.toggle("is-enlazada", !!listas[i]);
      });
      elEmpezar.disabled = !listas.some(Boolean);
    }

    // Vuelca lo guardado a los campos de nombre (al abrir, al quitar o al borrar).
    function cargarCampos() {
      grupos.forEach(function (g, i) {
        g.querySelector("[data-vv-nombre]").value = listas[i] ? listas[i].nombre : "";
        g.querySelector("[data-vv-enlace]").value = "";
      });
    }

    function guardar() {
      L.guardarListas(listas);
    }

    function avisar(i, texto, error) {
      avisosEnlace[i] = { texto: texto, error: !!error };
      renderConfig();
    }

    grupos.forEach(function (g, i) {
      var inNombre = g.querySelector("[data-vv-nombre]");
      var inEnlace = g.querySelector("[data-vv-enlace]");

      g.querySelector("[data-vv-form]").addEventListener("submit", function (ev) {
        ev.preventDefault();
        var r = L.analizarEnlace(inEnlace.value);
        if (!r.ok) {
          avisar(i, L.MOTIVOS[r.motivo], true);
          inEnlace.focus();
          return;
        }
        var nombre = L.normalizarNombre(inNombre.value) || L.nombrePorDefecto(r.tipo);
        listas[i] = { tipo: r.tipo, id: r.id, nombre: nombre };
        if (r.video) listas[i].video = r.video; // Mix: video de respaldo
        inNombre.value = nombre;
        inEnlace.value = "";
        guardar();
        avisar(i, (r.tipo === "lista" ? "Lista enlazada" : "Video enlazado") + " ✓", false);
      });

      // Cambiar el nombre de una lista ya enlazada se guarda enseguida.
      inNombre.addEventListener("input", function () {
        if (!listas[i]) return;
        listas[i].nombre = L.normalizarNombre(inNombre.value) || L.nombrePorDefecto(listas[i].tipo);
        guardar();
      });

      inEnlace.addEventListener("input", function () {
        if (avisosEnlace[i]) {
          avisosEnlace[i] = null;
          renderConfig();
        }
      });

      g.querySelector("[data-vv-quitar]").addEventListener("click", function () {
        listas[i] = null;
        avisosEnlace[i] = null;
        inNombre.value = "";
        inEnlace.value = "";
        guardar();
        renderConfig();
      });
    });

    formBuscar.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var url = L.urlBusqueda(inBusqueda.value);
      if (!url) {
        inBusqueda.focus();
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });

    // Borrar todo lo guardado: pide un segundo toque para confirmar.
    btnBorrar.addEventListener("click", function () {
      if (!btnBorrar.classList.contains("is-confirmando")) {
        btnBorrar.classList.add("is-confirmando");
        btnBorrar.textContent = "¿Seguro? Tocá de nuevo";
        timerBorrar = window.setTimeout(restablecerBorrar, 4000);
        return;
      }
      restablecerBorrar();
      L.borrarListas();
      listas = [null, null];
      avisosEnlace = [null, null];
      cargarCampos();
      renderConfig();
    });

    function restablecerBorrar() {
      window.clearTimeout(timerBorrar);
      btnBorrar.classList.remove("is-confirmando");
      btnBorrar.textContent = "Borrar mis listas";
    }

    // ── Pantalla: botones de listas ─────────────────────────────────
    function renderBotonera() {
      btnsLista.forEach(function (btn, i) {
        var item = listas[i];
        var marca = btn.querySelector("[data-vv-marca]");
        marca.textContent = "";
        if (item) marca.appendChild(svg(item.tipo === "lista" ? ICONO_LISTA : ICONO_VIDEO));
        else marca.textContent = "?";
        btn.querySelector("[data-vv-nombre-boton]").textContent = item ? item.nombre : TEXTO_VACIA;
        btn.classList.toggle("is-vacia", !item);
        btn.setAttribute("aria-label", item ? "Reproducir: " + item.nombre : "Lista " + (i + 1) + " sin enlazar");
        btn.setAttribute("aria-pressed", String(actual === i));
        btn.classList.toggle("is-elegida", actual === i);
      });
    }

    function mensaje(texto, tipo) {
      elMensaje.textContent = texto || "";
      elMensaje.className = "epe-vv-mensaje" + (tipo ? " is-" + tipo : "");
    }

    function nombreActual() {
      return actual !== null && listas[actual] ? listas[actual].nombre : "";
    }

    // ── Reproductor ──────────────────────────────────────────────────
    function textoDeEstado(codigo) {
      var E = EpeYoutube.ESTADO;
      if (codigo === E.REPRODUCIENDO) return "Reproduciendo";
      if (codigo === E.PAUSA) return "En pausa";
      if (codigo === E.CARGANDO) return "Cargando…";
      if (codigo === E.TERMINO) return "Terminó";
      return null;
    }

    function alEstado(codigo) {
      var E = EpeYoutube.ESTADO;
      reproduciendo = codigo === E.REPRODUCIENDO || codigo === E.CARGANDO;
      renderAlternar();
      var t = textoDeEstado(codigo);
      if (!t) return;
      mensaje((nombreActual() ? nombreActual() + (soloVideo ? " (solo el video)" : "") + " · " : "") + t, null);
    }

    function alError(codigo, saltado, demasiados) {
      if (demasiados || !saltado) {
        reproduciendo = false;
        renderAlternar();
      }
      if (demasiados) {
        mensaje("Ningún video de esta lista se puede reproducir. Probá con otra.", "error");
        return;
      }
      var base = ERRORES[codigo] || "No se pudo reproducir ese video.";
      mensaje(base + (saltado ? " Pasó al siguiente." : ""), "error");
    }

    function alBloqueo() {
      reproduciendo = false;
      renderAlternar();
      mensaje("El navegador no dejó empezar solo: tocá Play.", "error");
    }

    function alRespaldo() {
      soloVideo = true;
      mensaje("YouTube no dejó usar esa lista: se reproduce solo el video.", "error");
    }

    // El reproductor se crea la primera vez que hace falta, no antes.
    function conReproductor(fn) {
      if (!promesaReproductor) {
        mensaje("Cargando el reproductor de YouTube…", null);
        promesaReproductor = EpeYoutube.crear(elPantalla, {
          alEstado: alEstado,
          alError: alError,
          alBloqueo: alBloqueo,
          alRespaldo: alRespaldo,
        }).then(function (ctrl) {
          elVacio.hidden = true;
          return ctrl;
        });
        promesaReproductor.catch(function () {
          promesaReproductor = null;
          actual = null;
          renderBotonera();
          mensaje("No se pudo cargar YouTube. Revisá la conexión y volvé a intentar.", "error");
        });
      }
      promesaReproductor.then(fn, function () {});
    }

    // ── Acciones ─────────────────────────────────────────────────────
    function elegirLista(i) {
      var item = listas[i];
      if (!item) {
        mensaje("Esa tarjeta no tiene video. Enlazalo desde la preparación (Esc).", "error");
        return;
      }
      actual = i;
      soloVideo = false;
      reproduciendo = false;
      renderAlternar();
      renderBotonera();
      mensaje(item.nombre + " · Cargando…", null);
      conReproductor(function (ctrl) {
        if (actual !== i) return; // mientras cargaba, se eligió otra
        ctrl.cargar(item);
      });
    }

    function ordenSinLista() {
      mensaje("Primero elegí una lista.", "error");
    }

    function reproducir() {
      if (actual === null) return ordenSinLista();
      conReproductor(function (ctrl) {
        ctrl.reproducir();
      });
    }

    function pausar() {
      if (actual === null) return ordenSinLista();
      conReproductor(function (ctrl) {
        ctrl.pausar();
      });
    }

    // Un solo botón: pausa si está sonando, y si no, reproduce.
    function alternar() {
      if (reproduciendo) pausar();
      else reproducir();
    }

    function siguiente() {
      if (actual === null) return ordenSinLista();
      conReproductor(function (ctrl) {
        var r = ctrl.siguiente();
        if (r === "video-unico") mensaje("Esa tarjeta es un solo video: no hay siguiente.", null);
      });
    }

    function elementoDe(id) {
      if (id === "lista0") return btnsLista[0];
      if (id === "lista1") return btnsLista[1];
      return btnsAccion[id];
    }

    // Con teclado o pulsador no hay clic que se vea: un destello confirma la orden.
    function destellar(id) {
      var el = elementoDe(id);
      if (!el) return;
      el.classList.add("is-pulsada");
      window.setTimeout(function () {
        el.classList.remove("is-pulsada");
      }, 220);
    }

    function alAccion(id) {
      destellar(id);
      if (id === "lista0") elegirLista(0);
      else if (id === "lista1") elegirLista(1);
      else if (id === "pausa") pausar();
      else if (id === "play") reproducir();
      else if (id === "alternar") alternar();
      else if (id === "siguiente") siguiente();
    }

    // ── Entrada (teclas directas o barrido) ──────────────────────────
    // En el recorrido del barrido entran solo las listas enlazadas: una tarjeta
    // vacía no hace nada, y recorrerla le costaría un paso a quien usa pulsador.
    function getObjetivos() {
      var lista = [];
      btnsLista.forEach(function (el, i) {
        if (listas[i]) lista.push({ id: "lista" + i, el: el });
      });
      if (opciones.unBoton) {
        lista.push({ id: "alternar", el: btnsAccion.alternar });
      } else {
        lista.push({ id: "pausa", el: btnsAccion.pausa });
        lista.push({ id: "play", el: btnsAccion.play });
      }
      lista.push({ id: "siguiente", el: btnsAccion.siguiente });
      return lista;
    }

    function actualizarAyuda() {
      elAyuda.innerHTML = "";
      EpeAcceso.resumenTeclas(cfg, acciones).forEach(function (item) {
        var span = document.createElement("span");
        span.className = "epe-juego-ayuda-item";
        var kbd = document.createElement("kbd");
        kbd.className = "epe-tecla";
        kbd.textContent = item.tecla;
        span.appendChild(kbd);
        span.appendChild(document.createTextNode(item.texto));
        elAyuda.appendChild(span);
      });
    }

    // Con teclas directas cada botón muestra su tecla; con barrido las teclas no
    // son por botón, así que se ocultan (la ayuda las explica).
    function actualizarChips() {
      var directo = cfg.modo === "directo";
      Array.prototype.forEach.call(root.querySelectorAll("[data-tecla-accion]"), function (chip) {
        var tecla = cfg.teclas[chip.getAttribute("data-tecla-accion")];
        chip.hidden = !directo || !tecla;
        if (directo && tecla) chip.textContent = EpeTeclas.etiqueta(tecla);
      });
    }

    // ── Flujo de pantallas ───────────────────────────────────────────
    function empezar() {
      if (!listas.some(Boolean)) return;
      cfg = panel.leer();
      if (entrada) entrada.detener();
      entrada = EpeEntrada.crear({
        cfg: cfg,
        getObjetivos: getObjetivos,
        alAccion: alAccion,
        alEscape: function () {
          // Ampliado, Esc primero reduce; con el video normal, vuelve a la preparación.
          if (opciones.ampliado) ampliar(false);
          else salirConfirmado(salirAConfig);
        },
      });
      elConfig.hidden = true;
      elJuego.hidden = false;
      aplicarAmpliado();
      actual = null;
      reproduciendo = false;
      aplicarModoControles();
      renderBotonera();
      actualizarChips();
      actualizarAyuda();
      mensaje("Elegí una lista para empezar.", null);
      entrada.iniciar();
    }

    function salirAConfig() {
      if (entrada) entrada.detener();
      if (promesaReproductor) {
        promesaReproductor.then(
          function (ctrl) {
            ctrl.detener();
          },
          function () {}
        );
      }
      actual = null;
      reproduciendo = false;
      renderAlternar();
      elJuego.hidden = true;
      elConfig.hidden = false;
      aplicarAmpliado();
      renderConfig();
      if (!elEmpezar.disabled) elEmpezar.focus();
    }

    // ── Configurar dispositivo físico ───────────────────────────────
    // Usa la selección de teclas actual del panel (aunque todavía no se haya
    // apretado "Empezar").
    function configurarDispositivo() {
      if (!window.EpeConfigurarDispositivo) return; // widget.js no cargó
      var entradas = EpeAcceso.entradasNecesarias(panel.leer(), acciones);
      window.EpeConfigurarDispositivo
        .abrir(entradas, { titulo: "Configurar dispositivo — Ver videos con pulsadores", combinar: true })
        .then(function (resultado) {
          if (resultado && resultado.restaurar) restaurarDispositivo = resultado.restaurar;
          actualizarBotonRestaurar();
          // El usuario ya apretó "Empezar" dentro del propio modal: arrancamos
          // directo, sin pedirle un segundo clic acá.
          if (resultado && resultado.continuar) empezar();
        });
    }

    function actualizarBotonRestaurar() {
      if (btnRestaurarDispositivo) btnRestaurarDispositivo.hidden = !restaurarDispositivo;
    }

    function restaurarDispositivoClick() {
      if (!restaurarDispositivo) return;
      var fn = restaurarDispositivo;
      restaurarDispositivo = null;
      btnRestaurarDispositivo.disabled = true;
      btnRestaurarDispositivo.textContent = "Restaurando…";
      fn()
        .then(function (r) {
          btnRestaurarDispositivo.textContent = r && r.ok ? "Listo" : "Quedó distinto en algún campo";
        })
        .catch(function () {
          btnRestaurarDispositivo.textContent = "No se pudo restaurar";
        })
        .then(function () {
          window.setTimeout(function () {
            btnRestaurarDispositivo.disabled = false;
            btnRestaurarDispositivo.textContent = "Restaurar dispositivo";
            actualizarBotonRestaurar();
          }, 2500);
        });
    }

    // Antes de cualquier salida (volver a la preparación, o irse de la página)
    // recuerda restaurar el dispositivo si quedó algo pendiente. `luegoSalir` es
    // lo que hay que hacer una vez que es seguro seguir.
    function salirConfirmado(luegoSalir) {
      if (!(window.EpeConfigurarDispositivo && restaurarDispositivo)) {
        luegoSalir();
        return;
      }
      var fn = restaurarDispositivo;
      window.EpeConfigurarDispositivo.confirmarSalida(fn).then(function (r) {
        if (!r.salir) return;
        if (r.restaurado) {
          restaurarDispositivo = null;
          actualizarBotonRestaurar();
        }
        luegoSalir();
      });
    }

    function irAApps() {
      window.location.href = "index.html";
    }

    // ── Eventos ──────────────────────────────────────────────────────
    if (btnConfigurarDispositivo) {
      btnConfigurarDispositivo.addEventListener("click", configurarDispositivo);
    }
    if (btnRestaurarDispositivo) {
      btnRestaurarDispositivo.addEventListener("click", restaurarDispositivoClick);
      actualizarBotonRestaurar();
    }
    enlacesVolverApps.forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        salirConfirmado(irAApps);
      });
    });
    elEmpezar.addEventListener("click", empezar);
    btnAmpliar.addEventListener("click", function () {
      ampliar(true);
    });
    btnReducir.addEventListener("click", function () {
      ampliar(false);
    });
    btnSalir.addEventListener("click", function () {
      salirConfirmado(salirAConfig);
    });
    btnsLista.forEach(function (btn, i) {
      btn.addEventListener("click", function () {
        alAccion("lista" + i);
      });
    });
    Object.keys(btnsAccion).forEach(function (id) {
      btnsAccion[id].addEventListener("click", function () {
        alAccion(id);
      });
    });

    chkUnBoton.checked = opciones.unBoton;
    chkUnBoton.addEventListener("change", function () {
      opciones.unBoton = chkUnBoton.checked;
      L.guardarOpciones(opciones);
      cambiarModo();
    });

    aplicarModoControles();
    cargarCampos();
    renderConfig();
    renderBotonera();
    if (!elEmpezar.disabled) elEmpezar.focus();
    else grupos[0].querySelector("[data-vv-enlace]").focus();
  }

  return { init: init };
})();
