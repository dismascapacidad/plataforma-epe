/**
 * nback.js
 * App EpE — N-back. Ejercicio de memoria de trabajo y atención: aparece
 * una serie de estímulos, uno cada tanto, y hay que indicar cuándo el
 * estímulo actual coincide con el de hace N pasos.
 *
 * Modos:
 * - Visual: un cuadrado se enciende en una de 8 posiciones alrededor del
 *   centro. Una respuesta: "misma posición".
 * - Verbal: aparece (y opcionalmente se lee en voz alta) una letra en el
 *   centro. Una respuesta: "misma letra".
 * - Dual: las dos cosas a la vez, con las dos respuestas.
 *
 * Por qué este juego NO tiene barrido: las respuestas son 1 o 2 y el ritmo
 * lo marca el estímulo, no el jugador — no hay nada que buscar en pantalla.
 * Se juega con una tecla (o pulsador) por respuesta, reasignables. Para
 * quien necesita más tiempo, el ritmo llega a 4 s por estímulo.
 *
 * Reglas que conviene tener presentes al leer el código:
 * - Cada estímulo se muestra un rato y se apaga, pero la ventana de
 *   respuesta dura hasta que aparece el siguiente.
 * - Una coincidencia se genera a propósito ~30 % de las veces (no se deja
 *   al azar puro, o habría muy pocas). Los primeros N estímulos no pueden
 *   ser coincidencia porque todavía no hay "hace N pasos".
 * - Aciertos, omisiones (había coincidencia y no se respondió), falsas
 *   alarmas (se respondió sin haber coincidencia) y rechazos correctos se
 *   cuentan por separado para cada tipo de estímulo. "Precisión" es la
 *   proporción de estímulos bien resueltos (respondió cuando había
 *   coincidencia o no respondió cuando no la había).
 * - La retroalimentación inmediata (verde/rojo al responder) es opcional;
 *   las omisiones nunca se marcan durante el juego, solo en el resumen.
 *
 * Script clásico. Namespace: EpeNback. Depende de teclas.js, entrada.js y
 * acceso.js (js/features/apps-epe/_comun/).
 */

