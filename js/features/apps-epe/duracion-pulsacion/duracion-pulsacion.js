/**
 * duracion-pulsacion.js
 * App EpE — "Duración de pulsación": entrena a diferenciar pulsaciones
 * cortas de largas con un solo botón/tecla (acceso por switch).
 *
 * Mecánica (confirmada con el usuario antes de implementar):
 * - 4 bloques de colores, cada uno en su carril horizontal, arrancan
 *   pegados a la izquierda.
 * - En todo momento hay un carril "objetivo": el que el JUEGO eligió al
 *   azar entre los pendientes (no el jugador) y que hay que trabajar a
 *   continuación. Se marca con un indicador fijo (ver .es-objetivo en el
 *   CSS) para que el jugador sepa hacia dónde tiene que barrer, pero no
 *   se puede accionar directo — hay que LLEGAR ahí con el barrido.
 * - Además hay un "foco" de barrido, que es el que de verdad se mueve con
 *   cada pulsación corta: recorre los carriles pendientes en orden fijo
 *   (0→1→2→3→0…), como un barrido secuencial clásico de switch-access.
 *   Ningún carril tiene el foco al arrancar la partida, ni apenas se
 *   logra un bloque — hay que volver a barrer desde el principio.
 * - Pulsación CORTA (se suelta antes del umbral configurado): avanza el
 *   foco un paso en el barrido secuencial. No mueve nada. El carril con
 *   el foco "respira" (leve pulso de escala) para que se note cuál es
 *   sin depender solo del color del borde.
 * - Pulsación LARGA (se mantiene apretado más que el umbral): SOLO mueve
 *   el bloque si el foco ya está sobre el carril objetivo — si el foco
 *   está en cualquier otro carril, la pulsación larga no hace nada (hay
 *   que seguir barriendo con cortas hasta llegar). Cuando el foco
 *   coincide con el objetivo, el bloque arranca a moverse a la derecha
 *   EN VIVO mientras se mantiene apretado. Al soltar:
 *     - Si ya está dentro de la zona objetivo → queda "logrado" (se
 *       trava ahí, centrado en la zona), el foco vuelve a "ninguno" y se
 *       sortea un nuevo carril objetivo entre los que quedan — hay que
 *       volver a barrer desde cero para llegar a él.
 *     - Si todavía no llegó → se queda parado exactamente donde soltó
 *       (NO se resetea) y el foco sigue en ese mismo carril — la próxima
 *       pulsación larga lo sigue empujando desde ahí, así que el
 *       progreso entre intentos se conserva.
 *     - Si se pasó de la zona → vuelve animado a la posición inicial, el
 *       foco sigue en ese mismo carril, y hay que arrancar de nuevo con
 *       ese bloque.
 * - Al lograr los 4 bloques: modal de felicitaciones (mismo tratamiento
 *   visual que el modal de configuración — overlay de pantalla completa,
 *   nunca visible durante el juego) con estadísticas de la ronda y la
 *   opción de jugar de nuevo en un nivel más difícil.
 *
 * La entrada es UN solo botón lógico, configurable en el modal previo
 * como tecla de teclado (con captura: "presioná una tecla para
 * asignarla") o como botón grande en pantalla (mouse/touch/switch-mouse).
 *
 * Sin librerías: la animación de movimiento es un loop de
 * requestAnimationFrame que escribe `left` directo (sin transición CSS
 * mientras se mueve, para que siga el dedo/switch 1 a 1); las
 * transiciones CSS solo se usan para los dos snaps programáticos (volver
 * al inicio, trabarse en el centro de la zona). La posición horizontal
 * se calcula con calc((100% - ANCHO_BLOQUE_PX) * pos) para que el
 * bloque nunca se salga del carril al llegar a pos=1 (ver
 * ANCHO_BLOQUE_PX — tiene que coincidir con el `width` del bloque en
 * duracion-pulsacion.css).
 *
 * Script clásico (ver theme.js). Namespace: EpeDuracionPulsacion.
 */

