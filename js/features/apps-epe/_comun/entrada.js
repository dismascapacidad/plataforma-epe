/**
 * entrada.js
 * Motor de entrada de los juegos por teclado/pulsador. Traduce las teclas
 * a "acciones" del juego (un id), según el modo de acceso elegido:
 *
 *   - "directo": una tecla por acción. Cada tecla dispara su acción.
 *   - "manual":  barrido manual de 2 pulsadores. Una tecla AVANZA el
 *     resaltado por las opciones disponibles y la otra SELECCIONA la
 *     resaltada.
 *   - "auto":    barrido automático de 1 pulsador. El resaltado recorre
 *     solo, a intervalo fijo; cualquiera de las dos teclas selecciona la
 *     opción resaltada en ese momento (mismo criterio que barrido.html:
 *     con un solo pulsador, "avanzar" también selecciona).
 *
 * En los dos barridos, cada selección reinicia el recorrido desde la
 * primera opción (y, en "auto", con el intervalo completo), para dar
 * siempre el mismo tiempo de reacción — igual que barrido.html.
 *
 * El juego solo le dice: cuáles son las opciones AHORA (getObjetivos, se
 * vuelve a consultar en cada paso, porque pueden cambiar) y qué hacer
 * cuando se dispara una acción (alAccion). Las opciones son { id, el }: id
 * es la acción y el es el elemento que se resalta.
 *
 * Script clásico. Namespace: EpeEntrada.
 */

var EpeEntrada = (function () {
  var CLASE_RESALTADO = "epe-scan-actual";

  // cfg:            { modo, teclas:{id:tecla}, avanzar, seleccionar, intervaloMs }
  // getObjetivos(): [{ id, el }] — solo se usa en los modos de barrido.
  // alAccion(id):   se llama cuando el jugador dispara una acción.
  // alEscape():     opcional. Esc siempre está disponible mientras está activo.
  function crear(opciones) {
    var cfg = opciones.cfg;
    var barrido = cfg.modo === "manual" || cfg.modo === "auto";
    var indice = 0;
    var timer = null;
    var elResaltado = null;
    var escuchador = null;
    var activo = false; // false apenas el juego llama a detener() (ej. terminó la partida)

    function teclasActivas() {
      var lista = ["escape"];
      if (barrido) {
        lista.push(cfg.avanzar, cfg.seleccionar);
      } else {
        Object.keys(cfg.teclas).forEach(function (id) {
          lista.push(cfg.teclas[id]);
        });
      }
      return lista;
    }

    // ── Resaltado ─────────────────────────────────────────────────────
    function quitarResaltado() {
      if (elResaltado) {
        elResaltado.classList.remove(CLASE_RESALTADO);
        elResaltado.removeAttribute("data-scan-actual");
        elResaltado = null;
      }
    }

    function resaltar() {
      quitarResaltado();
      var lista = opciones.getObjetivos();
      if (!lista.length) return;
      if (indice >= lista.length) indice = 0;
      elResaltado = lista[indice].el;
      elResaltado.classList.add(CLASE_RESALTADO);
      elResaltado.setAttribute("data-scan-actual", lista[indice].id);
    }

    function avanzar() {
      var lista = opciones.getObjetivos();
      if (!lista.length) return;
      indice = (indice + 1) % lista.length;
      resaltar();
    }

    // ── Barrido automático ────────────────────────────────────────────
    function pararTimer() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function arrancarTimer() {
      pararTimer();
      if (cfg.modo !== "auto") return;
      timer = window.setInterval(avanzar, cfg.intervaloMs);
    }

    function reiniciarRecorrido() {
      indice = 0;
      resaltar();
      arrancarTimer();
    }

    function seleccionar() {
      var lista = opciones.getObjetivos();
      if (!lista.length) return;
      var elegido = lista[Math.min(indice, lista.length - 1)];
      // Se reinicia ANTES de avisar: alAccion puede pedir refrescar()
      // y no queremos que compita con un tick pendiente del timer.
      pararTimer();
      opciones.alAccion(elegido.id);
      // La acción pudo terminar la partida (y llamar a detener()): en ese caso
      // no hay que volver a resaltar ni a arrancar el timer.
      if (activo) reiniciarRecorrido();
    }

    // ── Teclas ────────────────────────────────────────────────────────
    function alPresionar(tecla) {
      if (tecla === "escape") {
        if (opciones.alEscape) opciones.alEscape();
        return;
      }
      if (!barrido) {
        var id = Object.keys(cfg.teclas).find(function (k) {
          return cfg.teclas[k] === tecla;
        });
        if (id) opciones.alAccion(id);
        return;
      }
      if (cfg.modo === "manual") {
        if (tecla === cfg.avanzar) avanzar();
        else if (tecla === cfg.seleccionar) seleccionar();
      } else {
        // auto: con un solo pulsador, cualquiera de las dos teclas selecciona
        seleccionar();
      }
    }

    escuchador = EpeTeclas.escuchar({ teclas: teclasActivas, alPresionar: alPresionar });

    return {
      iniciar: function () {
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        activo = true;
        escuchador.activar();
        if (barrido) reiniciarRecorrido();
      },
      detener: function () {
        activo = false;
        escuchador.desactivar();
        pararTimer();
        quitarResaltado();
      },
      // Las opciones pudieron cambiar (ej. apareció "Deshacer"): reaplicar
      // el resaltado sin mover el recorrido.
      refrescar: function () {
        if (barrido && activo) resaltar();
      },
    };
  }

  return { crear: crear };
})();
