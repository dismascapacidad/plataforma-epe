/**
 * pulsar.js
 * Respuesta por puntero (dedo, mouse o lápiz) para los juegos que se juegan
 * por teclado o pulsador y además tienen botones en pantalla (Stroop, N-back,
 * SimoNeuro).
 *
 * Por qué no alcanza con "click": el click se dispara al SOLTAR. Con el dedo
 * eso suma lo que dura el toque al tiempo de respuesta, y en N-back una
 * pulsación larga puede caer en el estímulo siguiente. `pointerdown` responde
 * al apoyar, que es el mismo instante que mide una tecla con keydown.
 *
 * El click queda como respaldo para lo que no es un puntero (por ejemplo,
 * un lector de pantalla que "activa" el botón): cuando ya se respondió al
 * apoyar, el click que sigue se ignora, así nunca se cuenta dos veces.
 *
 * Además informa de qué tipo fue la entrada ("toque", "mouse", "lapiz" o
 * "teclado" para todo lo que no es puntero, incluidos los dispositivos que
 * emulan teclado), para decirlo en el resumen: el tiempo de respuesta con
 * pantalla táctil no es comparable con el del teclado.
 *
 * Script clásico (ver theme.js). Namespace: EpePulsar.
 */

var EpePulsar = (function () {
  var ETIQUETAS = {
    teclado: "Teclado o dispositivo",
    toque: "Pantalla táctil",
    mouse: "Mouse",
    lapiz: "Lápiz",
  };
  var ORDEN = ["teclado", "toque", "mouse", "lapiz"];
  var VENTANA_CLICK_MS = 400;

  function origenDe(pointerType) {
    if (pointerType === "touch") return "toque";
    if (pointerType === "pen") return "lapiz";
    return "mouse";
  }

  // alPulsar(origen): se llama una sola vez por pulsación.
  function vincular(el, alPulsar) {
    var respondidoAlApoyar = false;

    function soltar() {
      // El click llega enseguida después de pointerup: se lo ignora un rato.
      window.setTimeout(function () {
        respondidoAlApoyar = false;
      }, VENTANA_CLICK_MS);
    }

    el.addEventListener("pointerdown", function (ev) {
      if (ev.button > 0) return; // solo el botón principal
      respondidoAlApoyar = true;
      alPulsar(origenDe(ev.pointerType));
    });
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointerleave", function (ev) {
      if (ev.pointerType === "mouse") soltar(); // soltó afuera: no habrá click
    });
    el.addEventListener("pointercancel", function () {
      respondidoAlApoyar = false;
    });
    el.addEventListener("click", function () {
      if (respondidoAlApoyar) return;
      alPulsar("teclado");
    });
  }

  // origenes: { toque: true, teclado: true, ... } -> "Pantalla táctil, Teclado o dispositivo"
  function resumen(origenes) {
    var usados = ORDEN.filter(function (k) {
      return origenes && origenes[k];
    }).map(function (k) {
      return ETIQUETAS[k];
    });
    return usados.length ? usados.join(", ") : "—";
  }

  return { vincular: vincular, resumen: resumen };
})();
