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

  // Posición/aspecto de cada lugar en la fila (índice 0 = la fruta a
  // responder AHORA). Con solo 2 lugares visibles se definen a mano en vez
  // de interpolar con una fórmula continua: así "la que sigue" queda
  // claramente más chica, más atrás, y parcialmente tapada por la actual
  // (que se dibuja encima por ir después en la cola — ver aplicarPosiciones)
  // — el efecto de "fila que se aleja hacia el fondo" que buscamos.
  //
  // "y" está en cqh (% del alto REAL del carril, ver container-type:size en
  // lado-correcto.css) y no en px: así la separación entre las dos frutas
  // escala junto con el tamaño que le toque al carril en cada pantalla, en
  // vez de quedar fija y desbordar en viewports más bajos.
  var POSICIONES_FILA = [
    { escala: 1, y: "-6cqh", opacidad: 1 }, // la actual: al frente, grande, pegada a las flechas
    { escala: 0.5, y: "-46cqh", opacidad: 0.5 }, // la que sigue: más chica, más atrás, medio tapada
  ];
  var LARGO_FILA = POSICIONES_FILA.length; // cuántas frutas se ven a la vez en la fila

  // Entradas fijas: acá no hay panel de reasignación de teclas (a diferencia
  // de Hanói/N-back/Stroop), las flechas son fijas. Se le pasan directo al
  // widget de configuración de dispositivo.
  var ENTRADAS_DISPOSITIVO = [
    { id: "izquierda", etiqueta: "Fruta izquierda", tecla: "arrowleft" },
    { id: "derecha", etiqueta: "Fruta derecha", tecla: "arrowright" },
  ];

  var root, elConfig, elJuego, elResumen, elCarril;
  var elHudObjetivo, elHudErrores;
  var elFrutaIzq, elFrutaDer;
  var elFlechaIzq, elFlechaDer;
  var elResumenTexto, elEstadisticasBoton, elEstadisticasPanel;
  var btnConfigurarDispositivo, btnRestaurarDispositivo, enlacesVolverApps;

  var estado = null; // null = no hay partida en curso
  var restaurarDispositivo = null; // función pendiente para devolver el dispositivo a como estaba

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

  function posicionDe(idx) {
    return POSICIONES_FILA[idx] || POSICIONES_FILA[POSICIONES_FILA.length - 1];
  }

  function aplicarPosiciones() {
    // Se recorre de atrás para adelante para que, en el DOM, la fruta
    // actual (idx 0) quede después que "la que sigue" — así se pinta
    // encima sin necesitar z-index, y la tapa parcialmente sin más.
    estado.cola.forEach(function (item, idx) {
      var p = posicionDe(idx);
      item.el.style.transform = "translate(-50%, " + p.y + ") scale(" + p.escala + ")";
      item.el.style.opacity = String(p.opacidad);
      item.el.classList.toggle("is-frente", idx === 0);
    });
    // Reordenar en el DOM (en vez de con z-index) para que la actual quede
    // siempre pintada por encima de la que sigue.
    for (var i = estado.cola.length - 1; i >= 0; i--) {
      elCarril.appendChild(estado.cola[i].el);
    }
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
  }

  function flashFlecha(lado, clase) {
    var el = lado === "izquierda" ? elFlechaIzq : elFlechaDer;
    el.classList.add(clase);
    window.setTimeout(function () {
      el.classList.remove(clase);
    }, 260);
  }

  function responder(ladoElegido) {
    // estado.procesando bloquea una segunda respuesta mientras la fruta
    // actual todavía está resolviéndose (vuela/cae, 320ms) — sin esto, con
    // la flecha mantenida apretada el repeat de keydown del sistema operativo
    // dispara responder() de nuevo sobre la misma fruta y desincroniza la
    // cola del DOM (la fruta queda pisada con la que entra).
    if (!estado || estado.terminado || estado.procesando || !estado.cola.length) return;
    estado.procesando = true;

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
      estado.procesando = false;
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
      procesando: false,
      temporizador: null,
      inicioMs: performance.now(),
    };

    elCarril.className = "epe-lado-carril epe-lado-velocidad-" + config.velocidad;
    elFrutaIzq.textContent = frutas.izquierda.emoji;
    elFrutaDer.textContent = frutas.derecha.emoji;
    // Sin texto visible en el botón (solo la fruta) el nombre queda en el
    // aria-label, para que no se pierda con lectores de pantalla.
    elFlechaIzq.setAttribute("aria-label", "Fruta izquierda: " + frutas.izquierda.nombre);
    elFlechaDer.setAttribute("aria-label", "Fruta derecha: " + frutas.derecha.nombre);

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

  // ── Configurar dispositivo físico ─────────────────────────────────────
  // Acá las flechas son fijas (no hay panel de reasignación): se le pasan
  // directo al widget, sin pasar por EpeAcceso.entradasNecesarias.
  function configurarDispositivo() {
    if (!window.EpeConfigurarDispositivo) return; // widget.js no cargó
    window.EpeConfigurarDispositivo
      .abrir(ENTRADAS_DISPOSITIVO, { titulo: "Configurar dispositivo — Lado Correcto" })
      .then(function (resultado) {
        if (resultado && resultado.restaurar) restaurarDispositivo = resultado.restaurar;
        actualizarBotonRestaurar();
        // El usuario ya apretó "Empezar" dentro del propio modal: arrancamos
        // directo, sin pedirle un segundo click acá.
        if (resultado && resultado.continuar) iniciarPartida(leerConfig());
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
  // restaurar el dispositivo si quedó algo pendiente. `luegoSalir` es lo que
  // hay que hacer una vez que es seguro seguir.
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
    elFlechaIzq = root.querySelector('[data-lado-flecha="izquierda"]');
    elFlechaDer = root.querySelector('[data-lado-flecha="derecha"]');
    elResumenTexto = root.querySelector("[data-lado-resumen-texto]");
    elEstadisticasBoton = root.querySelector("[data-lado-estadisticas-boton]");
    elEstadisticasPanel = root.querySelector("[data-lado-estadisticas-panel]");
    btnConfigurarDispositivo = root.querySelector("[data-configurar-dispositivo]");
    btnRestaurarDispositivo = root.querySelector("[data-restaurar-dispositivo]");
    enlacesVolverApps = Array.prototype.slice.call(root.querySelectorAll("[data-volver-apps]"));

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
