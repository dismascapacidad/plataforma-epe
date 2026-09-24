/**
 * lado-correcto.js
 * App EpE — "Lado Correcto": ejercicio de neuroestimulación de reacción y
 * lateralidad. Una fila de frutas avanza en perspectiva desde el fondo
 * hacia el jugador, de a una por vez; cada flecha (← →) tiene asignada una
 * fruta, y hay que presionar la que corresponde a la PRIMERA fruta de la
 * fila (la más cercana) antes de que aparezca la siguiente.
 *
 * Reglas (confirmadas con el usuario antes de implementar):
 * - Solo 2 frutas están en juego por partida, elegidas al azar de un banco
 *   más grande — una asignada a cada flecha. Nunca aparece una tercera.
 * - El juego NO avanza solo: espera la respuesta del jugador para esa
 *   fruta (sin límite de tiempo por fruta). "Por tiempo" limita la
 *   partida entera (cuenta regresiva independiente), no cada fruta.
 * - Acierto: la fruta "vuela" hacia el lado correcto y se suma al
 *   contador de ese lado. Error: la fruta cae y no se cuenta — de
 *   cualquier manera, se resuelve y sigue la próxima.
 *
 * Sin archivos de audio ni imágenes — las frutas son emoji, mismo
 * criterio que Piano (sin assets pesados, todo autocontenido).
 *
 * Se puede jugar con las flechas del teclado o tocando/clickeando los
 * botones en pantalla (igual que Piano/Barrido: el teclado nunca es el
 * único camino, para que funcione también con switch-mouse o puntero).
 *
 * Script clásico (ver theme.js). Namespace: EpeLadoCorrecto.
 */

