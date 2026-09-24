/**
 * stroop.js
 * App EpE — Stroop. Ejercicio de control inhibitorio y atención
 * selectiva: aparece una palabra que nombra un color, escrita con tinta de
 * un color, y hay que responder al color de la TINTA ignorando lo que dice
 * la palabra.
 *
 * Reglas que conviene tener presentes al leer el código:
 * - 4 colores (rojo, azul, verde, amarillo), una tecla por color (por
 *   defecto A S D F, reasignables), o barrido de 1 o 2 pulsadores sobre
 *   los 4 botones de color (ver entrada.js).
 * - Cada estímulo es "congruente" (la palabra y la tinta coinciden) o
 *   "incongruente" (no coinciden). Por defecto es mitad y mitad, con un
 *   tope de 3 seguidos del mismo tipo para que no sea predecible. También
 *   se puede practicar solo con uno de los dos tipos.
 * - Termina por cantidad de estímulos (por defecto) o por tiempo. Nunca
 *   hay tiempo límite POR estímulo: el juego espera la respuesta. Un error
 *   no se repite ni penaliza más que sumar al contador.
 * - Entre una respuesta y el estímulo siguiente hay una pausa corta con
 *   una cruz de fijación, en la que no se aceptan respuestas (evita que
 *   una pulsación doble cuente para el estímulo que aparece).
 * - Efecto de interferencia = mediana del tiempo de respuesta en
 *   incongruentes − en congruentes (solo respuestas correctas). Se calcula
 *   únicamente con teclas directas: con barrido, el tiempo incluye lo que
 *   tarda el resaltado en llegar a la opción, y ya no mide velocidad de
 *   procesamiento — el resumen lo aclara y no muestra tiempos.
 *
 * Los colores no están acá: el JS solo maneja ids ("rojo", …) y el CSS
 * decide el tono (css/features/apps-epe/stroop.css).
 *
 * Script clásico. Namespace: EpeStroop. Depende de teclas.js, entrada.js y
 * acceso.js (js/features/apps-epe/_comun/).
 */

