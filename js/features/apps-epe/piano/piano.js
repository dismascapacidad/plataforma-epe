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

    var teclas = {}; // tecla física -> elemento <button>
    var blancas = document.createElement("div");
    blancas.className = "epe-piano-blancas";
    root.appendChild(blancas);

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
      var nota = notaPorTecla[ev.key.toLowerCase()];
      if (!nota) return;
      teclas[nota.tecla].classList.add("is-active");
      tocarNota(nota.tecla, nota.freq);
    });

    document.addEventListener("keyup", function (ev) {
      var nota = notaPorTecla[ev.key.toLowerCase()];
      if (!nota) return;
      teclas[nota.tecla].classList.remove("is-active");
      soltarNota(nota.tecla);
    });
  }

  return { init: init };
})();
