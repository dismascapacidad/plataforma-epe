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
 * Cada casillero es a la vez su propia zona de edición y de juego: el
 * área grande de la imagen ES el botón que se activa (con mouse, switch-
 * mouse, touch o la tecla asignada); los controles chicos alrededor
 * (imagen / texto / tecla) son para configurarlo.
 *
 * Script clásico. Namespace: EpeVincularImagen.
 */

var EpeVincularImagen = (function () {
  var MAX_CASILLEROS = 8;
  var MIN_CASILLEROS = 1;

  function init(root) {
    var casillas = []; // { imagen: dataURL|null, texto: string, tecla: string|null }
    var esperandoTeclaIdx = null;

    var elCantidad = root.querySelector("[data-vi-cantidad]");
    var elGrilla = root.querySelector("[data-vi-grilla]");

    elCantidad.addEventListener("change", function () {
      ajustarCantidad(Number(elCantidad.value));
      render();
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.repeat) return;
      var tecla = ev.key.toLowerCase();

      if (esperandoTeclaIdx !== null) {
        if (tecla !== "escape") asignarTecla(esperandoTeclaIdx, tecla);
        esperandoTeclaIdx = null;
        render();
        return;
      }

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

    window.addEventListener("resize", actualizarLayout);

    function render() {
      elGrilla.innerHTML = "";
      actualizarLayout();

      casillas.forEach(function (c, idx) {
        var card = document.createElement("div");
        card.className = "epe-vi-card";

        // ── Zona de juego: la imagen misma es el botón ──
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

        // ── Controles de edición ──
        var controles = document.createElement("div");
        controles.className = "epe-vi-controles";

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
            render();
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
          playArea.setAttribute("aria-label", textoInput.value || "Casillero " + (idx + 1));
        });

        var teclaBtn = document.createElement("button");
        teclaBtn.type = "button";
        teclaBtn.className = "epe-btn-ghost epe-btn-sm epe-vi-tecla-btn";
        teclaBtn.textContent =
          esperandoTeclaIdx === idx ? "Presioná una tecla…" : c.tecla ? "Tecla: " + c.tecla.toUpperCase() : "Asignar tecla";
        teclaBtn.addEventListener("click", function () {
          esperandoTeclaIdx = idx;
          render();
        });

        controles.appendChild(fileLabel);
        controles.appendChild(fileInput);
        controles.appendChild(textoInput);
        controles.appendChild(teclaBtn);
        card.appendChild(controles);

        elGrilla.appendChild(card);
      });
    }

    ajustarCantidad(Number(elCantidad.value) || 4);
    render();
  }

  return { init: init };
})();
