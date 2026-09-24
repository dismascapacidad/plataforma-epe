/**
 * acceso.js
 * Panel de "cómo se responde" que comparten los juegos por teclado/pulsador
 * (Hanói, N-back, Stroop): modo de acceso, velocidad del barrido y
 * asignación de teclas. Se dibuja dentro del modal de configuración de
 * cada juego y devuelve la configuración elegida con leer().
 *
 * Modos (ver entrada.js, que es quien los ejecuta):
 *   - "directo": una tecla por acción.
 *   - "manual":  barrido manual, 2 pulsadores (avanzar + seleccionar).
 *   - "auto":    barrido automático, 1 pulsador.
 * Los juegos que no admiten barrido (N-back: solo tiene 1 o 2 respuestas y
 * el ritmo lo marca el estímulo) pasan permitirBarrido:false y el panel
 * muestra solo la asignación de teclas.
 *
 * Asignar una tecla: se hace clic (o Enter) en la tecla actual y se
 * presiona la nueva; Esc cancela. Si la tecla nueva ya la usaba otra
 * acción, las dos se INTERCAMBIAN — nunca queda una acción sin tecla.
 *
 * Todo se guarda en localStorage por juego (si hay storage), para que
 * quien arma el equipo de un paciente lo configure una sola vez.
 *
 * Script clásico. Namespace: EpeAcceso. Depende de teclas.js.
 */