var EpeNback = (function () {
  var ACCIONES = [
    { id: "pos", etiqueta: "Misma posición", tecla: "f" },
    { id: "let", etiqueta: "Misma letra", tecla: "j" },
  ];

  // 8 posiciones alrededor del centro de una grilla 3×3 (el 4 es el centro).
  var POSICIONES = [0, 1, 2, 3, 5, 6, 7, 8];

  // Consonantes: evitan armar palabras y se distinguen bien de oído. "voz"
  // es cómo se dice cada una en voz alta (una "C" suelta la lee mal el
  // sintetizador).
  var LETRAS = [
    { l: "C", voz: "ce" },
    { l: "H", voz: "hache" },
    { l: "K", voz: "ka" },
    { l: "L", voz: "ele" },
    { l: "Q", voz: "cu" },
    { l: "R", voz: "erre" },
    { l: "S", voz: "ese" },
    { l: "T", voz: "te" },
  ];

  var TASA_COINCIDENCIA = 0.3;
  var PREPARACION_MS = 2000;
  var CLAVE_CONFIG = "epe-nback-config";

  var NOMBRE_CANAL = { pos: "Posición", let: "Letra" };

  // Secuencia de índices [0..cantidad-1] donde cada valor, desde el paso N,
  // repite el de hace N pasos con probabilidad TASA_COINCIDENCIA y, si no,
  // es distinto de ese (para que "no coincide" sea de verdad no coincidir).
  function generarSecuencia(total, n, cantidad) {
    var s = [];
    for (var i = 0; i < total; i++) {
      if (i >= n && Math.random() < TASA_COINCIDENCIA) {
        s.push(s[i - n]);
      } else {
        var v;
        do {
          v = Math.floor(Math.random() * cantidad);
        } while (i >= n && v === s[i - n]);
        s.push(v);
      }
    }
    return s;
  }

  function hablar(texto) {
    if (!texto || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "es-AR";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function init(root) {
    if (!root) return;

    // ── DOM ──────────────────────────────────────────────────────────
    var elConfig = root.querySelector("[data-juego-config]");
    var elEmpezar = root.querySelector("[data-juego-empezar]");
    var selN = root.querySelector("[data-nback-n]");
    var selModo = root.querySelector("[data-nback-modo]");
    var selRitmo = root.querySelector("[data-nback-ritmo]");
    var selCantidad = root.querySelector("[data-nback-cantidad]");
    var chkVoz = root.querySelector("[data-nback-voz]");
    var chkFeedback = root.querySelector("[data-nback-feedback]");
    var elJuego = root.querySelector("[data-nback-juego]");
    var elActual = root.querySelector("[data-nback-actual]");
    var elTotal = root.querySelector("[data-nback-total]");
    var elEtiqueta = root.querySelector("[data-nback-etiqueta]");
    var elConsigna = root.querySelector("[data-nback-consigna]");
    var elGrilla = root.querySelector("[data-nback-grilla]");
    var btnSalir = root.querySelector("[data-nback-salir]");
    var elResumen = root.querySelector("[data-juego-resumen]");
    var elStats = root.querySelector("[data-juego-stats]");
    var btnDeNuevo = root.querySelector("[data-juego-de-nuevo]");
    var btnConfigurar = root.querySelector("[data-juego-configurar]");
    var botones = {
      pos: root.querySelector('[data-resp="pos"]'),
      let: root.querySelector('[data-resp="let"]'),
    };
    var chips = {
      pos: root.querySelector('[data-tecla-resp="pos"]'),
      let: root.querySelector('[data-tecla-resp="let"]'),
    };

    var panel = EpeAcceso.crearPanel(root.querySelector("[data-acceso-panel]"), {
      id: "nback",
      acciones: ACCIONES,
      permitirBarrido: false,
    });

    // ── Estado ───────────────────────────────────────────────────────
    var cfg = null;
    var entrada = null;
    var celdas = []; // por índice de grilla (0..8)
    var elCentro = null;

    var n = 2;
    var modo = "visual";
    var soaMs = 2500;
    var total = 30;
    var usarVoz = true;
    var usarFeedback = true;
    var canales = ["pos"];

    var secPos = [];
    var secLet = [];
    var indice = -1; // -1 = fase de preparación
    var respondio = { pos: false, let: false };
    var conteo = null;
    var timers = [];
    var corriendo = false;

    // ── Configuración guardada (solo los selectores del ejercicio) ────
    function cargarConfig() {
      var g = EpeTeclas.leerJSON(CLAVE_CONFIG);
      if (!g || typeof g !== "object") return;
      if (["1", "2", "3"].indexOf(g.n) !== -1) selN.value = g.n;
      if (["visual", "verbal", "dual"].indexOf(g.modo) !== -1) selModo.value = g.modo;
      if (["4000", "3000", "2500", "2000"].indexOf(g.ritmo) !== -1) selRitmo.value = g.ritmo;
      if (["20", "30", "40"].indexOf(g.cantidad) !== -1) selCantidad.value = g.cantidad;
      if (typeof g.voz === "boolean") chkVoz.checked = g.voz;
      if (typeof g.feedback === "boolean") chkFeedback.checked = g.feedback;
    }

    function guardarConfig() {
      EpeTeclas.guardarJSON(CLAVE_CONFIG, {
        n: selN.value,
        modo: selModo.value,
        ritmo: selRitmo.value,
        cantidad: selCantidad.value,
        voz: chkVoz.checked,
        feedback: chkFeedback.checked,
      });
    }

    // ── Grilla ───────────────────────────────────────────────────────
    function construirGrilla() {
      elGrilla.innerHTML = "";
      celdas = [];
      for (var i = 0; i < 9; i++) {
        var c = document.createElement("div");
        if (i === 4) {
          c.className = "epe-nback-celda epe-nback-centro";
          c.textContent = "+";
          elCentro = c;
        } else {
          c.className = "epe-nback-celda";
        }
        elGrilla.appendChild(c);
        celdas.push(c);
      }
    }

    function centroEnFijacion() {
      elCentro.textContent = "+";
      elCentro.classList.remove("es-letra");
    }

    function apagarEstimulo() {
      celdas.forEach(function (c) {
        c.classList.remove("is-activa");
      });
      centroEnFijacion();
    }

    // ── Timers ───────────────────────────────────────────────────────
    function programar(fn, ms) {
      timers.push(window.setTimeout(fn, ms));
    }

    function limpiarTimers() {
      timers.forEach(function (t) {
        window.clearTimeout(t);
      });
      timers = [];
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }

    // ── Reglas ───────────────────────────────────────────────────────
    function esCoincidencia(canal, i) {
      var sec = canal === "pos" ? secPos : secLet;
      return i >= n && sec[i] === sec[i - n];
    }

    function limpiarBotones() {
      Object.keys(botones).forEach(function (c) {
        botones[c].classList.remove("is-pulsado", "is-acierto", "is-error");
      });
    }

    function cerrarEnsayo() {
      if (indice < 0) return;
      canales.forEach(function (canal) {
        var coincide = esCoincidencia(canal, indice);
        var resp = respondio[canal];
        var k = conteo[canal];
        if (coincide) {
          k.coincidencias++;
          if (resp) k.aciertos++;
        } else if (resp) {
          k.falsasAlarmas++;
        } else {
          k.rechazos++;
        }
      });
    }

    function presentar() {
      limpiarBotones();
      respondio = { pos: false, let: false };
      elActual.textContent = String(indice + 1);

      var expoMs = Math.min(1000, Math.round(soaMs * 0.45));

      if (canales.indexOf("pos") !== -1) {
        celdas[POSICIONES[secPos[indice]]].classList.add("is-activa");
      }
      if (canales.indexOf("let") !== -1) {
        var letra = LETRAS[secLet[indice]];
        elCentro.textContent = letra.l;
        elCentro.classList.add("es-letra");
        if (usarVoz) hablar(letra.voz);
      }
      programar(apagarEstimulo, expoMs);
    }

    function siguiente() {
      cerrarEnsayo();
      indice++;
      if (indice >= total) {
        terminar();
        return;
      }
      presentar();
      programar(siguiente, soaMs);
    }

    function responder(canal) {
      if (!corriendo || indice < 0) return;
      if (canales.indexOf(canal) === -1 || respondio[canal]) return;
      respondio[canal] = true;
      var boton = botones[canal];
      if (usarFeedback) {
        boton.classList.add(esCoincidencia(canal, indice) ? "is-acierto" : "is-error");
      } else {
        boton.classList.add("is-pulsado");
      }
    }

    // ── Partida ──────────────────────────────────────────────────────
    function textoConsigna() {
      var pasos = n === 1 ? "1 estímulo" : n + " estímulos";
      var partes = [];
      if (canales.indexOf("pos") !== -1) {
        partes.push("la posición es la misma que hace " + pasos + " (" + EpeTeclas.etiqueta(cfg.teclas.pos) + ")");
      }
      if (canales.indexOf("let") !== -1) {
        partes.push("la letra es la misma que hace " + pasos + " (" + EpeTeclas.etiqueta(cfg.teclas.let) + ")");
      }
      return "Respondé cuando " + partes.join(", o cuando ") + ".";
    }

    function etiquetaModo() {
      var nombres = { visual: "Posición", verbal: "Letra", dual: "Posición y letra" };
      return n + "-back · " + nombres[modo] + " · " + (soaMs / 1000).toFixed(1).replace(".", ",") + " s";
    }

    function comenzarPartida() {
      limpiarTimers();
      secPos = generarSecuencia(total, n, POSICIONES.length);
      secLet = generarSecuencia(total, n, LETRAS.length);
      conteo = {
        pos: { coincidencias: 0, aciertos: 0, falsasAlarmas: 0, rechazos: 0 },
        let: { coincidencias: 0, aciertos: 0, falsasAlarmas: 0, rechazos: 0 },
      };
      indice = -1;
      corriendo = true;
      respondio = { pos: false, let: false };
      limpiarBotones();
      apagarEstimulo();
      elActual.textContent = "0";
      elTotal.textContent = String(total);
      elEtiqueta.textContent = etiquetaModo();
      elConsigna.textContent = "Preparate: el ejercicio empieza en un momento…";
      programar(function () {
        elConsigna.textContent = textoConsigna();
        siguiente();
      }, PREPARACION_MS);
    }

    // ── Resumen ──────────────────────────────────────────────────────
    function fila(etiqueta, valor) {
      var f = document.createElement("div");
      f.className = "epe-juego-stat";
      var a = document.createElement("span");
      a.className = "epe-juego-stat-etiqueta";
      a.textContent = etiqueta;
      var b = document.createElement("span");
      b.className = "epe-juego-stat-valor";
      b.textContent = valor;
      f.appendChild(a);
      f.appendChild(b);
      return f;
    }

    function terminar() {
      corriendo = false;
      limpiarTimers();
      entrada.detener();
      apagarEstimulo();
      elConsigna.textContent = "";

      elStats.innerHTML = "";
      elStats.appendChild(fila("Ejercicio", etiquetaModo()));
      elStats.appendChild(fila("Estímulos", String(total)));

      canales.forEach(function (canal) {
        var k = conteo[canal];
        var bien = k.aciertos + k.rechazos;
        var precision = Math.round((bien / total) * 100);
        var titulo = document.createElement("h3");
        titulo.className = "epe-juego-h2";
        titulo.textContent = NOMBRE_CANAL[canal];
        elStats.appendChild(titulo);
        elStats.appendChild(fila("Coincidencias que había", String(k.coincidencias)));
        elStats.appendChild(fila("Aciertos", k.aciertos + " de " + k.coincidencias));
        elStats.appendChild(fila("Omisiones (no respondió)", String(k.coincidencias - k.aciertos)));
        elStats.appendChild(fila("Falsas alarmas (respondió de más)", String(k.falsasAlarmas)));
        elStats.appendChild(fila("Precisión", precision + " %"));
      });

      var nota = document.createElement("p");
      nota.className = "epe-juego-stat-nota";
      nota.textContent =
        "Los primeros " + n + " estímulos no pueden ser coincidencia (todavía no hay un estímulo de hace " +
        n + " paso" + (n === 1 ? "" : "s") + "). La precisión cuenta los estímulos bien resueltos: " +
        "respondió cuando había coincidencia o no respondió cuando no la había.";
      elStats.appendChild(nota);

      elResumen.hidden = false;
      btnDeNuevo.focus();
    }

    // ── Flujo de pantallas ───────────────────────────────────────────
    function leerEjercicio() {
      n = Number(selN.value) || 2;
      modo = selModo.value;
      soaMs = Number(selRitmo.value) || 2500;
      total = Number(selCantidad.value) || 30;
      usarVoz = chkVoz.checked;
      usarFeedback = chkFeedback.checked;
      canales = modo === "visual" ? ["pos"] : modo === "verbal" ? ["let"] : ["pos", "let"];
    }

    function prepararPantalla() {
      // Solo se muestran los botones de las respuestas que el modo usa.
      Object.keys(botones).forEach(function (c) {
        botones[c].hidden = canales.indexOf(c) === -1;
        chips[c].textContent = EpeTeclas.etiqueta(cfg.teclas[c]);
      });
    }

    function empezar() {
      guardarConfig();
      leerEjercicio();
      cfg = panel.leer();
      limpiarTimers();
      if (entrada) entrada.detener();
      entrada = EpeEntrada.crear({
        cfg: cfg,
        getObjetivos: function () {
          return [];
        },
        alAccion: responder,
        alEscape: salirAConfig,
      });
      construirGrilla();
      prepararPantalla();
      elConfig.hidden = true;
      elResumen.hidden = true;
      elJuego.hidden = false;
      entrada.iniciar();
      comenzarPartida();
    }

    function jugarDeNuevo() {
      elResumen.hidden = true;
      entrada.detener();
      entrada.iniciar();
      comenzarPartida();
    }

    function salirAConfig() {
      corriendo = false;
      limpiarTimers();
      if (entrada) entrada.detener();
      elResumen.hidden = true;
      elJuego.hidden = true;
      elConfig.hidden = false;
      elEmpezar.focus();
    }

    // ── Eventos ──────────────────────────────────────────────────────
    elEmpezar.addEventListener("click", empezar);
    btnDeNuevo.addEventListener("click", jugarDeNuevo);
    btnConfigurar.addEventListener("click", salirAConfig);
    btnSalir.addEventListener("click", salirAConfig);
    Object.keys(botones).forEach(function (canal) {
      botones[canal].addEventListener("click", function () {
        responder(canal);
      });
    });

    cargarConfig();
    elEmpezar.focus();
  }

  return { init: init };
})();
