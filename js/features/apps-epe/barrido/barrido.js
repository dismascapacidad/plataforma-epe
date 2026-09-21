/**
 * barrido.js
 * App EpE — Entrenador de barrido (scanning) para acceso por pulsadores.
 * Actividad: copiar una palabra de ejemplo eligiendo letras de una grilla,
 * en cualquiera de tres modos de barrido:
 *
 *   - "tiempo": barrido automático de 1 pulsador. El sistema recorre las
 *     celdas solo, a intervalo fijo; el pulsador selecciona la celda
 *     donde el resaltado está parado en ese momento.
 *   - "manual-lineal": barrido manual de 2 pulsadores, celda por celda en
 *     un único recorrido lineal. Un pulsador avanza, el otro selecciona.
 *   - "manual-filacol": barrido manual de 2 pulsadores, por bloques: un
 *     pulsador avanza fila por fila; al llegar a la fila deseada, el
 *     otro la confirma y ahí empieza a recorrer columna por columna
 *     dentro de esa fila; un tercer toque selecciona la celda. Es el
 *     estándar en comunicadores por barrido con muchas celdas, porque
 *     escala mejor que recorrer celda por celda.
 *
 * Igual que en el resto de la plataforma, "pulsador" hoy es una tecla del
 * teclado (K = avanzar, L = activar/seleccionar; en modo "tiempo" K
 * también selecciona) — así funciona con cualquier interfaz de switch que
 * ya emule teclado (como hace el propio hardware de dis+capacidad), sin
 * necesitar Web Bluetooth/Serial para este prototipo. Cada acción también
 * tiene un botón grande en pantalla, para probar con mouse/switch-mouse.
 *
 * Script clásico. Namespace: EpeBarrido.
 */

