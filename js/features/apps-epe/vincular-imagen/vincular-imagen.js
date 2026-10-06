/**
 * vincular-imagen.js
 * App EpE — Vincular imagen-botón: vincula una imagen, un texto a voz y una
 * tecla a cada botón. De 1 a 8 casilleros configurables; cada uno tiene: una
 * imagen (subida por archivo desde la PC o, cuando esté habilitado, un
 * pictograma de ARASAAC — ver arasaac.js; en ambos casos queda guardada en el
 * navegador, así funciona sin conexión y sin depender de que la imagen esté
 * alojada en otro lado), un texto que se lee en voz alta al
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
    var casillas = []; // { imagen: dataURL|null, fuente: "arasaac"|null, texto: string, tecla: string|null }
    var arasaac = null; // módulo arasaac.js, una vez cargado
    var origenAbiertoIdx = null; // casillero cuyo "Agregar imagen" está mostrando las dos opciones
    var enfocarOrigen = false;
    var esperandoTeclaIdx = null;
    var iniciado = false; // true después del primer "Empezar"

    var elConfig = root.querySelector("[data-vi-config]");
    var elCantidad = root.querySelector("[data-vi-cantidad]");
    var elEditor = root.querySelector("[data-vi-editor]");
    var elEmpezar = root.querySelector("[data-vi-empezar]");
    var elAtribArasaac = root.querySelector("[data-vi-atrib-arasaac]");
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
        casillas.push({ imagen: null, fuente: null, texto: "", tecla: null });
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
        .abrir(entradasDispositivo(), { titulo: "Configurar dispositivo — Vincular imagen-botón" })
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
            casillas[idx].fuente = null;
            origenAbiertoIdx = null;
            renderConfig();
          };
          reader.readAsDataURL(file);
        });

        // "Agregar imagen": un solo botón. Con ARASAAC apagado abre directo el
        // selector de archivos; con ARASAAC habilitado primero pregunta el origen.
        var agregar;
        if (arasaacActivo() && origenAbiertoIdx === idx) {
          agregar = document.createElement("div");
          agregar.className = "epe-vi-origen";
          agregar.setAttribute("role", "group");
          agregar.setAttribute("aria-label", "Origen de la imagen");

          var desdePc = document.createElement("label");
          desdePc.className = "epe-btn-ghost epe-btn-sm";
          desdePc.setAttribute("for", fileId);
          desdePc.textContent = "Desde mi PC";

          var desdeAra = document.createElement("button");
          desdeAra.type = "button";
          desdeAra.className = "epe-btn-ghost epe-btn-sm";
          desdeAra.textContent = "Desde ARASAAC";
          desdeAra.addEventListener("click", function () {
            origenAbiertoIdx = null;
            renderConfig();
            abrirPanelArasaac(idx);
          });

          var cancelar = document.createElement("button");
          cancelar.type = "button";
          cancelar.className = "epe-btn-ghost epe-btn-sm";
          cancelar.setAttribute("aria-label", "Cancelar");
          cancelar.textContent = "✕";
          cancelar.addEventListener("click", function () {
            origenAbiertoIdx = null;
            renderConfig();
          });

          agregar.appendChild(desdePc);
          agregar.appendChild(desdeAra);
          agregar.appendChild(cancelar);
          if (enfocarOrigen) {
            enfocarOrigen = false;
            window.setTimeout(function () {
              desdeAra.focus();
            }, 0);
          }
        } else if (arasaacActivo()) {
          agregar = document.createElement("button");
          agregar.type = "button";
          agregar.className = "epe-btn-ghost epe-btn-sm";
          agregar.textContent = "Agregar imagen";
          agregar.addEventListener("click", function () {
            origenAbiertoIdx = idx;
            enfocarOrigen = true;
            renderConfig();
          });
        } else {
          agregar = document.createElement("label");
          agregar.className = "epe-btn-ghost epe-btn-sm";
          agregar.setAttribute("for", fileId);
          agregar.textContent = "Agregar imagen";
        }

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

        fila.appendChild(agregar);
        fila.appendChild(fileInput);
        fila.appendChild(textoInput);
        fila.appendChild(teclaBtn);

        elEditor.appendChild(fila);
      });

      // Atribución obligatoria de ARASAAC: siempre visible en la configuración
      // mientras la opción esté habilitada (condición de su autorización).
      if (elAtribArasaac) elAtribArasaac.hidden = !arasaacActivo();
    }

    // ── ARASAAC (interruptor ARASAAC_HABILITADO en arasaac.js) ───────────────
    function arasaacActivo() {
      return !!(arasaac && arasaac.ARASAAC_HABILITADO);
    }

    function abrirPanelArasaac(idx) {
      if (!arasaacActivo() || !window.EpeModal) return;
      var A = arasaac;
      var todos = [];
      var pagina = 0;
      var pedido = 0; // descarta respuestas viejas si se busca de nuevo

      var cont = document.createElement("div");
      cont.className = "epe-vi-ara";

      var form = document.createElement("form");
      form.className = "epe-vi-ara-form";
      var input = document.createElement("input");
      input.type = "search";
      input.className = "epe-vi-texto-input";
      input.maxLength = A.LARGO_MAX_BUSQUEDA;
      input.placeholder = "Ej.: casa, agua, mamá";
      input.autocomplete = "off";
      input.setAttribute("aria-label", "Buscar pictograma");
      var btnBuscar = document.createElement("button");
      btnBuscar.type = "submit";
      btnBuscar.className = "epe-btn-acc epe-btn-sm";
      btnBuscar.textContent = "Buscar";
      form.appendChild(input);
      form.appendChild(btnBuscar);

      var aviso = document.createElement("p");
      aviso.className = "epe-vi-ara-aviso";
      aviso.textContent =
        "Lo que escribas se envía a ARASAAC (un servicio externo). Escribí solo la palabra del " +
        "pictograma, sin nombres de personas ni datos de pacientes.";

      var estado = document.createElement("p");
      estado.className = "epe-vi-ara-estado";
      estado.setAttribute("role", "status");
      estado.setAttribute("aria-live", "polite");

      var grilla = document.createElement("div");
      grilla.className = "epe-vi-ara-grilla";

      var nav = document.createElement("div");
      nav.className = "epe-vi-ara-nav";
      nav.hidden = true;
      var btnAnt = document.createElement("button");
      btnAnt.type = "button";
      btnAnt.className = "epe-btn-ghost epe-btn-sm";
      btnAnt.textContent = "← Anteriores";
      var btnSig = document.createElement("button");
      btnSig.type = "button";
      btnSig.className = "epe-btn-ghost epe-btn-sm";
      btnSig.textContent = "Más resultados →";
      nav.appendChild(btnAnt);
      nav.appendChild(btnSig);

      var atrib = document.createElement("p");
      atrib.className = "epe-vi-ara-atrib";
      atrib.textContent = A.ATRIBUCION_CORTA;

      cont.appendChild(form);
      cont.appendChild(aviso);
      cont.appendChild(estado);
      cont.appendChild(grilla);
      cont.appendChild(nav);
      cont.appendChild(atrib);

      function mostrarPagina() {
        grilla.innerHTML = "";
        var desde = pagina * A.RESULTADOS_POR_PAGINA;
        todos.slice(desde, desde + A.RESULTADOS_POR_PAGINA).forEach(function (r) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "epe-vi-ara-item";
          b.setAttribute("aria-label", "Usar pictograma: " + (r.palabra || "sin nombre"));
          var img = document.createElement("img");
          img.src = r.url;
          img.alt = "";
          img.loading = "lazy";
          img.decoding = "async";
          img.referrerPolicy = "no-referrer";
          var nombre = document.createElement("span");
          nombre.textContent = r.palabra;
          b.appendChild(img);
          b.appendChild(nombre);
          b.addEventListener("click", function () {
            elegir(r);
          });
          grilla.appendChild(b);
        });
        var paginas = Math.ceil(todos.length / A.RESULTADOS_POR_PAGINA);
        nav.hidden = paginas <= 1;
        btnAnt.disabled = pagina === 0;
        btnSig.disabled = pagina >= paginas - 1;
        estado.textContent =
          todos.length + (todos.length === 1 ? " resultado" : " resultados") + ". Elegí uno.";
      }

      btnAnt.addEventListener("click", function () {
        if (pagina > 0) {
          pagina--;
          mostrarPagina();
        }
      });
      btnSig.addEventListener("click", function () {
        pagina++;
        mostrarPagina();
      });

      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var termino = A.normalizarTermino(input.value);
        if (!termino) {
          estado.textContent = "Escribí una palabra para buscar.";
          return;
        }
        var mio = ++pedido;
        estado.textContent = "Buscando…";
        grilla.innerHTML = "";
        nav.hidden = true;
        A.buscar(termino)
          .then(function (lista) {
            if (mio !== pedido) return;
            todos = lista;
            pagina = 0;
            if (!lista.length) {
              estado.textContent = "No encontramos pictogramas para “" + termino + "”. Probá con otra palabra.";
              return;
            }
            mostrarPagina();
          })
          .catch(function () {
            if (mio !== pedido) return;
            estado.textContent =
              "No se pudo buscar (¿hay conexión?). Podés agregar una imagen desde tu PC.";
          });
      });

      function elegir(r) {
        pedido++; // cancela cualquier búsqueda pendiente
        grilla.querySelectorAll("button").forEach(function (b) {
          b.disabled = true;
        });
        estado.textContent = "Descargando pictograma…";
        A.descargarImagen(r.id)
          .catch(function () {
            // Plan B: si el navegador no deja descargarla, se usa el enlace directo.
            return r.url;
          })
          .then(function (imagen) {
            casillas[idx].imagen = imagen;
            casillas[idx].fuente = "arasaac";
            if (!casillas[idx].texto.trim() && r.palabra) casillas[idx].texto = r.palabra;
            window.EpeModal.close();
            renderConfig();
          });
      }

      window.EpeModal.open({ titulo: "Pictogramas de ARASAAC", contenido: cont });
      window.setTimeout(function () {
        input.focus();
      }, 0);
    }

    ajustarCantidad(Number(elCantidad.value) || 4);
    renderConfig();

    // El módulo de ARASAAC es un módulo ES aparte. Si no carga, la opción
    // simplemente no aparece y todo lo demás funciona igual.
    import("./arasaac.js")
      .then(function (m) {
        arasaac = m;
        if (elAtribArasaac) elAtribArasaac.textContent = m.ATRIBUCION_CORTA;
        if (m.ARASAAC_HABILITADO) renderConfig();
      })
      .catch(function () {
        arasaac = null;
      });
  }

  return { init: init };
})();
