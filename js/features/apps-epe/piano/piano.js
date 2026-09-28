/**
 * piano.js
 * App EpE — Piano de 7 notas (Do a Si, una octava natural) accesible por
 * teclado o puntero (mouse, switch-mouse tipo disMouse). Cada nota es una
 * tecla física adyacente en la fila home (a s d f g h j) — no letras
 * salteadas, a propósito: para acceso por switch conviene que las teclas
 * activas estén físicamente juntas, así se recorren con un solo dedo o un
 * puntero adaptado.
 *
 * Las teclas negras (semitonos) son solo decorativas — no suenan ni
 * responden a nada — para que se vea más parecido a un piano real; sonido
 * real solo en las 7 teclas blancas.
 *
 * Sonido con Web Audio (osciladores) — sin archivos de audio: no depende
 * de assets, funciona offline y no pesa.
 *
 * Mismo esquema que el resto de las Apps EpE: modal de configuración
 * primero (acá, solo el dispositivo — las 7 teclas son fijas), después el
 * juego (el teclado). Con el juego iniciado, Escape vuelve a abrir la
 * configuración sin perder nada — mismo criterio que Vincular Imagen,
 * porque acá tampoco hay una "partida" que termine.
 *
 * Script clásico (ver theme.js). Namespace: EpePiano.
 */