var EpeLadoCorrecto = (function () {
  var FRUTAS_BANCO = [
    { emoji: "🍎", nombre: "Manzana" },
    { emoji: "🍌", nombre: "Banana" },
    { emoji: "🍇", nombre: "Uva" },
    { emoji: "🍊", nombre: "Naranja" },
    { emoji: "🍓", nombre: "Frutilla" },
    { emoji: "🍉", nombre: "Sandía" },
    { emoji: "🍍", nombre: "Ananá" },
    { emoji: "🥝", nombre: "Kiwi" },
  ];

  var LARGO_FILA = 4; // cuántas frutas se ven a la vez en la fila (índice 0 = la más cerca)

  var root, elConfig, elJuego, elResumen, elCarril;
  var elHudObjetivo, elHudErrores;
  var elFrutaIzq, elFrutaDer, elContadorIzq, elContadorDer;
  var elFlechaIzq, elFlechaDer;
  var elResumenTexto, elEstadisticasBoton, elEstadisticasPanel;

  var estado = null; // null = no hay partida en curso

  function elegirDosFrutas() {
    var banco = FRUTAS_BANCO.slice();
    // Fisher-Yates parcial: solo necesitamos las primeras 2 posiciones mezcladas.
    for (var i = 0; i < 2; i++) {
      var j = i + Math.floor(Math.random() * (banco.length - i));
      var tmp = banco[i];
      banco[i] = banco[j];
      banco[j] = tmp;
    }
    return { izquierda: banco[0], derecha: banco[1] };
  }

  function frutaAleatoriaDeLado(lado) {
    return { fruta: estado.frutas[lado], lado: lado };
  }

  function crearItemFila() {
    var lado = Math.random() < 0.5 ? "izquierda" : "derecha";
    var item = frutaAleatoriaDeLado(lado);
    var el = document.createElement("div");
    el.className = "epe-lado-item";
    el.textContent = item.fruta.emoji;
    el.setAttribute("aria-hidden", "true");
    item.el = el;
    return item;
  }

  // ── Fila / carril ────────────────────────────────────────────────────
  // Cada ítem se posiciona por transform según su índice en la cola
  // (0 = más cerca, LARGO_FILA-1 = más lejos/arriba/chico). Al reordenar
  // la cola alcanza con volver a aplicar los transforms: la transición
  // CSS anima el "avance" solita.

  function posicionParaIndice(idx) {
    var paso = 1 - idx / LARGO_FILA; // 1 = más cerca, ~0.25 = más lejos
    var escala = 0.4 + paso * 0.6;
    var y = -(LARGO_FILA - 1 - idx) * 60;
    var opacidad = 0.3 + paso * 0.7;
    return "translate(-50%, " + y + "px) scale(" + escala + ")";
  }

  function aplicarPosiciones() {
    estado.cola.forEach(function (item, idx) {
      item.el.style.transform = posicionParaIndice(idx);
      item.el.style.opacity = 0.3 + (1 - idx / LARGO_FILA) * 0.7;
      item.el.style.zIndex = String(LARGO_FILA - idx);
      item.el.classList.toggle("is-frente", idx === 0);
    });
  }

  function llenarFilaInicial() {
    elCarril.innerHTML = "";
    estado.cola = [];
    for (var i = 0; i < LARGO_FILA; i++) {
      var item = crearItemFila();
      item.el.classList.add("sin-transicion");
      elCarril.appendChild(item.el);
      estado.cola.push(item);
    }
    aplicarPosiciones();
    // Un frame después sacamos "sin-transicion" para que desde acá en más
    // los cambios de posición sí animen.
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        estado.cola.forEach(function (item) {
          item.el.classList.remove("sin-transicion");
        });
      });
    });
  }

  function actualizarHud() {
    if (estado.modo === "cantidad") {
      elHudObjetivo.textContent = "Aciertos: " + estado.aciertos + " / " + estado.objetivoCantidad;
    } else {
      elHudObjetivo.textContent = "Tiempo: " + estado.tiempoRestante + "s — Aciertos: " + estado.aciertos;
    }
    elHudErrores.textContent = "Errores: " + estado.errores;
    elContadorIzq.textContent = String(estado.aciertosPorLado.izquierda);
    elContadorDer.textContent = String(estado.aciertosPorLado.derecha);
  }

  function flashFlecha(lado, clase) {
    var el = lado === "izquierda" ? elFlechaIzq : elFlechaDer;
    el.classList.add(clase);
    window.setTimeout(function () {
      el.classList.remove(clase);
    }, 260);
  }

  function responder(ladoElegido) {
    if (!estado || estado.terminado || !estado.cola.length) return;

    var frente = estado.cola[0];
    var esCorrecto = frente.lado === ladoElegido;

    if (esCorrecto) {
      estado.aciertos++;
      estado.aciertosPorLado[ladoElegido]++;
      frente.el.classList.add(ladoElegido === "izquierda" ? "vuela-izq" : "vuela-der");
      flashFlecha(ladoElegido, "es-correcto");
    } else {
      estado.errores++;
      frente.el.classList.add("cae");
      flashFlecha(ladoElegido, "es-incorrecto");
    }

    actualizarHud();

    // Chequeo de fin de partida por cantidad, apenas se resuelve el acierto
    // que la completa — no hace falta esperar la animación para esto.
    if (estado.modo === "cantidad" && estado.aciertos >= estado.objetivoCantidad) {
      terminarPartida();
      return;
    }

    window.setTimeout(function () {
      if (!estado || estado.terminado) return;
      estado.cola.shift();
      elCarril.removeChild(frente.el);
      var nuevo = crearItemFila();
      elCarril.appendChild(nuevo.el);
      estado.cola.push(nuevo);
      aplicarPosiciones();
    }, 320);
  }

  function onKeydown(ev) {
    if (!estado || estado.terminado) return;
    if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      responder("izquierda");
    } else if (ev.key === "ArrowRight") {
      ev.preventDefault();
      responder("derecha");
    }
  }

  // ── Ciclo de partida ────────────────────────────────────────────────

  function formatearDuracion(ms) {
    var segundos = Math.round(ms / 1000);
    if (segundos < 60) return segundos + "s";
    var minutos = Math.floor(segundos / 60);
    var resto = segundos % 60;
    return minutos + "m " + resto + "s";
  }

  function calcularEstadisticas() {
    var duracionMs = performance.now() - estado.inicioMs;
    var total = estado.aciertos + estado.errores;
    var precision = total > 0 ? Math.round((estado.aciertos / total) * 100) : 0;

    return {
      tiempoTexto: formatearDuracion(duracionMs),
      precisionTexto: precision + "% (" + estado.aciertos + " de " + total + " respuestas)",
      ladosTexto: estado.aciertosPorLado.izquierda + " a la izquierda, " + estado.aciertosPorLado.derecha + " a la derecha",
      erroresTexto: String(estado.errores),
    };
  }

  function alternarEstadisticas() {
    if (!elEstadisticasPanel.hidden) {
      elEstadisticasPanel.hidden = true;
      elEstadisticasBoton.textContent = "Ver estadísticas";
      return;
    }
    var stats = calcularEstadisticas();
    elEstadisticasPanel.innerHTML = "";
    [
      ["Tiempo de juego", stats.tiempoTexto],
      ["Precisión", stats.precisionTexto],
      ["Aciertos por lado", stats.ladosTexto],
      ["Errores", stats.erroresTexto],
    ].forEach(function (par) {
      var fila = document.createElement("div");
      fila.className = "epe-lado-stat";
      var etiqueta = document.createElement("span");
      etiqueta.className = "epe-lado-stat-etiqueta";
      etiqueta.textContent = par[0];
      var valor = document.createElement("span");
      valor.className = "epe-lado-stat-valor";
      valor.textContent = par[1];
      fila.appendChild(etiqueta);
      fila.appendChild(valor);
      elEstadisticasPanel.appendChild(fila);
    });
    elEstadisticasPanel.hidden = false;
    elEstadisticasBoton.textContent = "Ocultar estadísticas";
  }

  function terminarPartida() {
    if (!estado || estado.terminado) return;
    estado.terminado = true;
    if (estado.temporizador) window.clearInterval(estado.temporizador);

    var total = estado.aciertos + estado.errores;
    var precision = total > 0 ? Math.round((estado.aciertos / total) * 100) : 0;

    elResumenTexto.textContent = "Aciertos: " + estado.aciertos + " · Errores: " + estado.errores + " · Precisión: " + precision + "%";
    elEstadisticasPanel.hidden = true;
    elEstadisticasPanel.innerHTML = "";
    elEstadisticasBoton.textContent = "Ver estadísticas";

    elJuego.hidden = true;
    elResumen.hidden = false;
  }

  function iniciarPartida(config) {
    var frutas = elegirDosFrutas();

    estado = {
      frutas: frutas,
      cola: [],
      modo: config.modo,
      objetivoCantidad: config.objetivoCantidad,
      tiempoRestante: config.tiempoTotal,
      aciertos: 0,
      errores: 0,
      aciertosPorLado: { izquierda: 0, derecha: 0 },
      terminado: false,
      temporizador: null,
      inicioMs: performance.now(),
    };

    elCarril.className = "epe-lado-carril epe-lado-velocidad-" + config.velocidad;
    elFrutaIzq.textContent = frutas.izquierda.emoji + " " + frutas.izquierda.nombre;
    elFrutaDer.textContent = frutas.derecha.emoji + " " + frutas.derecha.nombre;
    elContadorIzq.textContent = "0";
    elContadorDer.textContent = "0";

    llenarFilaInicial();
    actualizarHud();

    if (estado.modo === "tiempo") {
      estado.temporizador = window.setInterval(function () {
        estado.tiempoRestante--;
        actualizarHud();
        if (estado.tiempoRestante <= 0) terminarPartida();
      }, 1000);
    }

    elConfig.hidden = true;
    elResumen.hidden = true;
    elJuego.hidden = false;
  }

  function leerConfig() {
    var modo = root.querySelector('input[name="lado-modo"]:checked').value;
    return {
      modo: modo,
      objetivoCantidad: parseInt(root.querySelector("[data-lado-cantidad]").value, 10),
      tiempoTotal: parseInt(root.querySelector("[data-lado-tiempo]").value, 10),
      velocidad: root.querySelector("[data-lado-velocidad]").value,
    };
  }

  function init(rootEl) {
    root = rootEl;
    if (!root) return;

    elConfig = root.querySelector("[data-lado-config]");
    elJuego = root.querySelector("[data-lado-juego]");
    elResumen = root.querySelector("[data-lado-resumen]");
    elCarril = root.querySelector("[data-lado-carril]");
    elHudObjetivo = root.querySelector("[data-lado-hud-objetivo]");
    elHudErrores = root.querySelector("[data-lado-hud-errores]");
    elFrutaIzq = root.querySelector("[data-lado-fruta-izq]");
    elFrutaDer = root.querySelector("[data-lado-fruta-der]");
    elContadorIzq = root.querySelector("[data-lado-contador-izq]");
    elContadorDer = root.querySelector("[data-lado-contador-der]");
    elFlechaIzq = root.querySelector('[data-lado-flecha="izquierda"]');
    elFlechaDer = root.querySelector('[data-lado-flecha="derecha"]');
    elResumenTexto = root.querySelector("[data-lado-resumen-texto]");
    elEstadisticasBoton = root.querySelector("[data-lado-estadisticas-boton]");
    elEstadisticasPanel = root.querySelector("[data-lado-estadisticas-panel]");

    var cantidadWrap = root.querySelector("[data-lado-cantidad-wrap]");
    var tiempoWrap = root.querySelector("[data-lado-tiempo-wrap]");
    root.querySelectorAll('input[name="lado-modo"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        cantidadWrap.hidden = radio.value !== "cantidad";
        tiempoWrap.hidden = radio.value !== "tiempo";
      });
    });

    root.querySelector("[data-lado-empezar]").addEventListener("click", function () {
      iniciarPartida(leerConfig());
    });
    root.querySelector("[data-lado-jugar-de-nuevo]").addEventListener("click", function () {
      elConfig.hidden = false;
      elResumen.hidden = true;
    });
    elEstadisticasBoton.addEventListener("click", alternarEstadisticas);

    elFlechaIzq.addEventListener("pointerdown", function () {
      responder("izquierda");
    });
    elFlechaDer.addEventListener("pointerdown", function () {
      responder("derecha");
    });

    document.addEventListener("keydown", onKeydown);
  }

  return { init: init };
})();