var EpeAcceso = (function () {
  var SCAN_DEFAULT = { avanzar: "k", seleccionar: "l", intervaloMs: 1500 };

  // El slider guarda una VELOCIDAD (más a la derecha = más rápido), pero el
  // barrido necesita un INTERVALO en ms (más alto = más lento): se invierte
  // en un solo lugar (mismo criterio que barrido.js).
  var INTERVALO_MIN_MS = 400;
  var INTERVALO_MAX_MS = 3000;

  function sliderAIntervalo(valor) {
    return INTERVALO_MIN_MS + INTERVALO_MAX_MS - valor;
  }

  function intervaloASlider(ms) {
    return INTERVALO_MIN_MS + INTERVALO_MAX_MS - ms;
  }

  var MODOS = [
    {
      valor: "directo",
      titulo: "Teclas directas",
      detalle: "Una tecla por cada opción.",
    },
    {
      valor: "manual",
      titulo: "Barrido con 2 pulsadores",
      detalle: "Un pulsador avanza el resaltado y el otro selecciona.",
    },
    {
      valor: "auto",
      titulo: "Barrido automático, 1 pulsador",
      detalle: "El resaltado recorre solo; el pulsador selecciona.",
    },
  ];

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }

  // opciones: { id, acciones:[{id, etiqueta, tecla}], permitirBarrido }
  function crearPanel(contenedor, opciones) {
    var claveStorage = "epe-acceso-" + opciones.id;
    var acciones = opciones.acciones;
    var permitirBarrido = opciones.permitirBarrido !== false;

    var estado = cargar();
    var editando = null; // clave de la tecla que se está asignando ("accion:<id>", "avanzar", "seleccionar")

    function porDefecto() {
      var teclas = {};
      acciones.forEach(function (a) {
        teclas[a.id] = a.tecla;
      });
      return {
        modo: "directo",
        teclas: teclas,
        avanzar: SCAN_DEFAULT.avanzar,
        seleccionar: SCAN_DEFAULT.seleccionar,
        intervaloMs: SCAN_DEFAULT.intervaloMs,
      };
    }

    // Lo guardado puede venir de una versión anterior del juego: solo se
    // usa si sigue teniendo el mismo shape; si no, se vuelve a los defaults.
    function cargar() {
      var base = porDefecto();
      var guardado = EpeTeclas.leerJSON(claveStorage);
      if (!guardado || typeof guardado !== "object") return base;
      var valido = true;
      acciones.forEach(function (a) {
        if (!guardado.teclas || typeof guardado.teclas[a.id] !== "string") valido = false;
      });
      if (!valido) return base;
      if (typeof guardado.avanzar !== "string" || typeof guardado.seleccionar !== "string") return base;
      if (typeof guardado.intervaloMs !== "number") return base;
      if (guardado.modo !== "directo" && guardado.modo !== "manual" && guardado.modo !== "auto") return base;
      if (!permitirBarrido) guardado.modo = "directo";
      return guardado;
    }

    function guardar() {
      EpeTeclas.guardarJSON(claveStorage, estado);
    }

    // ── Asignación con intercambio ────────────────────────────────────
    function asignar(clave, tecla) {
      if (clave === "avanzar" || clave === "seleccionar") {
        var otra = clave === "avanzar" ? "seleccionar" : "avanzar";
        if (estado[otra] === tecla) estado[otra] = estado[clave];
        estado[clave] = tecla;
      } else {
        var id = clave.slice("accion:".length);
        Object.keys(estado.teclas).forEach(function (otroId) {
          if (otroId !== id && estado.teclas[otroId] === tecla) {
            estado.teclas[otroId] = estado.teclas[id];
          }
        });
        estado.teclas[id] = tecla;
      }
      guardar();
    }

    // ── Dibujo ────────────────────────────────────────────────────────
    contenedor.innerHTML = "";
    contenedor.classList.add("epe-acceso");

    var elModos = null;
    var elVelocidad = null;
    var elTeclas = el("div", "epe-acceso-teclas");

    if (permitirBarrido) {
      contenedor.appendChild(el("h2", "epe-juego-h2", "Cómo vas a responder"));
      elModos = el("div", "epe-acceso-modos");
      MODOS.forEach(function (m) {
        var label = el("label", "epe-acceso-modo");
        var radio = el("input");
        radio.type = "radio";
        radio.name = "acceso-modo-" + opciones.id;
        radio.value = m.valor;
        radio.checked = estado.modo === m.valor;
        radio.addEventListener("change", function () {
          estado.modo = m.valor;
          guardar();
          dibujarTeclas();
          actualizarVelocidad();
        });
        var texto = el("span", "epe-acceso-modo-texto");
        texto.appendChild(el("strong", null, m.titulo));
        texto.appendChild(el("small", null, m.detalle));
        label.appendChild(radio);
        label.appendChild(texto);
        elModos.appendChild(label);
      });
      contenedor.appendChild(elModos);

      elVelocidad = el("div", "epe-acceso-velocidad");
      var etiquetaVel = el("label", null, "Velocidad del barrido");
      etiquetaVel.setAttribute("for", "acceso-vel-" + opciones.id);
      var slider = el("input");
      slider.type = "range";
      slider.id = "acceso-vel-" + opciones.id;
      slider.min = String(INTERVALO_MIN_MS);
      slider.max = String(INTERVALO_MAX_MS);
      slider.step = "100";
      slider.value = String(intervaloASlider(estado.intervaloMs));
      var valorVel = el("span", "epe-acceso-velocidad-valor");
      function textoVelocidad() {
        valorVel.textContent = "pasa cada " + (estado.intervaloMs / 1000).toFixed(1).replace(".", ",") + " s";
      }
      textoVelocidad();
      slider.addEventListener("input", function () {
        estado.intervaloMs = sliderAIntervalo(Number(slider.value));
        textoVelocidad();
        guardar();
      });
      elVelocidad.appendChild(etiquetaVel);
      elVelocidad.appendChild(slider);
      elVelocidad.appendChild(valorVel);
      contenedor.appendChild(elVelocidad);
    }

    contenedor.appendChild(el("h2", "epe-juego-h2", "Teclas"));
    contenedor.appendChild(elTeclas);
    contenedor.appendChild(
      el(
        "p",
        "epe-acceso-ayuda",
        "Para cambiar una tecla, hacé clic (o Enter) sobre ella y presioná la nueva. Esc cancela."
      )
    );

    function actualizarVelocidad() {
      if (elVelocidad) elVelocidad.hidden = estado.modo !== "auto";
    }

    function filaTecla(clave, nombre, tecla) {
      var fila = el("div", "epe-acceso-fila");
      fila.appendChild(el("span", "epe-acceso-nombre", nombre));
      var boton = el("button", "epe-acceso-tecla");
      boton.type = "button";
      boton.setAttribute("data-clave", clave);
      if (editando === clave) {
        boton.classList.add("is-capturando");
        boton.textContent = "Presioná una tecla…";
      } else {
        var kbd = el("kbd", "epe-tecla", EpeTeclas.etiqueta(tecla));
        boton.appendChild(kbd);
        boton.setAttribute("aria-label", nombre + ": tecla " + EpeTeclas.etiqueta(tecla) + ". Cambiar.");
      }
      boton.addEventListener("click", function () {
        empezarCaptura(clave);
      });
      fila.appendChild(boton);
      return fila;
    }

    function dibujarTeclas() {
      elTeclas.innerHTML = "";
      if (estado.modo === "directo") {
        acciones.forEach(function (a) {
          elTeclas.appendChild(filaTecla("accion:" + a.id, a.etiqueta, estado.teclas[a.id]));
        });
      } else if (estado.modo === "manual") {
        elTeclas.appendChild(filaTecla("avanzar", "Avanzar el resaltado", estado.avanzar));
        elTeclas.appendChild(filaTecla("seleccionar", "Seleccionar", estado.seleccionar));
      } else {
        // auto: con 1 pulsador, cualquiera de las dos teclas selecciona (ver
        // entrada.js). Se muestran las dos por si hay una segunda a mano.
        elTeclas.appendChild(filaTecla("seleccionar", "Seleccionar", estado.seleccionar));
        elTeclas.appendChild(filaTecla("avanzar", "Seleccionar (alternativa)", estado.avanzar));
      }
    }

    function empezarCaptura(clave) {
      editando = clave;
      dibujarTeclas();
      enfocar(clave);
      EpeTeclas.capturar(
        function (tecla) {
          asignar(clave, tecla);
          editando = null;
          dibujarTeclas();
          enfocar(clave);
        },
        function () {
          editando = null;
          dibujarTeclas();
          enfocar(clave);
        }
      );
    }

    // Al redibujar se pierde el foco: se lo devolvemos al botón editado,
    // para que quien usa solo teclado no tenga que volver a buscarlo.
    function enfocar(clave) {
      var b = elTeclas.querySelector('[data-clave="' + clave + '"]');
      if (b) b.focus();
    }

    dibujarTeclas();
    actualizarVelocidad();

    return {
      // Configuración elegida, lista para EpeEntrada.crear().
      leer: function () {
        EpeTeclas.cancelarCaptura();
        return {
          modo: permitirBarrido ? estado.modo : "directo",
          teclas: JSON.parse(JSON.stringify(estado.teclas)),
          avanzar: estado.avanzar,
          seleccionar: estado.seleccionar,
          intervaloMs: estado.intervaloMs,
        };
      },
    };
  }

  // Texto de ayuda para mostrar durante el juego: qué tecla hace qué, según
  // el modo. Devuelve [{ tecla, texto }] (tecla ya con su etiqueta legible).
  function resumenTeclas(cfg, acciones) {
    if (cfg.modo === "directo") {
      return acciones.map(function (a) {
        return { tecla: EpeTeclas.etiqueta(cfg.teclas[a.id]), texto: a.etiqueta };
      });
    }
    if (cfg.modo === "manual") {
      return [
        { tecla: EpeTeclas.etiqueta(cfg.avanzar), texto: "avanza el resaltado" },
        { tecla: EpeTeclas.etiqueta(cfg.seleccionar), texto: "selecciona" },
      ];
    }
    return [
      {
        tecla: EpeTeclas.etiqueta(cfg.seleccionar) + " / " + EpeTeclas.etiqueta(cfg.avanzar),
        texto: "selecciona la opción resaltada",
      },
    ];
  }

  return { crearPanel: crearPanel, resumenTeclas: resumenTeclas };
})();
