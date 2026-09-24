/**
 * hanoi.js
 * App EpE — Torre de Hanói. Ejercicio de planificación y función
 * ejecutiva: pasar una pila de discos de la varilla 1 a la 3, de a un
 * disco por vez, sin apoyar nunca uno grande sobre uno más chico.
 *
 * Pensado para jugarse sin puntero:
 * - Cada varilla es una "opción" con su propia tecla (por defecto A S D),
 *   más una tecla para deshacer (Z). Todas reasignables.
 * - Elegir un movimiento son DOS pasos (varilla de origen y después de
 *   destino), así que solo hay 3 blancos a la vez: el barrido de 1 o 2
 *   pulsadores recorre 3 opciones (4 si hay algo para deshacer).
 * - No hay tiempo: el juego espera. La partida no se pierde nunca, se
 *   puede deshacer, y un movimiento inválido no penaliza más que sumar al
 *   contador de intentos inválidos (que se ve en el resumen).
 * - Si un movimiento es inválido, la varilla de origen SIGUE elegida: para
 *   quien usa barrido, volver a elegir el origen costaría varios pasos.
 *   Para cancelar la elección, se vuelve a elegir la misma varilla.
 *
 * El puntero también funciona (cada varilla es un botón grande), pero el
 * teclado nunca depende de él.
 *
 * Script clásico. Namespace: EpeHanoi. Depende de teclas.js, entrada.js y
 * acceso.js (js/features/apps-epe/_comun/).
 */

