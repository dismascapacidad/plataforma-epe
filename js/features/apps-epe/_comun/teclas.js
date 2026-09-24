/**
 * teclas.js
 * Utilidades de teclado compartidas por los juegos de Apps EpE que se
 * juegan por teclado o por pulsador (Hanói, N-back, Stroop).
 *
 * Igual que en el resto de la plataforma, "pulsador" es una tecla: así
 * funciona con cualquier interfaz de switch que emule teclado. Como cada
 * instalación puede emitir teclas distintas (Espacio, Enter, Tab, letras),
 * ninguna tecla es fija: se asignan presionándolas (mismo criterio que
 * Vincular imagen).
 *
 * Qué resuelve este archivo:
 * - Nombre legible de una tecla ("arrowleft" -> "←", " " -> "Espacio").
 * - Captura de "la próxima tecla que se presione" para asignarla.
 * - Un escuchador que, mientras el juego está activo, avisa cuando se
 *   presiona una tecla configurada Y le saca su comportamiento por
 *   defecto (que Espacio no scrollee, que Enter no active el botón que
 *   tenga el foco, que Tab no cambie el foco).
 * - Lectura/escritura de configuración en localStorage, con try/catch
 *   (mismo criterio que theme.js: si no hay storage, funciona igual).
 *
 * Script clásico (ver theme.js). Namespace: EpeTeclas.
 */

var EpeTeclas = (function () {
  var NOMBRES = {
    " ": "Espacio",
    enter: "Enter",
    tab: "Tab",
    escape: "Esc",
    arrowleft: "←",
    arrowright: "→",
    arrowup: "↑",
    arrowdown: "↓",
    backspace: "Retroceso",
    delete: "Supr",
  };

  // Teclas que solas no cuentan como "una tecla" (solo modifican a otra).
  var SOLO_MODIFICADORAS = {
    shift: true,
    control: true,
    alt: true,
    altgraph: true,
    meta: true,
    capslock: true,
    os: true,
    dead: true,
  };

  function normalizar(ev) {
    return String(ev.key).toLowerCase();
  }

  function etiqueta(tecla) {
    if (!tecla) return "—";
    if (NOMBRES[tecla]) return NOMBRES[tecla];
    if (tecla.length === 1) return tecla.toUpperCase();
    return tecla.charAt(0).toUpperCase() + tecla.slice(1);
  }

  function esCombinacion(ev) {
    return ev.ctrlKey || ev.metaKey || ev.altKey;
  }

  // ── Captura de una tecla para asignarla ─────────────────────────────
  var capturaActiva = null;

  function cancelarCaptura() {
    if (capturaActiva) {
      document.removeEventListener("keydown", capturaActiva, true);
      capturaActiva = null;
    }
  }

  // Después de asignar una tecla, su keyup todavía tiene que llegar: si el
  // foco quedó en un botón y la tecla es Espacio, soltarla lo "clickearía"
  // y reabriría la captura. Por eso un keyup descartable, de un solo uso.
  function tragarProximoKeyup(tecla) {
    function up(ev) {
      if (normalizar(ev) !== tecla) return;
      ev.preventDefault();
      ev.stopPropagation();
      document.removeEventListener("keyup", up, true);
    }
    document.addEventListener("keyup", up, true);
    window.setTimeout(function () {
      document.removeEventListener("keyup", up, true);
    }, 1500);
  }

  function capturar(onTecla, onCancelar) {
    cancelarCaptura();
    function handler(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.repeat) return;
      var tecla = normalizar(ev);
      if (SOLO_MODIFICADORAS[tecla] || esCombinacion(ev)) return;
      cancelarCaptura();
      if (tecla === "escape") {
        if (onCancelar) onCancelar();
        return;
      }
      tragarProximoKeyup(tecla);
      onTecla(tecla);
    }
    capturaActiva = handler;
    document.addEventListener("keydown", handler, true);
  }

  // ── Escuchador de teclas del juego ──────────────────────────────────
  // opciones.teclas():        devuelve el array de teclas activas ahora.
  // opciones.alPresionar(t):  se llama una vez por pulsación (sin repetición).
  // Devuelve { activar, desactivar }.
  function escuchar(opciones) {
    var activo = false;

    function esDelJuego(ev) {
      if (esCombinacion(ev)) return false;
      return opciones.teclas().indexOf(normalizar(ev)) !== -1;
    }

    function onKeyDown(ev) {
      if (!esDelJuego(ev)) return;
      ev.preventDefault();
      if (ev.repeat) return;
      opciones.alPresionar(normalizar(ev), ev);
    }

    function onKeyUp(ev) {
      // Espacio activa un botón enfocado al SOLTARLO: hay que frenarlo acá también.
      if (esDelJuego(ev)) ev.preventDefault();
    }

    return {
      activar: function () {
        if (activo) return;
        activo = true;
        document.addEventListener("keydown", onKeyDown, true);
        document.addEventListener("keyup", onKeyUp, true);
      },
      desactivar: function () {
        if (!activo) return;
        activo = false;
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("keyup", onKeyUp, true);
      },
    };
  }

  // ── Persistencia local (opcional) ───────────────────────────────────
  function leerJSON(clave) {
    try {
      return JSON.parse(localStorage.getItem(clave));
    } catch (e) {
      return null;
    }
  }

  function guardarJSON(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch (e) {
      // Sin storage: la configuración vale para esta sesión y ya.
    }
  }

  return {
    normalizar: normalizar,
    etiqueta: etiqueta,
    capturar: capturar,
    cancelarCaptura: cancelarCaptura,
    escuchar: escuchar,
    leerJSON: leerJSON,
    guardarJSON: guardarJSON,
  };
})();