var EpeDuracionPulsacion = (function () {
  var COLORES = [
    { id: "rojo", nombre: "Rojo" },
    { id: "verde", nombre: "Verde" },
    { id: "azul", nombre: "Azul" },
    { id: "amarillo", nombre: "Amarillo" },
  ];

  var ZONA_INICIO = 0.6; // dónde arranca la zona objetivo, fracción de la pista libre (igual en las 4)
  var ANCHO_BLOQUE_PX = 96; // tiene que coincidir con .epe-dp-bloque { width } en el CSS
  var MARGEN_PX = 12; // aire entre el bloque y el borde del carril — tiene que coincidir con
  // .epe-dp-bloque { top/bottom/left } en el CSS, donde además
  // .epe-dp-carril { border-radius } = MARGEN_PX + .epe-dp-bloque { border-radius } para que
  // los dos redondeos queden concéntricos.
  var DURACION_SNAP_MS = 260; // duración de las transiciones programáticas (reset / traba)

  // Velocidad: fracción de la pista libre que recorre el bloque por segundo.
  // El slider de configuración va de 0 a 100 y se mapea linealmente a este
  // rango (0 = más lenta, 100 = más rápida).
  var VELOCIDAD_FRAC_MIN = 0.1;
  var VELOCIDAD_FRAC_MAX = 0.5;

  // Ancho de la zona objetivo: el slider de configuración (0 a 100) es
  // directamente "cuánto más grande que el bloque" es la zona, en %. 0% =
  // mismo ancho que el bloque (un único punto válido, dificultad máxima);
  // 100% = el doble del ancho del bloque (dificultad mínima). Ver
  // iniciarPartida() para la conversión a fracción de pista libre.
  var ANCHO_ZONA_PCT_MIN = 0;
  var ANCHO_ZONA_PCT_MAX = 100;

  var INCREMENTO_NIVEL_VELOCIDAD_PCT = 8; // cada nivel, el slider de velocidad "efectivo" sube este %
  var INCREMENTO_NIVEL_ANCHO_PCT = 10; // cada nivel, el slider de ancho "efectivo" baja este %

  var root, elConfig, elJuego, elFelicitacion;
  var elCarriles = []; // { el, bloqueEl, zonaEl }
  var elHudSeleccion, elHudLogrados, elBotonMouse;
  var elFelicitacionTexto, elFelicitacionNivel;
  var elUmbralInput, elUmbralValor;
  var elVelocidadInput, elVelocidadValor;
  var elAnchoInput, elAnchoValor;
  var elEstadisticasBoton, elEstadisticasPanel;

  var config = {
    tipoEntrada: "teclado",
    tecla: " ",
    teclaLabel: "Espacio",
    velocidadPct: 50,
    anchoZonaPct: 50,
    umbralMs: 450,
  };

  var juego = null; // null = no hay partida en curso

  // ── Configuración: captura de tecla ─────────────────────────────────

  function iniciarCapturaTecla(boton) {
    boton.textContent = "Presioná una tecla…";
    boton.classList.add("is-capturando");

    function onKey(ev) {
      ev.preventDefault();
      document.removeEventListener("keydown", onKey, true);
      boton.classList.remove("is-capturando");
      config.tecla = ev.key;
      config.teclaLabel = etiquetaTecla(ev.key);
      boton.textContent = config.teclaLabel;
    }
    document.addEventListener("keydown", onKey, true);
  }

  function etiquetaTecla(key) {
    if (key === " ") return "Espacio";
    if (key.length === 1) return key.toUpperCase();
    return key; // "Enter", "ArrowLeft", etc.
  }

  // ── Ciclo de una partida ─────────────────────────────────────────────

  function colorAleatorioPorCarril() {
    var colores = COLORES.slice();
    for (var i = colores.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = colores[i];
      colores[i] = colores[j];
      colores[j] = tmp;
    }
    return colores;
  }

  function iniciarPartida(nivel) {
    var colores = colorAleatorioPorCarril();

    // Cada nivel sube la velocidad y baja el ancho de zona "efectivos",
    // siempre dentro del rango 0-100 del slider correspondiente.
    var velocidadPct = Math.min(100, config.velocidadPct + INCREMENTO_NIVEL_VELOCIDAD_PCT * (nivel - 1));
    var anchoPct = Math.max(ANCHO_ZONA_PCT_MIN, config.anchoZonaPct - INCREMENTO_NIVEL_ANCHO_PCT * (nivel - 1));

    var velocidad = VELOCIDAD_FRAC_MIN + ((VELOCIDAD_FRAC_MAX - VELOCIDAD_FRAC_MIN) * velocidadPct) / 100;

    // El slider de ancho define un tamaño de zona en PX relativo al bloque
    // (96px a 192px), no una fracción — así "0%"/"100%" significan lo
    // mismo sea cual sea el ancho real del carril en pantalla. Para poder
    // seguir usando fracciones de pista libre en el resto del juego (igual
    // que la posición del bloque), la convertimos acá, midiendo el carril
    // ya visible (elJuego se muestra antes, más abajo, de que se lea el
    // offsetWidth).
    elJuego.hidden = false;
    var carrilPx = elCarriles[0].el.offsetWidth;
    var pistaPx = Math.max(1, carrilPx - (2 * MARGEN_PX + ANCHO_BLOQUE_PX));
    var zonaAnchoPx = ANCHO_BLOQUE_PX * (1 + anchoPct / 100);
    var zonaAncho = Math.max(0, (zonaAnchoPx - ANCHO_BLOQUE_PX) / pistaPx);
    var zonaInicio = Math.max(0, Math.min(ZONA_INICIO, 1 - zonaAncho));

    juego = {
      nivel: nivel,
      velocidad: velocidad,
      anchoPct: anchoPct,
      zonaInicio: zonaInicio,
      zonaAncho: zonaAncho,
      umbralMs: config.umbralMs,
      bloques: colores.map(function (color) {
        return { color: color, pos: 0, lograda: false };
      }),
      foco: null, // ningún carril tiene el foco del barrido al arrancar
      objetivo: null, // se sortea unas líneas más abajo, ya con `juego` armado
      presionando: false,
      moviendo: false,
      animandoSnap: false,
      holdTimeoutId: null,
      rafId: null,
      tUltimoFrame: 0,
      logrados: 0,
      intentos: 0, // cuenta pulsaciones largas, sea cual sea el resultado
      inicioMs: performance.now(),
    };

    elCarriles.forEach(function (carril, idx) {
      var bloque = juego.bloques[idx];
      carril.el.className = "epe-dp-carril";
      carril.bloqueEl.className = "epe-dp-bloque epe-dp-bloque-" + bloque.color.id;
      carril.bloqueEl.textContent = bloque.color.nombre;
      carril.bloqueEl.style.transition = "none";
      carril.bloqueEl.style.left = MARGEN_PX + "px";
      // La zona objetivo se marca en la misma "pista libre" que recorre el
      // bloque (ver pistaLibreCss) y se agranda ANCHO_BLOQUE_PX para
      // mostrar toda el área donde el bloque queda "dentro" — no solo el
      // punto donde arranca su borde izquierdo.
      carril.zonaEl.style.left = "calc(" + MARGEN_PX + "px + " + pistaLibreCss() + " * " + juego.zonaInicio + ")";
      carril.zonaEl.style.width =
        "calc(" + pistaLibreCss() + " * " + juego.zonaAncho + " + " + ANCHO_BLOQUE_PX + "px)";
    });

    elEstadisticasPanel.hidden = true;
    elEstadisticasPanel.innerHTML = "";

    sortearObjetivo();
    marcarFocoVisual();
    marcarObjetivoVisual();
    actualizarHud();

    elConfig.hidden = true;
    elFelicitacion.hidden = true;
  }

  // ── Objetivo (lo elige el juego) y foco (lo mueve el barrido) ───────

  function indicesPendientes() {
    var lista = [];
    juego.bloques.forEach(function (b, idx) {
      if (!b.lograda) lista.push(idx);
    });
    return lista;
  }

  // El JUEGO sortea cuál carril hay que trabajar a continuación — el
  // jugador no lo elige, solo lo alcanza barriendo con pulsaciones
  // cortas (ver avanzarFoco). Se llama al arrancar la partida y cada vez
  // que se logra un bloque.
  function sortearObjetivo() {
    var pendientes = indicesPendientes();
    juego.objetivo = pendientes.length === 0 ? null : pendientes[Math.floor(Math.random() * pendientes.length)];
  }

  // Ya no hay un badge aparte para marcar el objetivo: directamente se
  // tiñen SU zona objetivo (la franja donde hay que soltar) Y su borde
  // con el mismo tono que el bloque de ese carril, vía la variable CSS
  // --zona-tono (seteada en el carril, no en la zona, para que herede
  // tanto el borde del carril como el fondo de su franja — ver
  // .epe-dp-carril.es-objetivo y .epe-dp-zona en el CSS). El resto de
  // los carriles queda con su franja gris neutra: si por defecto fuera
  // verde en los 4, no se distinguiría cuál es el objetivo de verdad.
  function marcarObjetivoVisual() {
    elCarriles.forEach(function (carril, idx) {
      if (idx === juego.objetivo) {
        carril.el.classList.add("es-objetivo");
        carril.el.style.setProperty("--zona-tono", "var(--dp-tono-" + juego.bloques[idx].color.id + ")");
      } else {
        carril.el.classList.remove("es-objetivo");
        carril.el.style.removeProperty("--zona-tono");
      }
    });
  }

  function marcarFocoVisual() {
    elCarriles.forEach(function (carril, idx) {
      carril.el.classList.toggle("is-seleccionado", idx === juego.foco);
    });
  }

  // Barrido secuencial clásico: avanza el foco un paso, en orden fijo de
  // carril (0→1→2→3→0…) — SIN saltear los ya logrados, para que el
  // barrido siga siendo parejo y predecible aunque ya se haya ubicado
  // algún bloque (un carril logrado se puede seguir "pasando" con el
  // foco, simplemente no va a coincidir nunca con el objetivo). Es la
  // ÚNICA forma de mover el foco — la pulsación larga nunca elige, solo
  // actúa si el foco ya coincide con el objetivo (ver onPresionar).
  function avanzarFoco() {
    var total = elCarriles.length;
    var actual = juego.foco === null ? -1 : juego.foco;
    juego.foco = (actual + 1) % total;
    marcarFocoVisual();
    actualizarHud();
  }

  // ── Movimiento (pulsación larga) ─────────────────────────────────────
  // `left` se calcula en calc() para que el bloque nunca se salga del
  // carril: a pos=0 el borde izquierdo está en 0, a pos=1 el borde
  // DERECHO llega justo al borde del carril (no el izquierdo, que sería
  // lo que pasaría con un simple `left: pos*100%` y dejaría medio bloque
  // colgando afuera).

  // "Pista libre": el ancho del carril menos el margen de los dos lados y
  // el ancho del bloque — es el recorrido real que tiene el borde
  // izquierdo del bloque entre pos=0 (pegado al margen izquierdo) y
  // pos=1 (pegado al margen derecho).
  function pistaLibreCss() {
    return "(100% - " + (2 * MARGEN_PX + ANCHO_BLOQUE_PX) + "px)";
  }

  function aplicarPosicionBloque(idx, conTransicion) {
    var carril = elCarriles[idx];
    var bloque = juego.bloques[idx];
    carril.bloqueEl.style.transition = conTransicion ? "left " + DURACION_SNAP_MS + "ms ease" : "none";
    carril.bloqueEl.style.left = "calc(" + MARGEN_PX + "px + " + pistaLibreCss() + " * " + bloque.pos + ")";
  }

  function iniciarMovimiento() {
    juego.moviendo = true;
    juego.intentos++;
    elCarriles[juego.foco].el.classList.add("en-movimiento");
    juego.tUltimoFrame = performance.now();
    juego.rafId = window.requestAnimationFrame(pasoMovimiento);
  }

  function pasoMovimiento(t) {
    if (!juego || !juego.moviendo) return;
    var dt = (t - juego.tUltimoFrame) / 1000;
    juego.tUltimoFrame = t;

    var bloque = juego.bloques[juego.foco];
    bloque.pos = Math.min(1, bloque.pos + juego.velocidad * dt);
    aplicarPosicionBloque(juego.foco, false);

    if (bloque.pos < 1) {
      juego.rafId = window.requestAnimationFrame(pasoMovimiento);
    } else {
      juego.rafId = null; // llegó al tope del carril; espera que suelten (queda ahí)
    }
  }

  function detenerMovimiento() {
    juego.moviendo = false;
    if (juego.rafId) window.cancelAnimationFrame(juego.rafId);
    juego.rafId = null;

    var idx = juego.foco;
    var carril = elCarriles[idx];
    var bloque = juego.bloques[idx];
    carril.el.classList.remove("en-movimiento");

    var zonaFin = juego.zonaInicio + juego.zonaAncho;

    if (bloque.pos >= juego.zonaInicio && bloque.pos <= zonaFin) {
      bloque.pos = juego.zonaInicio + juego.zonaAncho / 2;
      bloque.lograda = true;
      juego.logrados++;
      carril.el.classList.add("is-logrado");
      aplicarPosicionBloque(idx, true);

      if (juego.logrados === 4) {
        juego.foco = null;
        juego.objetivo = null;
        marcarFocoVisual();
        marcarObjetivoVisual();
        actualizarHud();
        window.setTimeout(mostrarFelicitacion, DURACION_SNAP_MS + 120);
        return;
      }
      // Vuelve a "ningún carril con foco" y se sortea un nuevo objetivo
      // entre los pendientes — hay que barrer desde cero para llegar.
      juego.foco = null;
      sortearObjetivo();
      marcarFocoVisual();
      marcarObjetivoVisual();
    } else if (bloque.pos > zonaFin) {
      juego.animandoSnap = true;
      bloque.pos = 0;
      aplicarPosicionBloque(idx, true);
      window.setTimeout(function () {
        if (juego) juego.animandoSnap = false;
      }, DURACION_SNAP_MS);
    }
    // si quedó corto (bloque.pos < zonaInicio): no se toca, se queda ahí.

    actualizarHud();
  }

  function actualizarHud() {
    if (juego.foco !== null && juego.foco === juego.objetivo) {
      elHudSeleccion.textContent = "¡Llegaste! Mantené apretado para mover el bloque";
    } else {
      elHudSeleccion.textContent = "Pulsación corta para barrer hasta el carril marcado";
    }
    elHudLogrados.textContent = "Logrados: " + juego.logrados + " / 4";
  }

  // ── Entrada: un solo botón lógico (presionar / soltar) ──────────────
  // Ignora todo si el juego no está visible (modal de config o de
  // felicitación abiertos) — así no queda "flotando" una pulsación
  // larga a medio hacer si el jugador toca el botón justo cuando
  // termina la ronda.

  function juegoActivo() {
    return juego && elJuego && !elJuego.hidden;
  }

  function onPresionar() {
    if (!juegoActivo() || juego.animandoSnap || juego.presionando) return;
    juego.presionando = true;
    juego.holdTimeoutId = window.setTimeout(function () {
      // La pulsación larga SOLO mueve algo si el foco ya está sobre el
      // carril objetivo (ver avanzarFoco/sortearObjetivo). Si el foco
      // está en otro carril, o no hay foco, no pasa nada: el botón sigue
      // "presionado" igual, y al soltar cuenta como pulsación corta
      // (avanza el barrido) porque juego.moviendo nunca se puso en true.
      if (juego && juego.presionando && juego.foco !== null && juego.foco === juego.objetivo) {
        iniciarMovimiento();
      }
    }, juego.umbralMs);
  }

  function onSoltar() {
    if (!juegoActivo() || !juego.presionando) return;
    juego.presionando = false;
    window.clearTimeout(juego.holdTimeoutId);

    if (juego.moviendo) {
      detenerMovimiento();
    } else {
      // No se movió nada (foco todavía no coincide con el objetivo, o no
      // había foco): cuenta como pulsación corta, avanza un paso el
      // barrido secuencial.
      avanzarFoco();
    }
  }

  function onKeydown(ev) {
    if (ev.repeat) return;
    if (config.tipoEntrada !== "teclado") return;
    if (ev.key !== config.tecla) return;
    ev.preventDefault();
    onPresionar();
  }

  function onKeyup(ev) {
    if (config.tipoEntrada !== "teclado") return;
    if (ev.key !== config.tecla) return;
    ev.preventDefault();
    onSoltar();
  }

  // ── Felicitación / estadísticas / siguiente nivel ────────────────────

  function formatearDuracion(ms) {
    var segundos = Math.round(ms / 1000);
    if (segundos < 60) return segundos + "s";
    var minutos = Math.floor(segundos / 60);
    var resto = segundos % 60;
    return minutos + "m " + resto + "s";
  }

  function calcularEstadisticas() {
    var duracionMs = performance.now() - juego.inicioMs;
    var precision = Math.round((4 / juego.intentos) * 100);
    var textoZona = "El área objetivo es " + Math.round(juego.anchoPct) + "% más grande que el bloque.";

    return {
      tiempoTexto: formatearDuracion(duracionMs),
      precisionTexto: precision + "% (" + juego.intentos + " pulsaciones largas para 4 bloques)",
      velocidadTexto: Math.round(juego.velocidad * 100) + "% del carril por segundo",
      zonaTexto: textoZona,
    };
  }

  function mostrarFelicitacion() {
    elFelicitacionNivel.textContent = "Nivel " + juego.nivel + " completo";
    elFelicitacionTexto.textContent = "Lograste los 4 bloques en " + juego.intentos + " pulsaciones largas.";
    elEstadisticasPanel.hidden = true;
    elEstadisticasPanel.innerHTML = "";
    elEstadisticasBoton.textContent = "Ver estadísticas";

    elJuego.hidden = true;
    elFelicitacion.hidden = false;
  }

  function alternarEstadisticas() {
    if (!elEstadisticasPanel.hidden) {
      elEstadisticasPanel.hidden = true;
      elEstadisticasBoton.textContent = "Ver estadísticas";
      return;
    }
    var stats = calcularEstadisticas();
    elEstadisticasPanel.innerHTML = "";
    [
      ["Tiempo de juego", stats.tiempoTexto],
      ["Precisión de colocación", stats.precisionTexto],
      ["Velocidad de desplazamiento", stats.velocidadTexto],
      ["Área objetivo vs. bloque", stats.zonaTexto],
    ].forEach(function (par) {
      var fila = document.createElement("div");
      fila.className = "epe-dp-stat";
      var etiqueta = document.createElement("span");
      etiqueta.className = "epe-dp-stat-etiqueta";
      etiqueta.textContent = par[0];
      var valor = document.createElement("span");
      valor.className = "epe-dp-stat-valor";
      valor.textContent = par[1];
      fila.appendChild(etiqueta);
      fila.appendChild(valor);
      elEstadisticasPanel.appendChild(fila);
    });
    elEstadisticasPanel.hidden = false;
    elEstadisticasBoton.textContent = "Ocultar estadísticas";
  }

  // ── Configuración: mostrar/ocultar opciones según tipo de entrada ──

  function actualizarVisibilidadEntrada() {
    var esTeclado = root.querySelector('input[name="dp-entrada"]:checked').value === "teclado";
    root.querySelector("[data-dp-tecla-wrap]").hidden = !esTeclado;
  }

  function leerConfigDesdeForm() {
    config.tipoEntrada = root.querySelector('input[name="dp-entrada"]:checked').value;
    config.velocidadPct = parseInt(elVelocidadInput.value, 10);
    config.anchoZonaPct = parseInt(elAnchoInput.value, 10);
    config.umbralMs = parseInt(elUmbralInput.value, 10);
  }

  function init(rootEl) {
    root = rootEl;
    if (!root) return;

    elConfig = root.querySelector("[data-dp-config]");
    elJuego = root.querySelector("[data-dp-juego]");
    elFelicitacion = root.querySelector("[data-dp-felicitacion]");
    elHudSeleccion = root.querySelector("[data-dp-hud-seleccion]");
    elHudLogrados = root.querySelector("[data-dp-hud-logrados]");
    elBotonMouse = root.querySelector("[data-dp-boton-mouse]");
    elFelicitacionTexto = root.querySelector("[data-dp-felicitacion-texto]");
    elFelicitacionNivel = root.querySelector("[data-dp-felicitacion-nivel]");
    elUmbralInput = root.querySelector("[data-dp-umbral]");
    elUmbralValor = root.querySelector("[data-dp-umbral-valor]");
    elVelocidadInput = root.querySelector("[data-dp-velocidad]");
    elVelocidadValor = root.querySelector("[data-dp-velocidad-valor]");
    elAnchoInput = root.querySelector("[data-dp-ancho]");
    elAnchoValor = root.querySelector("[data-dp-ancho-valor]");
    elEstadisticasBoton = root.querySelector("[data-dp-estadisticas-boton]");
    elEstadisticasPanel = root.querySelector("[data-dp-estadisticas-panel]");

    root.querySelectorAll("[data-dp-carril]").forEach(function (el) {
      elCarriles.push({
        el: el,
        bloqueEl: el.querySelector("[data-dp-bloque]"),
        zonaEl: el.querySelector("[data-dp-zona]"),
      });
    });

    var botonCapturar = root.querySelector("[data-dp-capturar-tecla]");
    botonCapturar.textContent = config.teclaLabel;
    botonCapturar.addEventListener("click", function () {
      iniciarCapturaTecla(botonCapturar);
    });

    root.querySelectorAll('input[name="dp-entrada"]').forEach(function (radio) {
      radio.addEventListener("change", actualizarVisibilidadEntrada);
    });
    actualizarVisibilidadEntrada();

    elUmbralInput.addEventListener("input", function () {
      elUmbralValor.textContent = elUmbralInput.value + " ms";
    });
    elUmbralValor.textContent = elUmbralInput.value + " ms";

    elVelocidadInput.addEventListener("input", function () {
      elVelocidadValor.textContent = elVelocidadInput.value + "%";
    });
    elVelocidadValor.textContent = elVelocidadInput.value + "%";

    elAnchoInput.addEventListener("input", function () {
      elAnchoValor.textContent = elAnchoInput.value + "%";
    });
    elAnchoValor.textContent = elAnchoInput.value + "%";

    root.querySelector("[data-dp-empezar]").addEventListener("click", function () {
      leerConfigDesdeForm();
      elBotonMouse.hidden = config.tipoEntrada !== "mouse";
      iniciarPartida(1);
    });

    root.querySelector("[data-dp-siguiente-nivel]").addEventListener("click", function () {
      var proximoNivel = juego ? juego.nivel + 1 : 1;
      iniciarPartida(proximoNivel);
    });

    elEstadisticasBoton.addEventListener("click", alternarEstadisticas);

    document.addEventListener("keydown", onKeydown);
    document.addEventListener("keyup", onKeyup);

    elBotonMouse.addEventListener("pointerdown", onPresionar);
    elBotonMouse.addEventListener("pointerup", onSoltar);
    elBotonMouse.addEventListener("pointerleave", onSoltar);
    elBotonMouse.addEventListener("pointercancel", onSoltar);
  }

  return { init: init };
})();