var EpePiano = (function () {
  var NOTAS = [
    { tecla: "a", nombre: "Do", freq: 261.63 },
    { tecla: "s", nombre: "Re", freq: 293.66 },
    { tecla: "d", nombre: "Mi", freq: 329.63 },
    { tecla: "f", nombre: "Fa", freq: 349.23 },
    { tecla: "g", nombre: "Sol", freq: 392.0 },
    { tecla: "h", nombre: "La", freq: 440.0 },
    { tecla: "j", nombre: "Si", freq: 493.88 },
  ];

  // Semitonos decorativos: van después del índice de tecla blanca que
  // indica (0=Do, 1=Re, ...). Mi-Fa y Si-Do no tienen negra entre medio,
  // igual que en un piano real.
  var SEMITONOS_DESPUES_DE = [0, 1, 3, 4, 5];

  var audioCtx = null;
  var vocesActivas = {}; // tecla -> { osc, gain }

  function getAudioCtx() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
    // Los navegadores suspenden el audio hasta el primer gesto del usuario.
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tocarNota(tecla, freq) {
    if (vocesActivas[tecla]) return; // ya sonando, no duplicar (auto-repeat de tecla)

    var ctx = getAudioCtx();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    vocesActivas[tecla] = { osc: osc, gain: gain };
  }

  function soltarNota(tecla) {
    var voz = vocesActivas[tecla];
    if (!voz) return;
    var ctx = getAudioCtx();

    // Fade-out corto en vez de cortar seco: evita el "click" audible.
    voz.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
    voz.osc.stop(ctx.currentTime + 0.1);

    delete vocesActivas[tecla];
  }

  function init(root) {
    if (!root) return;

    var elTeclado = root.querySelector("[data-piano-teclado]") || root;
    var elConfig = root.querySelector("[data-piano-config]");
    var btnEmpezar = root.querySelector("[data-piano-empezar]");
    var btnConfigurarDispositivo = root.querySelector("[data-configurar-dispositivo]");
    var btnRestaurarDispositivo = root.querySelector("[data-restaurar-dispositivo]");
    var enlacesVolverApps = Array.prototype.slice.call(root.querySelectorAll("[data-volver-apps]"));
    var restaurarDispositivo = null; // función pendiente para devolver el dispositivo a como estaba
    var iniciado = false; // true después del primer "Empezar"

    var teclas = {}; // tecla física -> elemento <button>
    var blancas = document.createElement("div");
    blancas.className = "epe-piano-blancas";
    elTeclado.appendChild(blancas);

    NOTAS.forEach(function (nota, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "epe-piano-tecla";
      btn.setAttribute("data-tecla", nota.tecla);

      var nombre = document.createElement("span");
      nombre.className = "epe-piano-tecla-nombre";
      nombre.textContent = nota.nombre;

      var letra = document.createElement("span");
      letra.className = "epe-piano-tecla-letra";
      letra.textContent = nota.tecla.toUpperCase();

      btn.appendChild(nombre);
      btn.appendChild(letra);
      blancas.appendChild(btn);
      teclas[nota.tecla] = btn;

      // Puntero (mouse, touch, switch-mouse): mismo comportamiento que el teclado.
      btn.addEventListener("pointerdown", function () {
        btn.classList.add("is-active");
        tocarNota(nota.tecla, nota.freq);
      });
      var soltar = function () {
        btn.classList.remove("is-active");
        soltarNota(nota.tecla);
      };
      btn.addEventListener("pointerup", soltar);
      btn.addEventListener("pointerleave", soltar);

      // Tecla negra decorativa después de esta blanca, si corresponde.
      // pointer-events: none — no interactúa, es puramente visual; un
      // click en esa zona le llega a la tecla blanca de abajo.
      if (SEMITONOS_DESPUES_DE.indexOf(idx) !== -1) {
        var negra = document.createElement("div");
        negra.className = "epe-piano-tecla-negra";
        negra.style.left = ((idx + 1) / NOTAS.length) * 100 + "%";
        negra.setAttribute("aria-hidden", "true");
        blancas.appendChild(negra);
      }
    });

    var notaPorTecla = {};
    NOTAS.forEach(function (n) {
      notaPorTecla[n.tecla] = n;
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.repeat) return; // no re-disparar mientras se mantiene apretada
      var tecla = ev.key.toLowerCase();

      if (tecla === "escape") {
        if (iniciado && elConfig.hidden) volverAConfig();
        return;
      }

      // Mientras la configuración está abierta (al arrancar, o reabierta con
      // Escape) las teclas no tocan notas — si no, una pulsación mientras se
      // está configurando el dispositivo tocaría una nota sin querer.
      if (!elConfig.hidden) return;

      var nota = notaPorTecla[tecla];
      if (!nota) return;
      teclas[nota.tecla].classList.add("is-active");
      tocarNota(nota.tecla, nota.freq);
    });

    document.addEventListener("keyup", function (ev) {
      if (!elConfig.hidden) return;
      var nota = notaPorTecla[ev.key.toLowerCase()];
      if (!nota) return;
      teclas[nota.tecla].classList.remove("is-active");
      soltarNota(nota.tecla);
    });

    // ── Configuración ↔ juego ───────────────────────────────────────────
    function empezar() {
      iniciado = true;
      elConfig.hidden = true;
      elTeclado.hidden = false;
    }

    function volverAConfig() {
      elTeclado.hidden = true;
      elConfig.hidden = false;
    }

    // ── Configurar dispositivo físico ─────────────────────────────────
    // Las 7 notas son fijas (A S D F G H J): se le pasan directo al widget,
    // sin panel de reasignación.
    function entradasDispositivo() {
      return NOTAS.map(function (n) {
        return { id: n.tecla, etiqueta: n.nombre, tecla: n.tecla };
      });
    }

    function configurarDispositivo() {
      if (!window.EpeConfigurarDispositivo) return; // widget.js no cargó
      window.EpeConfigurarDispositivo
        .abrir(entradasDispositivo(), { titulo: "Configurar dispositivo — Piano" })
        .then(function (resultado) {
          if (resultado && resultado.restaurar) restaurarDispositivo = resultado.restaurar;
          actualizarBotonRestaurar();
          // El usuario ya apretó "Empezar" dentro del propio modal: arrancamos
          // directo, sin pedirle un segundo click acá.
          if (resultado && resultado.continuar) empezar();
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
    // restaurar el dispositivo si quedó algo pendiente. `luegoSalir` es lo
    // que hay que hacer una vez que es seguro seguir.
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

    if (btnEmpezar) {
      btnEmpezar.addEventListener("click", empezar);
    }
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
  }

  return { init: init };
})();