var EpeBarrido = (function () {
  var COLUMNAS = 7;

  // Dos órdenes posibles para las mismas 29 celdas (27 letras + espacio +
  // borrar). "Abecedario" es el orden alfabético de siempre; "QWERTY"
  // sigue el orden de un teclado físico español (fila Q..P, luego A..Ñ,
  // luego Z..M) — útil para quien ya tiene memoria muscular de esa
  // distribución. La grilla sigue siendo de 7 columnas en los dos casos
  // (no reproduce las filas 10/10/7 reales del teclado): lo que cambia es
  // en qué orden se van llenando esas 7 columnas.
  var DISPOSICIONES = {
    abecedario: [
      "A", "B", "C", "D", "E", "F", "G",
      "H", "I", "J", "K", "L", "M", "N",
      "Ñ", "O", "P", "Q", "R", "S", "T",
      "U", "V", "W", "X", "Y", "Z", "ESPACIO",
      "BORRAR",
    ],
    qwerty: [
      "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P",
      "A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ",
      "Z", "X", "C", "V", "B", "N", "M", "ESPACIO",
      "BORRAR",
    ],
  };

  // Cada palabra tiene dos formas: "escritura" (lo que hay que armar
  // letra por letra en la grilla — nunca lleva tilde, porque la grilla no
  // tiene Á É Í Ó Ú) y "pronunciacion" (lo que se dice en voz alta al
  // reproducirla — con la tilde real, para que suene bien). Para la
  // mayoría son iguales; para "mamá"/"papá" no, a propósito.
  var PALABRAS_DEFAULT = [
    { escritura: "SOL", pronunciacion: "SOL" },
    { escritura: "OJO", pronunciacion: "OJO" },
    { escritura: "MAMA", pronunciacion: "MAMÁ" },
    { escritura: "PAPA", pronunciacion: "PAPÁ" },
    { escritura: "CASA", pronunciacion: "CASA" },
  ];

  // Saca tildes para pasar de "pronunciación" a "escritura" (MAMÁ -> MAMA)
  // sin tocar la Ñ — la Ñ es una letra propia del alfabeto español, no un
  // acento, y sí existe como celda en la grilla.
  function quitarTildes(textoMayusculas) {
    return textoMayusculas
      .replace(/Ñ/g, "\u0001")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\u0001/g, "Ñ");
  }

  // El input range guarda un valor "crudo" de 400 a 2000, pero eso son
  // milisegundos de INTERVALO — más alto = más lento, al revés de lo que
  // se espera de un control de "velocidad" (más a la derecha = más
  // rápido). Por eso el valor del slider nunca se usa directo como ms: se
  // invierte acá, en un solo lugar.
  var VELOCIDAD_MIN_MS = 400;
  var VELOCIDAD_MAX_MS = 2000;

  function velocidadMsDesdeSlider(valorSlider) {
    return VELOCIDAD_MIN_MS + VELOCIDAD_MAX_MS - valorSlider;
  }

  function valorCelda(etiqueta) {
    if (etiqueta === "ESPACIO") return " ";
    if (etiqueta === "BORRAR") return null; // acción especial, no letra
    return etiqueta;
  }

  function hablar(texto) {
    if (!texto || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "es-AR";
    window.speechSynthesis.speak(utterance);
  }

  function init(root) {
    if (!root) return;

    var state = {
      modo: "tiempo", // 'tiempo' | 'manual-lineal' | 'manual-filacol'
      disposicion: "abecedario", // 'abecedario' | 'qwerty'
      velocidadMs: VELOCIDAD_MIN_MS + VELOCIDAD_MAX_MS - 1500,
      indice: 0, // celda resaltada en 'tiempo' y 'manual-lineal'
      fase: "fila", // 'fila' | 'columna', solo en 'manual-filacol'
      filaActual: 0,
      filaBloqueada: null,
      colActual: 0,
      timer: null,
      palabras: PALABRAS_DEFAULT.slice(),
      palabraObjetivo: PALABRAS_DEFAULT[0], // objeto {escritura, pronunciacion}; ver elegirPalabra()
      escrito: "",
      reproduccion: "auto", // 'auto' | 'tecla'
    };
    var autoReproducido = false; // evita repetir la voz en cada render mientras la palabra ya está completa

    var filas = []; // reconstruida por construirGrilla()
    var celdaEls = []; // ídem, paralelo a la disposición activa

    // ── DOM ──────────────────────────────────────────────────────────
    var elGrilla = root.querySelector("[data-barrido-grilla]");
    var elObjetivo = root.querySelector("[data-barrido-objetivo]");
    var elTeclas = root.querySelector("[data-barrido-teclas]");
    var elEscrito = root.querySelector("[data-barrido-escrito]");
    var elEscritoEscuchar = root.querySelector("[data-barrido-escrito-escuchar]");
    var elEstado = root.querySelector("[data-barrido-estado]");
    var elDisposicion = root.querySelector("[data-barrido-disposicion]");
    var elVelocidadWrap = root.querySelector("[data-barrido-velocidad-wrap]");
    var elVelocidad = root.querySelector("[data-barrido-velocidad]");
    var elPalabraSelect = root.querySelector("[data-barrido-palabra-select]");
    var elPalabraNueva = root.querySelector("[data-barrido-palabra-nueva]");
    var elPalabraAgregar = root.querySelector("[data-barrido-palabra-agregar]");
    var elBtnReiniciar = root.querySelector("[data-barrido-reiniciar]");

    function construirGrilla(disposicion) {
      var celdas = DISPOSICIONES[disposicion];
      filas = [];
      for (var i = 0; i < celdas.length; i += COLUMNAS) {
        filas.push(celdas.slice(i, i + COLUMNAS));
      }

      celdaEls = [];
      elGrilla.innerHTML = "";
      filas.forEach(function (fila, filaIdx) {
        var filaEl = document.createElement("div");
        filaEl.className = "epe-barrido-fila";
        fila.forEach(function (etiqueta, colIdx) {
          var celdaEl = document.createElement("div");
          celdaEl.className = "epe-barrido-celda";
          if (etiqueta === "ESPACIO") celdaEl.classList.add("epe-barrido-celda-ancha");
          celdaEl.textContent = etiqueta === "ESPACIO" ? "␣" : etiqueta === "BORRAR" ? "⌫" : etiqueta;
          filaEl.appendChild(celdaEl);
          celdaEls.push({ el: celdaEl, etiqueta: etiqueta, fila: filaIdx, col: colIdx });
        });
        elGrilla.appendChild(filaEl);
      });
    }

    function cambiarDisposicion(disposicion) {
      state.disposicion = disposicion;
      construirGrilla(disposicion);
      // El recorrido vuelve al principio: los índices/fila-columna de la
      // disposición anterior no tienen por qué significar lo mismo acá.
      state.indice = 0;
      state.fase = "fila";
      state.filaActual = 0;
      state.filaBloqueada = null;
      state.colActual = 0;
      resaltar();
      reiniciarTimer();
    }

    construirGrilla(state.disposicion);

    root.querySelectorAll("[name=barrido-modo]").forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) cambiarModo(radio.value);
      });
    });

    elDisposicion.addEventListener("change", function () {
      cambiarDisposicion(elDisposicion.value);
    });

    elEscritoEscuchar.addEventListener("click", function () {
      hablar(textoAHablar());
    });

    elVelocidad.addEventListener("input", function () {
      state.velocidadMs = velocidadMsDesdeSlider(Number(elVelocidad.value));
      if (state.modo === "tiempo") reiniciarTimer();
    });

    elPalabraSelect.addEventListener("change", function () {
      elegirPalabra(elPalabraSelect.value);
    });

    elPalabraAgregar.addEventListener("click", function () {
      // El usuario puede escribir la palabra CON tilde ("canción") — eso
      // es lo que se va a decir en voz alta. Para armarla en la grilla
      // (que no tiene Á É Í Ó Ú) se guarda además la versión sin tilde.
      var pronunciacion = elPalabraNueva.value.trim().toUpperCase();
      if (!pronunciacion) return;
      var escritura = quitarTildes(pronunciacion);
      var yaExiste = state.palabras.some(function (p) {
        return p.escritura === escritura;
      });
      if (yaExiste) return;
      state.palabras.push({ escritura: escritura, pronunciacion: pronunciacion });
      renderPalabras();
      elPalabraSelect.value = escritura;
      elegirPalabra(escritura);
      elPalabraNueva.value = "";
    });

    elBtnReiniciar.addEventListener("click", function () {
      state.escrito = "";
      renderEscrito();
    });

    root.querySelectorAll("[name=barrido-reproduccion]").forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) {
          state.reproduccion = radio.value;
          renderTeclas();
        }
      });
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.repeat) return;
      var tecla = ev.key.toLowerCase();
      if (tecla === "k") {
        if (state.modo === "tiempo") activar();
        else avanzar();
      } else if (tecla === "l" && state.modo !== "tiempo") {
        activar();
      } else if (tecla === "p" && state.reproduccion === "tecla") {
        hablar(textoAHablar());
      }
    });

    // ── Render de listas y estado ──────────────────────────────────────

    // Qué decir en voz alta: si ya se completó la palabra, se dice con su
    // acentuación real (palabraObjetivo.pronunciacion); si todavía está a
    // medio escribir, se lee literal lo tecleado hasta ahora (que nunca
    // lleva tilde, porque sale letra por letra de la grilla).
    function textoAHablar() {
      if (state.escrito && state.escrito === state.palabraObjetivo.escritura) {
        return state.palabraObjetivo.pronunciacion;
      }
      return state.escrito;
    }

    function renderPalabras() {
      elPalabraSelect.innerHTML = "";
      state.palabras.forEach(function (p) {
        var opt = document.createElement("option");
        opt.value = p.escritura;
        opt.textContent = p.pronunciacion;
        elPalabraSelect.appendChild(opt);
      });
    }

    function elegirPalabra(escritura) {
      var palabra = state.palabras.filter(function (p) {
        return p.escritura === escritura;
      })[0];
      if (!palabra) return;
      state.palabraObjetivo = palabra;
      state.escrito = "";
      autoReproducido = false;
      renderObjetivo();
      renderEscrito();
    }

    // ── Teclas explícitas: qué hace cada una en el modo/opción actual ──

    function agregarFilaTecla(badge, texto) {
      var fila = document.createElement("div");
      fila.className = "epe-barrido-tecla-fila";
      var span = document.createElement("span");
      span.className = "epe-barrido-tecla-badge";
      span.textContent = badge;
      var label = document.createElement("span");
      label.textContent = texto;
      fila.appendChild(span);
      fila.appendChild(label);
      elTeclas.appendChild(fila);
    }

    function renderTeclas() {
      elTeclas.innerHTML = "";
      if (state.modo === "tiempo") {
        agregarFilaTecla("K", "Seleccionar la celda resaltada (el barrido avanza solo)");
      } else if (state.modo === "manual-lineal") {
        agregarFilaTecla("K", "Avanzar a la siguiente celda");
        agregarFilaTecla("L", "Seleccionar la celda resaltada");
      } else {
        agregarFilaTecla("K", "Avanzar (de fila, o de columna una vez elegida la fila)");
        agregarFilaTecla("L", "Confirmar la fila / seleccionar la celda");
      }
      if (state.reproduccion === "tecla") {
        agregarFilaTecla("P", "Reproducir la palabra escrita");
      }
    }

    function renderObjetivo() {
      elObjetivo.innerHTML = "";
      // Las letras que se muestran para copiar son siempre la escritura
      // sin tilde: son las que realmente existen como celda en la grilla.
      state.palabraObjetivo.escritura.split("").forEach(function (letra, idx) {
        var span = document.createElement("span");
        span.className = "epe-barrido-letra-objetivo";
        span.textContent = letra === " " ? "␣" : letra;
        if (idx < state.escrito.length) {
          span.classList.add(state.escrito[idx] === letra ? "is-correcta" : "is-incorrecta");
        }
        elObjetivo.appendChild(span);
      });
    }

    function renderEscrito() {
      elEscrito.textContent = state.escrito || "—";
      elEscritoEscuchar.disabled = !state.escrito;
      renderObjetivo();
      if (state.escrito && state.escrito === state.palabraObjetivo.escritura) {
        elEstado.textContent = "¡Listo! Copiaste la palabra completa.";
        elEstado.classList.add("is-exito");
        if (state.reproduccion === "auto" && !autoReproducido) {
          hablar(textoAHablar());
          autoReproducido = true;
        }
      } else {
        elEstado.textContent = "";
        elEstado.classList.remove("is-exito");
        autoReproducido = false;
      }
    }

    // ── Resaltado de celdas ─────────────────────────────────────────

    function limpiarResaltado() {
      celdaEls.forEach(function (c) {
        c.el.classList.remove("is-resaltada", "is-fila-activa");
      });
    }

    function resaltar() {
      limpiarResaltado();
      if (state.modo === "manual-filacol") {
        if (state.fase === "fila") {
          celdaEls
            .filter(function (c) {
              return c.fila === state.filaActual;
            })
            .forEach(function (c) {
              c.el.classList.add("is-fila-activa");
            });
        } else {
          var enFila = celdaEls.filter(function (c) {
            return c.fila === state.filaBloqueada;
          });
          enFila.forEach(function (c) {
            c.el.classList.add("is-fila-activa");
          });
          if (enFila[state.colActual]) enFila[state.colActual].el.classList.add("is-resaltada");
        }
      } else {
        if (celdaEls[state.indice]) celdaEls[state.indice].el.classList.add("is-resaltada");
      }
    }

    // ── Lógica de avance/activación ──────────────────────────────────

    function avanzarLineal() {
      state.indice = (state.indice + 1) % celdaEls.length;
      resaltar();
    }

    function avanzar() {
      if (state.modo === "manual-filacol") {
        var totalFilas = filas.length;
        if (state.fase === "fila") {
          state.filaActual = (state.filaActual + 1) % totalFilas;
        } else {
          var enFila = celdaEls.filter(function (c) {
            return c.fila === state.filaBloqueada;
          });
          state.colActual = (state.colActual + 1) % enFila.length;
        }
        resaltar();
      } else if (state.modo === "manual-lineal") {
        avanzarLineal();
      }
      // en modo 'tiempo' el avance es automático: este botón no hace nada.
    }

    function activarEnCelda(item) {
      if (!item) return;
      if (item.etiqueta === "BORRAR") {
        state.escrito = state.escrito.slice(0, -1);
      } else {
        state.escrito += valorCelda(item.etiqueta);
      }
      renderEscrito();
    }

    function activar() {
      if (state.modo === "manual-filacol") {
        if (state.fase === "fila") {
          state.filaBloqueada = state.filaActual;
          state.fase = "columna";
          state.colActual = 0;
        } else {
          var enFila = celdaEls.filter(function (c) {
            return c.fila === state.filaBloqueada;
          });
          activarEnCelda(enFila[state.colActual]);
          state.fase = "fila";
          state.filaActual = 0;
        }
        resaltar();
      } else {
        activarEnCelda(celdaEls[state.indice]);
      }
    }

    // ── Modo y timer ────────────────────────────────────────────────

    function reiniciarTimer() {
      if (state.timer) window.clearInterval(state.timer);
      state.timer = null;
      if (state.modo === "tiempo") {
        state.timer = window.setInterval(avanzarLineal, state.velocidadMs);
      }
    }

    function cambiarModo(modo) {
      state.modo = modo;
      state.indice = 0;
      state.fase = "fila";
      state.filaActual = 0;
      state.filaBloqueada = null;
      state.colActual = 0;

      elVelocidadWrap.hidden = modo !== "tiempo";
      renderTeclas();

      resaltar();
      reiniciarTimer();
    }

    // ── Estado inicial ──────────────────────────────────────────────
    renderPalabras();
    elegirPalabra(state.palabraObjetivo.escritura);
    cambiarModo(state.modo);
  }

  return { init: init };
})();