var EpeHanoi = (function () {
  var ACCIONES = [
    { id: "v0", etiqueta: "Varilla 1", tecla: "a" },
    { id: "v1", etiqueta: "Varilla 2", tecla: "s" },
    { id: "v2", etiqueta: "Varilla 3", tecla: "d" },
    { id: "deshacer", etiqueta: "Deshacer", tecla: "z" },
  ];

  function init(root) {
    if (!root) return;

    // ── DOM ──────────────────────────────────────────────────────────
    var elConfig = root.querySelector("[data-juego-config]");
    var elEmpezar = root.querySelector("[data-juego-empezar]");
    var elDiscos = root.querySelector("[data-hanoi-discos]");
    var elJuego = root.querySelector("[data-hanoi-juego]");
    var elEscenario = root.querySelector("[data-hanoi-escenario]");
    var elMensaje = root.querySelector("[data-hanoi-mensaje]");
    var elAyuda = root.querySelector("[data-juego-ayuda]");
    var elMov = root.querySelector("[data-hanoi-mov]");
    var elMin = root.querySelector("[data-hanoi-min]");
    var elInv = root.querySelector("[data-hanoi-inv]");
    var btnDeshacer = root.querySelector("[data-hanoi-deshacer]");
    var btnReiniciar = root.querySelector("[data-hanoi-reiniciar]");
    var btnSalir = root.querySelector("[data-hanoi-salir]");
    var chipDeshacer = root.querySelector("[data-tecla-deshacer]");
    var varillas = Array.prototype.slice.call(root.querySelectorAll("[data-varilla]"));
    var elResumen = root.querySelector("[data-juego-resumen]");
    var elStats = root.querySelector("[data-juego-stats]");
    var btnDeNuevo = root.querySelector("[data-juego-de-nuevo]");
    var btnConfigurar = root.querySelector("[data-juego-configurar]");

    var panel = EpeAcceso.crearPanel(root.querySelector("[data-acceso-panel]"), {
      id: "hanoi",
      acciones: ACCIONES,
      permitirBarrido: true,
    });

    // ── Estado ───────────────────────────────────────────────────────
    var cfg = null;
    var entrada = null;
    var n = 3;
    var pilas = [[], [], []]; // cada pila va de la base (disco más grande) al tope
    var origen = null; // null = todavía no se eligió la varilla de origen
    var historial = []; // [{ desde, hasta }]
    var invalidos = 0;
    var usosDeshacer = 0;
    var terminado = false;
    var timerFin = null;

    // ── Mensajes ─────────────────────────────────────────────────────
    function mensaje(texto, tipo) {
      elMensaje.textContent = texto;
      elMensaje.className = "epe-hanoi-mensaje" + (tipo ? " is-" + tipo : "");
    }

    function mensajeInicial() {
      mensaje("Elegí la varilla de origen: de dónde sacás el disco.", null);
    }

    function marcarError(idx) {
      var el = varillas[idx];
      el.classList.remove("is-error");
      // Forzar reflow para que la animación se reinicie si el error se repite.
      void el.offsetWidth;
      el.classList.add("is-error");
      window.setTimeout(function () {
        el.classList.remove("is-error");
      }, 420);
    }

    // ── Dibujo ───────────────────────────────────────────────────────
    function render() {
      varillas.forEach(function (varilla, p) {
        var contenedor = varilla.querySelector("[data-discos]");
        contenedor.innerHTML = "";
        pilas[p].forEach(function (tam, pos) {
          var disco = document.createElement("span");
          disco.className = "epe-hanoi-disco";
          disco.style.setProperty("--k", String(n > 1 ? (tam - 1) / (n - 1) : 1));
          disco.textContent = String(tam);
          if (pos === pilas[p].length - 1) disco.classList.add("is-tope");
          contenedor.appendChild(disco);
        });
        varilla.classList.toggle("is-origen", origen === p);
        var tope = pilas[p].length ? ", disco de arriba: " + pilas[p][pilas[p].length - 1] : ", vacía";
        varilla.setAttribute("aria-label", "Varilla " + (p + 1) + ": " + pilas[p].length + " discos" + tope);
      });
      elMov.textContent = String(historial.length);
      elInv.textContent = String(invalidos);
      btnDeshacer.disabled = historial.length === 0 || terminado;
    }

    // ── Reglas ───────────────────────────────────────────────────────
    function nuevaPartida() {
      window.clearTimeout(timerFin);
      n = Number(elDiscos.value) || 3;
      pilas = [[], [], []];
      for (var t = n; t >= 1; t--) pilas[0].push(t);
      origen = null;
      historial = [];
      invalidos = 0;
      usosDeshacer = 0;
      terminado = false;
      elEscenario.style.setProperty("--discos", String(n));
      elMin.textContent = String(Math.pow(2, n) - 1);
      mensajeInicial();
      render();
    }

    function elegir(p) {
      if (terminado) return;

      if (origen === null) {
        if (!pilas[p].length) {
          invalidos++;
          marcarError(p);
          mensaje("La varilla " + (p + 1) + " está vacía: elegí una que tenga discos.", "error");
          render();
          return;
        }
        origen = p;
        mensaje("Sacás de la varilla " + (p + 1) + ". Ahora elegí el destino.", "origen");
        render();
        return;
      }

      if (origen === p) {
        origen = null;
        mensajeInicial();
        render();
        return;
      }

      mover(origen, p);
    }

    function mover(desde, hasta) {
      var disco = pilas[desde][pilas[desde].length - 1];
      var encima = pilas[hasta][pilas[hasta].length - 1];

      if (encima !== undefined && encima < disco) {
        invalidos++;
        marcarError(hasta);
        mensaje(
          "No se puede: el disco " + disco + " es más grande que el " + encima + ". Elegí otro destino.",
          "error"
        );
        render();
        return;
      }

      pilas[hasta].push(pilas[desde].pop());
      historial.push({ desde: desde, hasta: hasta });
      origen = null;
      mensajeInicial();
      render();

      if (pilas[2].length === n) ganar();
    }

    function deshacer() {
      if (terminado || !historial.length) return;
      var ultimo = historial.pop();
      pilas[ultimo.desde].push(pilas[ultimo.hasta].pop());
      usosDeshacer++;
      origen = null;
      mensaje("Deshiciste el último movimiento.", null);
      render();
      // Si no quedó nada para deshacer, esa opción sale del recorrido.
      if (entrada) entrada.refrescar();
    }

    // ── Fin de partida ───────────────────────────────────────────────
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

    function ganar() {
      terminado = true;
      entrada.detener();
      varillas[2].classList.add("is-ok");
      mensaje("¡Lo lograste!", null);

      var minimo = Math.pow(2, n) - 1;
      var movs = historial.length;
      var eficiencia = Math.round((minimo / movs) * 100);

      elStats.innerHTML = "";
      elStats.appendChild(fila("Discos", String(n)));
      elStats.appendChild(fila("Movimientos", String(movs)));
      elStats.appendChild(fila("Mínimo posible", String(minimo)));
      elStats.appendChild(fila("Eficiencia", eficiencia + " %"));
      elStats.appendChild(fila("Intentos inválidos", String(invalidos)));
      elStats.appendChild(fila("Veces que usó deshacer", String(usosDeshacer)));
      if (movs === minimo && usosDeshacer === 0) {
        var nota = document.createElement("p");
        nota.className = "epe-juego-stat-nota";
        nota.textContent = "Solución perfecta: se resolvió con el mínimo de movimientos.";
        elStats.appendChild(nota);
      }

      // Una pausa corta para que se vea la torre completa antes del cartel.
      timerFin = window.setTimeout(function () {
        varillas[2].classList.remove("is-ok");
        elResumen.hidden = false;
        btnDeNuevo.focus();
      }, 700);
    }

    // ── Entrada (teclas directas o barrido) ──────────────────────────
    function getObjetivos() {
      var lista = varillas.map(function (el, p) {
        return { id: "v" + p, el: el };
      });
      if (historial.length) lista.push({ id: "deshacer", el: btnDeshacer });
      return lista;
    }

    function alAccion(id) {
      if (id === "deshacer") deshacer();
      else elegir(Number(id.slice(1)));
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

    // Con teclas directas, cada varilla muestra su tecla; con barrido las
    // teclas no son por varilla, así que se ocultan (la ayuda las explica).
    function actualizarChips() {
      var directo = cfg.modo === "directo";
      varillas.forEach(function (v, p) {
        var chip = v.querySelector("[data-tecla-varilla]");
        chip.hidden = !directo;
        if (directo) chip.textContent = EpeTeclas.etiqueta(cfg.teclas["v" + p]);
      });
      chipDeshacer.hidden = !directo;
      if (directo) chipDeshacer.textContent = EpeTeclas.etiqueta(cfg.teclas.deshacer);
    }

    // ── Flujo de pantallas ───────────────────────────────────────────
    function empezar() {
      cfg = panel.leer();
      if (entrada) entrada.detener();
      entrada = EpeEntrada.crear({
        cfg: cfg,
        getObjetivos: getObjetivos,
        alAccion: alAccion,
        alEscape: salirAConfig,
      });
      elConfig.hidden = true;
      elResumen.hidden = true;
      elJuego.hidden = false;
      actualizarChips();
      actualizarAyuda();
      nuevaPartida();
      entrada.iniciar();
    }

    function jugarDeNuevo() {
      elResumen.hidden = true;
      entrada.detener();
      nuevaPartida();
      entrada.iniciar();
    }

    function reiniciar() {
      nuevaPartida();
      entrada.iniciar(); // reinicia el recorrido del barrido desde la primera opción
    }

    function salirAConfig() {
      window.clearTimeout(timerFin);
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
    btnReiniciar.addEventListener("click", reiniciar);
    btnSalir.addEventListener("click", salirAConfig);
    btnDeshacer.addEventListener("click", deshacer);
    varillas.forEach(function (v, p) {
      v.addEventListener("click", function () {
        elegir(p);
      });
    });

    elEmpezar.focus();
  }

  return { init: init };
})();
