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
 * - Captura de "la próxima tecla que se presione" para asignarla. En celulares y
 *   tablets abre el teclado en pantalla (ver capturar).
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
  // Carpeta de este script: de ahí se carga toque.js (módulo ES) desde los
  // scripts clásicos, con import() dinámico. Se calcula ahora porque
  // document.currentScript solo existe mientras el script se ejecuta.
  var CARPETA = document.currentScript && document.currentScript.src
    ? document.currentScript.src.replace(/[^/]*$/, "")
    : "";
  var promesaToque = null;

  // Devuelve una promesa del módulo _comun/toque.js (zonas y filtros del
  // toque). Se carga una sola vez; si falla, el próximo intento reintenta.
  function cargarToque() {
    if (!promesaToque) {
      promesaToque = import(CARPETA + "toque.js");
      promesaToque.catch(function () {
        promesaToque = null;
      });
    }
    return promesaToque;
  }

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
  var capturaActiva = null; // handler de keydown mientras se espera una tecla
  var limpiarCampo = null; // quita el campo del teclado en pantalla

  function cancelarCaptura() {
    if (capturaActiva) {
      document.removeEventListener("keydown", capturaActiva, true);
      capturaActiva = null;
    }
    if (limpiarCampo) {
      var limpiar = limpiarCampo;
      limpiarCampo = null;
      limpiar();
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

  // ── Teclado en pantalla ─────────────────────────────────────────────
  // El teclado del celular o de la tablet solo se abre si el foco está en un
  // campo de texto: un botón no alcanza. Por eso, en pantallas táctiles, mientras
  // se espera una tecla hay un campo real (invisible) con el foco.
  // Los teclados en pantalla (sobre todo en Android) suelen informar keydown con
  // key "Unidentified" o "Process" (keyCode 229); el carácter llega recién en el
  // evento `input`. Por eso se leen las dos cosas.
  // No hay Esc en el teclado en pantalla: cerrarlo o tocar afuera cancela.
  var ESPERA_CANCELAR_MS = 350; // deja que llegue el clic de otra fila antes de cancelar

  function esTactil() {
    return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  }

  // keydown que no identifica una tecla: la entregará `input`.
  function noIdentifica(ev) {
    var k = String(ev.key).toLowerCase();
    return k === "unidentified" || k === "process" || ev.isComposing === true;
  }

  // Del texto que escribió el teclado en pantalla: la última tecla válida
  // (letra, número, signo o espacio), en minúscula, o null si no sirve.
  function teclaDeTexto(texto) {
    var letras = Array.from(String(texto));
    var c = letras.length ? letras[letras.length - 1] : "";
    if (c === " ") return " ";
    if (/\p{Extended_Pictographic}/u.test(c)) return null; // emojis: no sirven como tecla
    return /^[\p{L}\p{N}\p{P}\p{S}]$/u.test(c) ? c.toLowerCase() : null;
  }

  // Campo invisible. Va dentro de `ancla` (la fila que se está editando) para que
  // el teclado en pantalla desplace esa fila a la vista; sin ancla, fijo al borde.
  // 16 px: evita el zoom automático de iOS al enfocar.
  function crearCampo(ancla) {
    var campo = document.createElement("input");
    campo.type = "text";
    campo.className = "epe-captura-campo";
    campo.setAttribute("aria-label", "Escribí la tecla que querés asignar");
    campo.setAttribute("autocomplete", "off");
    campo.setAttribute("autocapitalize", "off");
    campo.setAttribute("autocorrect", "off");
    campo.setAttribute("spellcheck", "false");
    campo.setAttribute("inputmode", "text");
    campo.setAttribute("enterkeyhint", "done");
    var base = "width:1px;height:1px;margin:0;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none;";
    var padre = ancla && ancla.isConnected ? ancla : null;
    var restaurarPosicion = null;
    if (padre) {
      if (window.getComputedStyle(padre).position === "static") {
        padre.style.position = "relative";
        restaurarPosicion = function () {
          padre.style.position = "";
        };
      }
      campo.style.cssText = base + "position:absolute;left:0;top:0;";
      padre.appendChild(campo);
    } else {
      campo.style.cssText = base + "position:fixed;left:0;bottom:0;";
      document.body.appendChild(campo);
    }
    return {
      campo: campo,
      quitar: function () {
        if (campo.parentNode) campo.parentNode.removeChild(campo);
        if (restaurarPosicion) restaurarPosicion();
      },
    };
  }

  // Espera la próxima tecla.
  // onTecla(tecla): una tecla elegida. onCancelar(): Esc, o (en pantalla táctil)
  // cerrar el teclado o tocar afuera.
  // opciones.ancla: elemento donde poner el campo del teclado en pantalla.
  // Hay que llamarla desde el manejador del toque o clic que inicia la captura:
  // iOS solo abre el teclado si el foco se pide en ese mismo gesto.
  function capturar(onTecla, onCancelar, opciones) {
    cancelarCaptura();

    function terminar(tecla) {
      cancelarCaptura();
      if (tecla === "escape") {
        if (onCancelar) onCancelar();
        return;
      }
      tragarProximoKeyup(tecla);
      onTecla(tecla);
    }

    function handler(ev) {
      if (noIdentifica(ev)) return; // el teclado en pantalla la entrega por `input`
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.repeat) return;
      var tecla = normalizar(ev);
      if (SOLO_MODIFICADORAS[tecla] || esCombinacion(ev)) return;
      terminar(tecla);
    }
    capturaActiva = handler;
    document.addEventListener("keydown", handler, true);

    if (!esTactil()) return;
    var c = crearCampo(opciones && opciones.ancla);
    limpiarCampo = function () {
      c.campo.blur();
      c.quitar();
    };
    c.campo.addEventListener("input", function () {
      var tecla = teclaDeTexto(c.campo.value);
      c.campo.value = "";
      if (tecla !== null) terminar(tecla);
    });
    c.campo.addEventListener("blur", function () {
      window.setTimeout(function () {
        if (capturaActiva !== handler) return; // ya terminó, o empezó otra captura
        cancelarCaptura();
        if (onCancelar) onCancelar();
      }, ESPERA_CANCELAR_MS);
    });
    try {
      c.campo.focus({ preventScroll: false });
    } catch (e) {
      c.campo.focus();
    }
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
    cargarToque: cargarToque,
    leerJSON: leerJSON,
    guardarJSON: guardarJSON,
  };
})();
