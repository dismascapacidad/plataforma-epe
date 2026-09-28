/**
 * vincular-imagen.js
 * App EpE — Vincular botón/tecla a imagen + texto a voz. De 1 a 8
 * casilleros configurables; cada uno tiene: una imagen propia (subida por
 * archivo, no URL — así funciona sin conexión y sin depender de que la
 * imagen esté alojada en otro lado), un texto que se lee en voz alta al
 * activar el casillero (Web Speech API), y una tecla propia que el mismo
 * usuario asigna presionándola (no hay un mapeo fijo: cada instalación de
 * switches puede tener sus propias teclas emuladas).
 *
 * Mismo esquema que el resto de las Apps EpE: modal de configuración
 * primero (acá, cantidad + imagen/texto/tecla de cada casillero), después
 * el juego (la grilla de botones grandes, ya sin controles de edición
 * encima). Con el juego iniciado, Escape vuelve a abrir la configuración
 * sin perder lo cargado — mismo criterio que Barrido, porque acá tampoco
 * hay una "partida" que termine.
 *
 * Script clásico. Namespace: EpeVincularImagen.
 */

var EpeVincularImagen = (function () {
  var MAX_CASILLEROS = 8;
  var MIN_CASILLEROS = 1;

  function init(root) {
    var casillas = []; // { imagen: dataURL|null, texto: string, tecla: string|null }
    var esperandoTeclaIdx = null;
    var iniciado = false; // true después del primer "Empezar"

    var elConfig = root.querySelector("[data-vi-config]");
    var elCantidad = root.querySelector("[data-vi-cantidad]");
    var elEditor = root.querySelector("[data-vi-editor]");
    var elEmpezar = root.querySelector("[data-vi-empezar]");
    var elGrilla = root.querySelector("[data-vi-grilla]");
    var btnConfigurarDispositivo = root.querySelector("[data-configurar-dispositivo]");
    var btnRestaurarDispositivo = root.querySelector("[data-restaurar-dispositivo]");
    var enlacesVolverApps = Array.prototype.slice.call(root.querySelectorAll("[data-volver-apps]"));
    var restaurarDispositivo = null; // función pendiente para devolver el dispositivo a como estaba

    elCantidad.addEventListener("change", function () {
      ajustarCantidad(Number(elCantidad.value));
      renderConfig();
    });

    elEmpezar.addEventListener("click", empezar);

    document.addEventListener("keydown", function (ev) {
      if (ev.repeat) return;
      var tecla = ev.key.toLowerCase();

      if (esperandoTeclaIdx !== null) {
        if (tecla !== "escape") asignarTecla(esperandoTeclaIdx, tecla);
        esperandoTeclaIdx = null;
        renderConfig();
        return;
      }

      if (tecla === "escape") {
        if (iniciado && elConfig.hidden) volverAConfig();
        return;
      }

      // Mientras la configuración está abierta (al arrancar, o reabierta
      // con Escape) las teclas de juego no activan casilleros — si no, una
      // pulsación mientras se está reconfigurando activaría uno sin querer.
      if (!elConfig.hidden) return;

      var idx = casillas.findIndex(function (c) {
        return c.tecla === tecla;
      });
      if (idx !== -1) activar(idx);
    });

    function ajustarCantidad(n) {
      n = Math.max(MIN_CASILLEROS, Math.min(MAX_CASILLEROS, n || MIN_CASILLEROS));
      while (casillas.length < n) {
        casillas.push({ imagen: null, texto: "", tecla: null });
      }
      casillas.length = n;
    }

    function asignarTecla(idx, tecla) {
      // Una tecla no puede quedar en dos casilleros a la vez: si ya estaba
      // usada en otro, se la sacamos de ahí.
      casillas.forEach(function (c, i) {
        if (i !== idx && c.tecla === tecla) c.tecla = null;
      });
      casillas[idx].tecla = tecla;
    }

    function hablar(texto) {
      if (!texto || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "es-AR";
      window.speechSynthesis.speak(utterance);
    }

    function activar(idx) {
      var card = elGrilla.children[idx];
      if (card) {
        card.classList.add("is-activa");
        window.setTimeout(function () {
          card.classList.remove("is-activa");
        }, 450);
      }
      hablar(casillas[idx].texto);
    }

    // ── Configuración ↔ juego ───────────────────────────────────────────
    function empezar() {
      iniciado = true;
      elConfig.hidden = true;
      elGrilla.hidden = false;
      renderJuego();
    }

    function volverAConfig() {
      elGrilla.hidden = true;
      elConfig.hidden = false;
      renderConfig();
    }

    // ── Configurar dispositivo físico ─────────────────────────────────
    // Acá tampoco hay panel de reasignación: las entradas son las teclas ya
    // asignadas a cada casillero desde el editor. Los casilleros sin tecla
    // asignada quedan afuera (no hay nada del lado del juego a lo que
    // mapearlos todavía).
    function entradasDispositivo() {
      var lista = [];
      casillas.forEach(function (c, idx) {
        if (!c.tecla) return;
        lista.push({ id: String(idx), etiqueta: c.texto || "Casillero " + (idx + 1), tecla: c.tecla });
      });
      return lista;
    }

    function configurarDispositivo() {
      if (!window.EpeConfigurarDispositivo) return; // widget.js no cargó
      window.EpeConfigurarDispositivo
        .abrir(entradasDispositivo(), { titulo: "Configurar dispositivo — Vincular imagen" })
        .then(function (resultado) {
          if (resultado && resultado.restaurar) restaurarDispositivo = resultado.restaurar;
          actualizarBotonRestaurar();
          // El usuario ya apretó "Empezar" dentro del propio modal: arrancamos
          // directo, sin pedirle un segundo click acá.
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

    // Antes de cualquier salida (volver a Apps EpE, desde donde sea) recuerda
    // restaurar el dispositivo si quedó algo pendiente. `luegoSalir` es lo
    // que hay que hacer una vez que es seguro seguir.
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

    // Cuántas columnas usar según cuántos casilleros hay y el ancho de
    // pantalla (en una pantalla angosta, menos columnas para que cada
    // casillero no quede demasiado chico). Las filas salen de dividir la
    // cantidad de casilleros por esas columnas, y grid-template-rows: 1fr
    // hace que todas las filas quepan siempre en el alto disponible, sin
    // scroll, sin importar cuántas sean.
    function actualizarLayout() {
      var maxColumnas = window.innerWidth < 720 ? 2 : 4;
      var columnas = Math.min(maxColumnas, casillas.length);
      var filas = Math.ceil(casillas.length / columnas);
      elGrilla.style.setProperty("--vi-columnas", String(columnas));
      elGrilla.style.setProperty("--vi-filas", String(filas));
    }

    window.addEventListener("resize", function () {
      if (!elGrilla.hidden) actualizarLayout();
    });

    // ── Juego: solo la grilla de botones grandes, sin controles ────────
    function renderJuego() {
      elGrilla.innerHTML = "";
      actualizarLayout();

      casillas.forEach(function (c, idx) {
        var card = document.createElement("div");
        card.className = "epe-vi-card";

        var playArea = document.createElement("button");
        playArea.type = "button";
        playArea.className = "epe-vi-play";
        playArea.setAttribute("aria-label", c.texto || "Casillero " + (idx + 1));

        if (c.imagen) {
          var img = document.createElement("img");
          img.src = c.imagen;
          img.alt = c.texto || "";
          playArea.appendChild(img);
        } else {
          var vacio = document.createElement("span");
          vacio.className = "epe-vi-vacio";
          vacio.textContent = "Sin imagen";
          playArea.appendChild(vacio);
        }
        playArea.addEventListener("click", function () {
          activar(idx);
        });
        card.appendChild(playArea);

        elGrilla.appendChild(card);
      });
    }

    // ── Configuración: una fila compacta por casillero ──────────────────
    function renderConfig() {
      elEditor.innerHTML = "";

      casillas.forEach(function (c, idx) {
        var fila = document.createElement("div");
        fila.className = "epe-vi-editor-fila";

        // ── Miniatura de lo ya cargado ──
        var miniatura = document.createElement("div");
        miniatura.className = "epe-vi-editor-miniatura";
        if (c.imagen) {
          var img = document.createElement("img");
          img.src = c.imagen;
          img.alt = "";
          miniatura.appendChild(img);
        } else {
          var vacio = document.createElement("span");
          vacio.className = "epe-vi-vacio";
          vacio.textContent = "Sin imagen";
          miniatura.appendChild(vacio);
        }
        fila.appendChild(miniatura);

        var fileId = "vi-file-" + idx;
        var fileLabel = document.createElement("label");
        fileLabel.className = "epe-btn-ghost epe-btn-sm";
        fileLabel.setAttribute("for", fileId);
        fileLabel.textContent = "Imagen";

        var fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.id = fileId;
        fileInput.className = "epe-vi-file-input";
        fileInput.addEventListener("change", function (ev) {
          var file = ev.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (e) {
            casillas[idx].imagen = e.target.result;
            renderConfig();
          };
          reader.readAsDataURL(file);
        });

        var textoInput = document.createElement("input");
        textoInput.type = "text";
        textoInput.className = "epe-vi-texto-input";
        textoInput.placeholder = "Texto a leer";
        textoInput.value = c.texto;
        textoInput.addEventListener("input", function () {
          casillas[idx].texto = textoInput.value;
        });

        var teclaBtn = document.createElement("button");
        teclaBtn.type = "button";
        teclaBtn.className = "epe-btn-ghost epe-btn-sm epe-vi-tecla-btn";
        teclaBtn.textContent =
          esperandoTeclaIdx === idx ? "Presioná una tecla…" : c.tecla ? "Tecla: " + c.tecla.toUpperCase() : "Asignar tecla";
        teclaBtn.addEventListener("click", function () {
          esperandoTeclaIdx = idx;
          renderConfig();
        });

        fila.appendChild(fileLabel);
        fila.appendChild(fileInput);
        fila.appendChild(textoInput);
        fila.appendChild(teclaBtn);

        elEditor.appendChild(fila);
      });
    }

    ajustarCantidad(Number(elCantidad.value) || 4);
    renderConfig();
  }

  return { init: init };
})();