var EpeStroop = (function () {
  var COLORES = [
    { id: "rojo", nombre: "ROJO", etiqueta: "Rojo", tecla: "a" },
    { id: "azul", nombre: "AZUL", etiqueta: "Azul", tecla: "s" },
    { id: "verde", nombre: "VERDE", etiqueta: "Verde", tecla: "d" },
    { id: "amarillo", nombre: "AMARILLO", etiqueta: "Amarillo", tecla: "f" },
  ];

  var ACCIONES = COLORES.map(function (c) {
    return { id: c.id, etiqueta: c.etiqueta, tecla: c.tecla };
  });

  var PAUSA_MS = 450; // cruz de fijación entre estímulos
  var FEEDBACK_MS = 320;
  var MAX_SEGUIDOS_MISMO_TIPO = 3;
  var MIN_PARA_INTERFERENCIA = 3; // respuestas correctas mínimas por tipo para calcular medianas
  var CLAVE_CONFIG = "epe-stroop-config";

  function mediana(valores) {
    if (!valores.length) return null;
    var v = valores.slice().sort(function (a, b) {
      return a - b;
    });
    var m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  function aleatorio(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
  }

  function formatearTiempo(seg) {
    var m = Math.floor(seg / 60);
    var s = seg % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function init(root) {
    if (!root) return;

    // ── DOM ──────────────────────────────────────────────────────────
    var elConfig = root.querySelector("[data-juego-config]");
    var elEmpezar = root.querySelector("[data-juego-empezar]");
    var selDuracion = root.querySelector("[data-stroop-duracion]");
    var selMezcla = root.querySelector("[data-stroop-mezcla]");
    var chkFeedback = root.querySelector("[data-stroop-feedback]");
    var elJuego = root.querySelector("[data-stroop-juego]");
    var elProgreso = root.querySelector("[data-stroop-progreso]");
    var elAciertos = root.querySelector("[data-stroop-aciertos]");
    var elErrores = root.querySelector("[data-stroop-errores]");
    var elPalabra = root.querySelector("[data-stroop-palabra]");
    var elAyuda = root.querySelector("[data-juego-ayuda]");
    var btnSalir = root.querySelector("[data-stroop-salir]");
    var elResumen = root.querySelector("[data-juego-resumen]");
    var elStats = root.querySelector("[data-juego-stats]");
    var btnDeNuevo = root.querySelector("[data-juego-de-nuevo]");
    var btnConfigurar = root.querySelector("[data-juego-configurar]");
    var botones = {};
    COLORES.forEach(function (c) {
      botones[c.id] = root.querySelector('[data-color="' + c.id + '"]');
    });

    var panel = EpeAcceso.crearPanel(root.querySelector("[data-acceso-panel]"), {
      id: "stroop",
      acciones: ACCIONES,
      permitirBarrido: true,
    });

    // ── Estado ───────────────────────────────────────────────────────
    var cfg = null;
    var entrada = null;

    var tipoDuracion = "cantidad"; // "cantidad" | "tiempo"
    var limite = 20; // estímulos o segundos, según tipoDuracion
    var mezcla = "mezcla";
    var usarFeedback = true;

    var actual = null; // { palabra: color, tinta: color, tipo: "cong"|"incong" }
    var previo = null;
    var seguidosMismoTipo = 0;
    var t0 = 0;
    var aceptando = false; // false durante la pausa entre estímulos
    var corriendo = false;
    var respuestas = []; // { tipo, correcto, rt }
    var aciertos = 0;
    var errores = 0;
    var finTiempo = 0;
    var timerReloj = null;
    var timers = [];

    // ── Configuración guardada (solo los selectores del ejercicio) ────
    function cargarConfig() {
      var g = EpeTeclas.leerJSON(CLAVE_CONFIG);
      if (!g || typeof g !== "object") return;
      if (["c20", "c30", "c40", "t30", "t60", "t90"].indexOf(g.duracion) !== -1) selDuracion.value = g.duracion;
      if (["mezcla", "congruentes", "incongruentes"].indexOf(g.mezcla) !== -1) selMezcla.value = g.mezcla;
      if (typeof g.feedback === "boolean") chkFeedback.checked = g.feedback;
    }

    function guardarConfig() {
      EpeTeclas.guardarJSON(CLAVE_CONFIG, {
        duracion: selDuracion.value,
        mezcla: selMezcla.value,
        feedback: chkFeedback.checked,
      });
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
      if (timerReloj) {
        window.clearInterval(timerReloj);
        timerReloj = null;
      }
    }

    // ── Estímulos ────────────────────────────────────────────────────
    function elegirTipo() {
      if (mezcla === "congruentes") return "cong";
      if (mezcla === "incongruentes") return "incong";
      var tipo = Math.random() < 0.5 ? "cong" : "incong";
      // Tope de repeticiones seguidas del mismo tipo.
      if (actual && actual.tipo === tipo && seguidosMismoTipo >= MAX_SEGUIDOS_MISMO_TIPO) {
        tipo = tipo === "cong" ? "incong" : "cong";
      }
      return tipo;
    }

    function generarEstimulo() {
      var tipo = elegirTipo();
      var intento;
      do {
        var palabra = aleatorio(COLORES);
        var tinta =
          tipo === "cong"
            ? palabra
            : aleatorio(
                COLORES.filter(function (c) {
                  return c.id !== palabra.id;
                })
              );
        intento = { palabra: palabra, tinta: tinta, tipo: tipo };
        // No repetir exactamente el estímulo anterior.
      } while (previo && previo.palabra.id === intento.palabra.id && previo.tinta.id === intento.tinta.id);
      return intento;
    }

    function mostrarCruz() {
      elPalabra.textContent = "+";
      elPalabra.className = "epe-stroop-palabra";
    }

    function presentar() {
      var e = generarEstimulo();
      seguidosMismoTipo = actual && actual.tipo === e.tipo ? seguidosMismoTipo + 1 : 1;
      previo = actual = e;
      elPalabra.textContent = e.palabra.nombre;
      elPalabra.className = "epe-stroop-palabra tinta-" + e.tinta.id;
      t0 = window.performance.now();
      aceptando = true;
    }

    function limpiarBotones() {
      Object.keys(botones).forEach(function (id) {
        botones[id].classList.remove("is-acierto", "is-error");
      });
    }

    function actualizarHud() {
      elAciertos.textContent = String(aciertos);
      elErrores.textContent = String(errores);
      if (tipoDuracion === "cantidad") {
        elProgreso.textContent = "Estímulo " + Math.min(respuestas.length + 1, limite) + " de " + limite;
      }
    }

    // ── Respuesta ────────────────────────────────────────────────────
    function responder(idColor) {
      if (!corriendo || !aceptando || !actual) return;
      aceptando = false;

      var rt = Math.round(window.performance.now() - t0);
      var correcto = idColor === actual.tinta.id;
      respuestas.push({ tipo: actual.tipo, correcto: correcto, rt: rt });
      if (correcto) aciertos++;
      else errores++;

      limpiarBotones();
      if (usarFeedback) {
        botones[idColor].classList.add(correcto ? "is-acierto" : "is-error");
      }
      mostrarCruz();
      actualizarHud();

      if (tipoDuracion === "cantidad" && respuestas.length >= limite) {
        programar(terminar, FEEDBACK_MS);
        return;
      }

      programar(limpiarBotones, FEEDBACK_MS);
      programar(function () {
        if (corriendo) presentar();
      }, PAUSA_MS);
    }

    // ── Reloj (solo en el modo por tiempo) ───────────────────────────
    function tickReloj() {
      var restante = Math.max(0, Math.ceil((finTiempo - window.performance.now()) / 1000));
      elProgreso.textContent = "Tiempo: " + formatearTiempo(restante);
      if (restante <= 0) terminar();
    }

    // ── Partida ──────────────────────────────────────────────────────
    function comenzarPartida() {
      limpiarTimers();
      limpiarBotones();
      respuestas = [];
      aciertos = 0;
      errores = 0;
      actual = null;
      previo = null;
      seguidosMismoTipo = 0;
      corriendo = true;
      aceptando = false;
      mostrarCruz();
      actualizarHud();

      if (tipoDuracion === "tiempo") {
        // El reloj arranca junto con el primer estímulo, no antes.
        finTiempo = window.performance.now() + PAUSA_MS + limite * 1000;
        tickReloj();
        timerReloj = window.setInterval(tickReloj, 200);
      }
      programar(presentar, PAUSA_MS);
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

    function titulo(texto) {
      var h = document.createElement("h3");
      h.className = "epe-juego-h2";
      h.textContent = texto;
      return h;
    }

    function porcentaje(parte, todo) {
      return todo ? Math.round((parte / todo) * 100) + " %" : "—";
    }

    function ms(v) {
      return v == null ? "—" : Math.round(v) + " ms";
    }

    function terminar() {
      if (!corriendo) return;
      corriendo = false;
      aceptando = false;
      limpiarTimers();
      entrada.detener();
      mostrarCruz();

      var conTiempos = cfg.modo === "directo";
      var total = respuestas.length;
      var porTipo = { cong: [], incong: [] };
      respuestas.forEach(function (r) {
        porTipo[r.tipo].push(r);
      });

      elStats.innerHTML = "";
      elStats.appendChild(fila("Estímulos respondidos", String(total)));
      elStats.appendChild(fila("Aciertos", aciertos + " (" + porcentaje(aciertos, total) + ")"));
      elStats.appendChild(fila("Errores", String(errores)));

      [
        { clave: "cong", texto: "Coinciden palabra y tinta" },
        { clave: "incong", texto: "No coinciden (interferencia)" },
      ].forEach(function (grupo) {
        var lista = porTipo[grupo.clave];
        if (!lista.length) return;
        var ok = lista.filter(function (r) {
          return r.correcto;
        });
        elStats.appendChild(titulo(grupo.texto));
        elStats.appendChild(fila("Aciertos", ok.length + " de " + lista.length + " (" + porcentaje(ok.length, lista.length) + ")"));
        if (conTiempos) {
          elStats.appendChild(
            fila(
              "Tiempo de respuesta (mediana)",
              ms(
                mediana(
                  ok.map(function (r) {
                    return r.rt;
                  })
                )
              )
            )
          );
        }
      });

      if (conTiempos) {
        var mCong = mediana(
          porTipo.cong
            .filter(function (r) {
              return r.correcto;
            })
            .map(function (r) {
              return r.rt;
            })
        );
        var mInc = mediana(
          porTipo.incong
            .filter(function (r) {
              return r.correcto;
            })
            .map(function (r) {
              return r.rt;
            })
        );
        var suficientes =
          porTipo.cong.filter(function (r) {
            return r.correcto;
          }).length >= MIN_PARA_INTERFERENCIA &&
          porTipo.incong.filter(function (r) {
            return r.correcto;
          }).length >= MIN_PARA_INTERFERENCIA;
        if (suficientes) {
          elStats.appendChild(titulo("Efecto de interferencia"));
          elStats.appendChild(fila("Incongruentes − congruentes", ms(mInc - mCong)));
        }
      } else {
        var nota = document.createElement("p");
        nota.className = "epe-juego-stat-nota";
        nota.textContent =
          "Jugaste con barrido: el tiempo de respuesta incluye lo que tarda el resaltado en llegar a cada " +
          "opción, así que no se muestra como velocidad de procesamiento. Se comparan los aciertos.";
        elStats.appendChild(nota);
      }

      elResumen.hidden = false;
      btnDeNuevo.focus();
    }

    // ── Entrada (teclas directas o barrido) ──────────────────────────
    function getObjetivos() {
      return COLORES.map(function (c) {
        return { id: c.id, el: botones[c.id] };
      });
    }

    function actualizarAyuda() {
      elAyuda.innerHTML = "";
      EpeAcceso.resumenTeclas(cfg, ACCIONES).forEach(function (item) {
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

    // Con teclas directas cada botón muestra su tecla; con barrido las
    // teclas no son por color, así que se ocultan (la ayuda las explica).
    function actualizarChips() {
      var directo = cfg.modo === "directo";
      COLORES.forEach(function (c) {
        var chip = root.querySelector('[data-tecla-color="' + c.id + '"]');
        chip.hidden = !directo;
        if (directo) chip.textContent = EpeTeclas.etiqueta(cfg.teclas[c.id]);
      });
      // En directo la ayuda repetiría lo que ya dicen los botones.
      elAyuda.hidden = directo;
    }

    // ── Flujo de pantallas ───────────────────────────────────────────
    function leerEjercicio() {
      var d = selDuracion.value;
      tipoDuracion = d.charAt(0) === "t" ? "tiempo" : "cantidad";
      limite = Number(d.slice(1)) || 20;
      mezcla = selMezcla.value;
      usarFeedback = chkFeedback.checked;
    }

    function empezar() {
      guardarConfig();
      leerEjercicio();
      cfg = panel.leer();
      limpiarTimers();
      if (entrada) entrada.detener();
      entrada = EpeEntrada.crear({
        cfg: cfg,
        getObjetivos: getObjetivos,
        alAccion: responder,
        alEscape: salirAConfig,
      });
      elConfig.hidden = true;
      elResumen.hidden = true;
      elJuego.hidden = false;
      actualizarChips();
      actualizarAyuda();
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
      aceptando = false;
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
    COLORES.forEach(function (c) {
      botones[c.id].addEventListener("click", function () {
        responder(c.id);
      });
    });

    cargarConfig();
    elEmpezar.focus();
  }

  return { init: init };
})();
