/**
 * simoneuro.js
 * App EpE — SimoNeuro. "Simón dice" con 4 colores: se reproduce una
 * secuencia que crece de a uno (luz y, según el modo, voz) y hay que
 * repetirla tocando los mismos 4 bloques en el mismo orden. Funcionalmente
 * es una prueba de amplitud de secuencia (span task, misma familia que el
 * Corsi block-tapping test o el digit span): se la alarga hasta que el
 * desempeño falla, y el largo máximo alcanzado es el dato clínico.
 *
 * Modos (ver selector en simoneuro.html):
 * - "visual": solo se ilumina.
 * - "visual-auditivo": se ilumina Y se dice el nombre del color (refuerzo
 *   congruente, no es un desafío de inhibición).
 * - "inhibir-visual": se ilumina un color MIENTRAS se dice OTRO (siempre
 *   distinto); hay que repetir lo que se ESCUCHÓ, ignorando lo que se vio.
 * - "inhibir-auditivo": mismo conflicto; hay que repetir lo que se VIO,
 *   ignorando lo que se escuchó.
 * Los dos últimos son un Stroop cruzado entre modalidades (audiovisual) —
 * misma familia de tarea que ya hace Stroop con texto, pero entre dos
 * sentidos en vez de uno.
 *
 * Reglas de la partida (decisión del 06/10/2026, ver doc del proyecto):
 * un error NUNCA termina la partida — se indica cuál era el color
 * correcto (se enciende con un marco verde; el que se apretó mal queda con
 * marco rojo) y se sigue como si se hubiera respondido bien: la secuencia
 * siempre crece en 1 después de cada ronda, tenga o no errores. El modo de
 * finalización "por cantidad de errores" es lo que permite medir la
 * amplitud alcanzada (se corta al juntar N errores y se informa el largo
 * de secuencia logrado), igual criterio que un span test clásico.
 *
 * Módulo ES (no script clásico como Hanói/N-back/Stroop) porque necesita
 * importar el motor de voz compartido (`_comun/voz-web.js`). EpeAcceso,
 * EpeEntrada y EpeTeclas siguen siendo globales clásicos (`window.X`),
 * perfectamente legibles desde acá. Namespace expuesto: EpeSimon — pero
 * como un <script> clásico posterior correría ANTES de que este módulo
 * termine de cargar (los módulos se ejecutan diferidos), este archivo se
 * inicializa a sí mismo al final en vez de esperar una llamada externa
 * (ver el comentario en simoneuro.html).
 *
 * Los colores no están acá: el JS solo maneja ids ("naranja", …) y el CSS
 * decide el tono (css/features/apps-epe/simoneuro.css + --simon-* en
 * tokens.css).
 *
 * Preparación (06/10/2026): la duración del estímulo (0.5-2s, default 1s)
 * y la aceleración por ronda son configurables en el modal (ver
 * factorAceleracion()/duracionLuzRonda()/pausaEntreItemsRonda()). En los
 * modos con voz, la locución arranca a velocidad normal (rate 1) y, si la
 * aceleración está activada, se acelera en la MISMA proporción que la luz
 * (ver velocidadVoz()) — nada de medir ni adivinar duraciones: un intento
 * previo que ajustaba el rate para que la voz durara lo mismo que la luz
 * (estimando por cantidad de caracteres y luego "aprendiendo" de la
 * duración real) resultó poco confiable en la práctica — distintas voces
 * no escalan su duración de forma proporcional al rate, así que la
 * primera vez sonaba notablemente lenta y, apenas medía, rebotaba a
 * `rapidísimo`; Gon lo descartó por eso.
 *
 * 07/10/2026, probado y revertido el mismo día: se probó que el ritmo de
 * la secuencia lo marcara SOLO la luz, sin esperar a que la voz termine,
 * para que el tiempo muerto entre colores no variara según el largo de la
 * palabra. Gon lo jugó en el dispositivo real y la voz quedaba cortada a
 * mitad de palabra con demasiada frecuencia — peor que el problema
 * original (ver el motivo técnico exacto, confirmado leyendo voz-web.js,
 * en el comentario de hablarColor() más abajo). Se volvió a esperar el
 * evento `onend` de la voz (Promise.all([luz, voz]), como antes de ese
 * intento) y, para compensar, se agregó un tope de aceleración más bajo
 * específico para los modos con voz (PORCENTAJE_ACEL_MAX_AUDIO): así la
 * voz no tiene que perseguir una luz que se acelera mucho más rápido de
 * lo que ella puede (ver VELOCIDAD_VOZ_MAX) — menos aceleración donde hay
 * voz, en vez de arriesgarse a cortarla.
 */
import { elegirVoz } from '../_comun/voz.js';
import { crearVoz } from '../_comun/voz-web.js';

const COLORES = [
  { id: 'naranja', etiqueta: 'Naranja', tecla: 'q' },
  { id: 'celeste', etiqueta: 'Celeste', tecla: 'p' },
  { id: 'rojo', etiqueta: 'Rojo', tecla: 'a' },
  { id: 'azul', etiqueta: 'Azul', tecla: 'l' },
];

const ACCIONES = COLORES.map((c) => ({ id: c.id, etiqueta: c.etiqueta, tecla: c.tecla }));

const LARGO_INICIAL = 1;
const MAX_SEGUIDOS_MISMO_COLOR = 2; // variedad perceptual: nunca 3 veces seguidas el mismo color
const DURACION_ESTIMULO_DEFAULT_MS = 1000; // configurable en el modal, ver slider "Duración del estímulo"
const DURACION_ESTIMULO_MIN_S = 0.5;
const DURACION_ESTIMULO_MAX_S = 2;
const PAUSA_ENTRE_ITEMS_MS = 250; // mismo valor que usa el protocolo Corsi de referencia (ISI)
// 07/10/2026: Gon reportó la app "poco fluida" y que la aceleración "no se
// evidencia". Investigando el protocolo clínico de referencia (Corsi
// block-tapping test) encontré que NO usa ninguna demora antes de habilitar
// la respuesta: señala el turno del jugador con un beep inmediatamente
// después del último estímulo, no con una pausa muerta — de ahí que
// PAUSA_ANTES_RESPUESTA_MS baje de 350 a 100 (ver BEEP_TURNO_* más abajo
// para la señal sonora). FEEDBACK_MS y PAUSA_ENTRE_RONDAS_MS también
// bajaron (eran, sumadas, ~1.45s de pausas FIJAS por ronda que no se
// acortaban nunca aunque la luz sí se acelerara — con eso de fondo, una luz
// que pasa de 1000ms a 500ms es imperceptible). Valores dentro del rango
// que recomiendan las guías de timing de UI (100ms-1s para que el feedback
// se sienta conectado a la acción, 200-300ms para algo "chico").
const PAUSA_ANTES_RESPUESTA_MS = 100; // antes 350
const FEEDBACK_MS = 300; // antes 500
const PAUSA_ENTRE_RONDAS_MS = 350; // antes 600
const CLAVE_CONFIG = 'epe-simon-config';

// Aceleración de la secuencia (configurable, ver checkbox + slider en el
// modal): cada ronda, la duración del estímulo y la pausa entre ítems se
// multiplican por (1 - porcentaje/100) elevado al número de rondas ya
// jugadas — la ronda 1 siempre se juega a la duración base, sin acelerar
// todavía. Los pisos evitan que, en secuencias largas, la aceleración
// compuesta llegue a un punto imperceptible o injugable.
//
// 07/10/2026: FEEDBACK_MS y PAUSA_ENTRE_RONDAS_MS ahora se multiplican por
// este MISMO factor (ver feedbackMsRonda()/pausaEntreRondasMsRonda() más
// abajo) — si no, esas dos pausas fijas quedaban igual de largas por más
// que la luz se acelerara, y la aceleración no se notaba en el ritmo
// general de la partida (motivo del reporte de Gon).
const PORCENTAJE_ACEL_MIN = 10;
const PORCENTAJE_ACEL_MAX = 50;
// 07/10/2026: en los modos con voz, el deslizante no deja pasar de este
// valor (ver actualizarTopeAceleracion()) — más bajo que el tope del modo
// "visual" (50%). Motivo: la voz tiene su propio techo de velocidad
// (VELOCIDAD_VOZ_MAX = 1.8) y, si se la deja acelerar tanto como a la luz,
// ese techo se alcanza casi de inmediato (ronda 2) y la voz queda muy por
// detrás de una luz que se sigue acelerando — un desfase grande entre
// cuánto dura la luz y cuánto tarda la voz en decir el color es,
// justamente, lo que hacía más probable que una palabra quedara cortada
// por la del siguiente color (ver hablarColor()). Con un tope más bajo la
// luz y la voz se mantienen más parejas por más rondas.
const PORCENTAJE_ACEL_MAX_AUDIO = 20;
const DURACION_LUZ_MIN_MS = 150;
const PAUSA_ENTRE_ITEMS_MIN_MS = 80;
const FEEDBACK_MIN_MS = 150;
const PAUSA_ENTRE_RONDAS_MIN_MS = 150;

// Velocidad de la voz: arranca normal (rate 1) y, si la aceleración de la
// secuencia está activada, se acelera en la MISMA proporción que la luz y
// la pausa entre ítems (ver velocidadVoz()/factorAceleracion()) — no se
// mide ni se estima nada. Límites para que la voz nunca quede inintelible
// (muy rápida) ni absurdamente lenta.
const VELOCIDAD_VOZ_MIN = 0.6;
const VELOCIDAD_VOZ_MAX = 1.8;
// Red de seguridad de hablarColor(): si por algún motivo la voz nunca avisa
// que terminó (bug conocido de algunos navegadores, o una voz "online" que
// no responde), no se traba la partida esperando para siempre. 2.5s es
// bastante más que lo que tarda cualquier nombre de color, incluso lento.
const MAX_ESPERA_VOZ_MS = 2500;

// Cuenta regresiva SOLO al empezar la partida (no antes de cada ronda, ver
// reproducirRonda()). Dura 600ms por dígito + 600ms de pausa antes de
// arrancar la secuencia.
const CUENTA_REGRESIVA_DESDE = 3;
const DURACION_DIGITO_MS = 600;
const PAUSA_POST_CUENTA_MS = 600;

// Un tono distinto por color (como el Simon original) para sumar una pista
// de memoria extra en el modo sin voz ("visual"). Valores arbitrarios,
// elegidos solo para quedar bien diferenciados entre sí al oído.
const FRECUENCIAS = {
  naranja: 440.0, // A4
  celeste: 554.37, // C#5
  rojo: 329.63, // E4
  azul: 220.0, // A3
};

// Beep de "Tu turno" (07/10/2026, pedido de Gon inspirado en el protocolo
// Corsi: señala el cambio de turno con una señal sonora inmediata, en vez
// de depender de una pausa). Tono agudo y corto, claramente distinto de
// los 4 tonos de color de arriba (todos ≤554Hz) para que no se confunda
// con ningún color — suena en TODOS los modos (incluso con voz), no es una
// pista de memoria, es solo la señal de "ahora te toca a vos".
const BEEP_TURNO_FRECUENCIA = 880.0; // A5, una octava arriba del tono más agudo de color
const BEEP_TURNO_DURACION_MS = 150;

function aleatorio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function esperar(ms, timers) {
  return new Promise((resolve) => {
    const t = window.setTimeout(resolve, ms);
    timers.push(t);
  });
}

function formatearTiempo(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function init(root) {
  if (!root) return;

  // ── DOM ────────────────────────────────────────────────────────────
  const elConfig = root.querySelector('[data-juego-config]');
  const elEmpezar = root.querySelector('[data-juego-empezar]');
  const selModo = root.querySelector('[data-simon-modo]');
  const selFinalizacion = root.querySelector('[data-simon-finalizacion]');
  const chkAcelerar = root.querySelector('[data-simon-acelerar]');
  const elAcelerarDetalle = root.querySelector('[data-simon-acelerar-detalle]');
  const sliderPorcentajeAcel = root.querySelector('[data-simon-porcentaje-acel]');
  const elPorcentajeAcelValor = root.querySelector('[data-simon-porcentaje-acel-valor]');
  const sliderDuracionEstimulo = root.querySelector('[data-simon-duracion-estimulo]');
  const elDuracionEstimuloValor = root.querySelector('[data-simon-duracion-estimulo-valor]');
  const elJuego = root.querySelector('[data-simon-juego]');
  const elHud = root.querySelector('[data-simon-hud]');
  const elProgreso = root.querySelector('[data-simon-progreso]');
  const elErrores = root.querySelector('[data-simon-errores]');
  const elHudTurno = root.querySelector('[data-simon-hud-turno]');
  const elEstado = root.querySelector('[data-simon-estado]');
  const elAyuda = root.querySelector('[data-juego-ayuda]');
  const elTablero = root.querySelector('[data-simon-tablero]');
  const elAviso = root.querySelector('[data-simon-aviso]');
  const btnSalir = root.querySelector('[data-simon-salir]');
  const elResumen = root.querySelector('[data-juego-resumen]');
  const elStats = root.querySelector('[data-juego-stats]');
  const btnDeNuevo = root.querySelector('[data-juego-de-nuevo]');
  const btnConfigurar = root.querySelector('[data-juego-configurar]');
  const btnConfigurarDispositivo = root.querySelector('[data-configurar-dispositivo]');
  const btnRestaurarDispositivo = root.querySelector('[data-restaurar-dispositivo]');
  const enlacesVolverApps = Array.prototype.slice.call(root.querySelectorAll('[data-volver-apps]'));
  const botones = {};
  COLORES.forEach((c) => {
    botones[c.id] = root.querySelector('[data-color="' + c.id + '"]');
  });

  const panel = window.EpeAcceso.crearPanel(root.querySelector('[data-acceso-panel]'), {
    id: 'simoneuro',
    acciones: ACCIONES,
    permitirBarrido: true,
  });

  // ── Voz ────────────────────────────────────────────────────────────
  const voz = crearVoz();
  let vozElegida = voz.disponible ? elegirVoz(voz.listarVoces()) : null;
  voz.alCambiarVoces(() => {
    vozElegida = elegirVoz(voz.listarVoces());
  });

  // Velocidad de la voz para esta ronda: normal (1) si la secuencia no se
  // está acelerando todavía (ronda 1, o aceleración desactivada); si se
  // está acelerando, se acelera en la MISMA proporción que la luz y la
  // pausa entre ítems — factorAceleracion() da cuánto se achica la
  // duración (≤ 1), así que acá se usa su inversa para la velocidad (si la
  // luz dura la mitad, la voz habla al doble de rápido). Ver nota en el
  // comentario de VELOCIDAD_VOZ_MIN/MAX: a propósito no se mide ni se
  // estima nada, se reutiliza el mismo porcentaje que ya eligió Gon para
  // la luz.
  function velocidadVoz() {
    const velocidad = 1 / factorAceleracion();
    return Math.min(VELOCIDAD_VOZ_MAX, Math.max(VELOCIDAD_VOZ_MIN, velocidad));
  }

  // Se espera a que la voz termine de decir el color antes de pasar al
  // siguiente (Promise, resuelta por alTerminar/alFallar o, si ninguno de
  // los dos dispara, por MAX_ESPERA_VOZ_MS). Se había probado el 07/10 que
  // no se esperara (ritmo marcado solo por la luz, igual que el beep en el
  // modo sin voz) para que el tiempo muerto entre colores no variara según
  // el largo de la palabra — pero Gon lo jugó en el dispositivo real y la
  // voz quedaba cortada a mitad de palabra: `voz.hablar()` (ver
  // voz-web.js) siempre arranca llamando a `parar()`, que hace
  // `speechSynthesis.cancel()` — si el siguiente color se habla antes de
  // que el anterior termine, lo corta de golpe. Esperar acá evita que eso
  // pase: nunca se vuelve a llamar a `voz.hablar()` hasta que la locución
  // anterior ya terminó sola. El trade-off vuelve a ser el de antes (el
  // tiempo muerto entre colores puede variar un poco según el largo de la
  // palabra), que Gon prefiere frente a una palabra cortada. Ver también
  // PORCENTAJE_ACEL_MAX_AUDIO: limitar cuánto se acelera en los modos con
  // voz ayuda a que la luz y la voz no se desfasen tanto.
  function hablarColor(color) {
    if (!voz.disponible) return Promise.resolve();
    return new Promise((resolve) => {
      let resuelto = false;
      const terminar = () => {
        if (resuelto) return;
        resuelto = true;
        resolve();
      };
      voz.hablar(color.etiqueta, {
        voz: vozElegida,
        velocidad: velocidadVoz(),
        alTerminar: terminar,
        alFallar: terminar,
      });
      window.setTimeout(terminar, MAX_ESPERA_VOZ_MS);
    });
  }

  // ── Estado ───────────────────────────────────────────────────────
  let cfg = null;
  let entrada = null;
  let modo = 'visual';
  let finalizacion = { tipo: 'tiempo', valor: 60 };
  let acelerarActivado = false;
  let porcentajeAceleracion = PORCENTAJE_ACEL_MIN;
  let duracionEstimuloBaseMs = DURACION_ESTIMULO_DEFAULT_MS;

  let secuenciaVisual = [];
  let secuenciaAuditiva = [];
  let secuenciaObjetivo = [];
  let posicionActual = 0;
  let tInicioPosicion = 0;
  let errores = 0;
  let respuestasRT = []; // { longitud, posicion, correcto, rt }
  let corriendo = false;
  let aceptando = false; // true solo durante la espera de respuesta
  let finTiempo = 0;
  let timerReloj = null;
  let timers = [];
  let generacionRonda = 0; // invalida una reproducción en curso si se sale/reinicia
  let restaurarDispositivo = null;
  let audioCtx = null;

  // ── Beep (modo "visual", sin voz) ───────────────────────────────────
  // El AudioContext se crea/retoma en empezar() (gesto de usuario: el click
  // en "Empezar"), para no chocar con las políticas de autoplay del
  // navegador — acá solo se reutiliza.
  function obtenerAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function beep(frecuencia, duracionMs) {
    const ctx = obtenerAudioCtx();
    if (!ctx || !frecuencia) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frecuencia;
    const ahora = ctx.currentTime;
    const dur = duracionMs / 1000;
    // Envolvente simple (en vez de un volumen fijo) para evitar el "click"
    // de un tono que arranca y corta de golpe.
    gain.gain.setValueAtTime(0.0001, ahora);
    gain.gain.exponentialRampToValueAtTime(0.2, ahora + 0.015);
    gain.gain.setValueAtTime(0.2, Math.max(ahora + 0.015, ahora + dur - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.0001, ahora + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ahora);
    osc.stop(ahora + dur + 0.02);
  }

  // ── Aceleración de la secuencia (configurable) ──────────────────────
  // La ronda 1 (secuenciaVisual.length === 1) se juega siempre a la
  // duración base, sin acelerar todavía; a partir de la ronda 2 se
  // multiplica por (1 - porcentaje/100) elevado a las rondas ya jugadas.
  function factorAceleracion() {
    if (!acelerarActivado) return 1;
    const exponente = Math.max(0, secuenciaVisual.length - 1);
    return Math.pow(1 - porcentajeAceleracion / 100, exponente);
  }

  function duracionLuzRonda() {
    return Math.max(DURACION_LUZ_MIN_MS, Math.round(duracionEstimuloBaseMs * factorAceleracion()));
  }

  function pausaEntreItemsRonda() {
    return Math.max(PAUSA_ENTRE_ITEMS_MIN_MS, Math.round(PAUSA_ENTRE_ITEMS_MS * factorAceleracion()));
  }

  // 07/10/2026: estas dos también siguen factorAceleracion() (antes eran
  // fijas) — son las pausas de feedback y entre rondas, ver el comentario
  // junto a FEEDBACK_MS/PAUSA_ENTRE_RONDAS_MS arriba para el motivo.
  function feedbackMsRonda() {
    return Math.max(FEEDBACK_MIN_MS, Math.round(FEEDBACK_MS * factorAceleracion()));
  }

  function pausaEntreRondasMsRonda() {
    return Math.max(PAUSA_ENTRE_RONDAS_MIN_MS, Math.round(PAUSA_ENTRE_RONDAS_MS * factorAceleracion()));
  }

  // ── Preparación: aceleración y duración del estímulo ────────────────
  function textoPorcentajeAcel() {
    elPorcentajeAcelValor.textContent = sliderPorcentajeAcel.value + '% más rápido';
  }

  function textoDuracionEstimulo() {
    const seg = Number(sliderDuracionEstimulo.value);
    elDuracionEstimuloValor.textContent = seg.toFixed(1).replace('.', ',') + ' s';
  }

  function actualizarVisibilidadAcelerar() {
    elAcelerarDetalle.hidden = !chkAcelerar.checked;
  }

  // 07/10/2026: el modo elegido en el SELECT (todavía no "modo", que recién
  // se actualiza al empezar la partida en leerEjercicio()) decide el tope
  // del deslizante de aceleración — ver PORCENTAJE_ACEL_MAX_AUDIO. Si el
  // valor guardado/elegido queda por encima del nuevo tope, se lo baja: así
  // lo que se ve en el deslizante siempre coincide con lo que se va a
  // aplicar cuando empiece la partida.
  function actualizarTopeAceleracion() {
    const tope = selModo.value === 'visual' ? PORCENTAJE_ACEL_MAX : PORCENTAJE_ACEL_MAX_AUDIO;
    sliderPorcentajeAcel.max = String(tope);
    if (Number(sliderPorcentajeAcel.value) > tope) {
      sliderPorcentajeAcel.value = String(tope);
    }
    textoPorcentajeAcel();
  }

  // ── Configuración guardada (solo los selectores del ejercicio) ─────
  function cargarConfig() {
    const g = window.EpeTeclas.leerJSON(CLAVE_CONFIG);
    if (g && typeof g === 'object') {
      if (['visual', 'visual-auditivo', 'inhibir-visual', 'inhibir-auditivo'].indexOf(g.modo) !== -1) {
        selModo.value = g.modo;
      }
      if (typeof g.finalizacion === 'string' && selFinalizacion.querySelector('option[value="' + g.finalizacion + '"]')) {
        selFinalizacion.value = g.finalizacion;
      }
      if (typeof g.acelerar === 'boolean') chkAcelerar.checked = g.acelerar;
      if (
        typeof g.porcentajeAcel === 'number' &&
        g.porcentajeAcel >= PORCENTAJE_ACEL_MIN &&
        g.porcentajeAcel <= PORCENTAJE_ACEL_MAX
      ) {
        sliderPorcentajeAcel.value = String(g.porcentajeAcel);
      }
      if (
        typeof g.duracionEstimulo === 'number' &&
        g.duracionEstimulo >= DURACION_ESTIMULO_MIN_S &&
        g.duracionEstimulo <= DURACION_ESTIMULO_MAX_S
      ) {
        sliderDuracionEstimulo.value = String(g.duracionEstimulo);
      }
    }
    actualizarVisibilidadAcelerar();
    actualizarTopeAceleracion();
    textoDuracionEstimulo();
  }

  function guardarConfig() {
    window.EpeTeclas.guardarJSON(CLAVE_CONFIG, {
      modo: selModo.value,
      finalizacion: selFinalizacion.value,
      acelerar: chkAcelerar.checked,
      porcentajeAcel: Number(sliderPorcentajeAcel.value),
      duracionEstimulo: Number(sliderDuracionEstimulo.value),
    });
  }

  // ── Timers ───────────────────────────────────────────────────────
  function programar(fn, ms) {
    timers.push(window.setTimeout(fn, ms));
  }

  function limpiarTimers() {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
    if (timerReloj) {
      window.clearInterval(timerReloj);
      timerReloj = null;
    }
  }

  // ── Tablero ──────────────────────────────────────────────────────
  function encender(id) {
    botones[id].classList.add('is-lit');
  }

  function apagarTodos() {
    COLORES.forEach((c) => botones[c.id].classList.remove('is-lit'));
  }

  function limpiarMarcas() {
    apagarTodos();
    COLORES.forEach((c) => botones[c.id].classList.remove('es-error', 'es-correcto-ahora'));
    ocultarAviso();
    elHud.classList.remove('es-correcto', 'es-error');
  }

  // Aviso superpuesto al tablero: SOLO la cuenta regresiva ("3","2","1") al
  // empezar la partida (ver reproducirRonda()). El aviso de "Tu turno" ya no
  // va acá: se muestra en la barra del HUD (ver empezarEspera()).
  function mostrarAviso(texto) {
    elAviso.textContent = texto;
    elAviso.hidden = false;
    // Se saca y se vuelve a poner la clase de animación para poder
    // reiniciar el rebote aunque el texto cambie rápido (3 → 2 → 1).
    elAviso.classList.remove('epe-simon-aviso-anim');
    void elAviso.offsetWidth; // fuerza reflow para que el reinicio se note
    elAviso.classList.add('epe-simon-aviso-anim');
  }

  function ocultarAviso() {
    elAviso.hidden = true;
    elAviso.classList.remove('epe-simon-aviso-anim');
  }

  // Ancho = 80% de pantalla, alto = según la relación de aspecto de la
  // pantalla (ver simoneuro.css): se expresa como variable CSS porque
  // `aspect-ratio` no acepta vw/vh directamente.
  function actualizarAspecto() {
    const r = window.innerWidth / window.innerHeight;
    elTablero.style.setProperty('--simon-aspect', String(r));
  }

  // ── Generación de secuencia ──────────────────────────────────────
  function modoUsaAudio() {
    return modo !== 'visual';
  }

  function modoEsInhibitorio() {
    return modo === 'inhibir-visual' || modo === 'inhibir-auditivo';
  }

  function elegirColorSiguiente(anteriores) {
    let color = aleatorio(COLORES);
    const n = anteriores.length;
    if (n >= MAX_SEGUIDOS_MISMO_COLOR) {
      const ultimos = anteriores.slice(n - MAX_SEGUIDOS_MISMO_COLOR);
      const todosIguales = ultimos.every((c) => c.id === ultimos[0].id);
      if (todosIguales) {
        color = aleatorio(
          COLORES.filter((c) => c.id !== ultimos[0].id)
        );
      }
    }
    return color;
  }

  // Agrega pasos nuevos a la secuencia YA EXISTENTE hasta llegar a
  // `longitud` — no la regenera entera. Es lo que hace que sea una prueba
  // de amplitud real (como el Simon original o el Corsi block-tapping
  // test): la secuencia de la ronda 5 son los mismos 4 colores de la ronda
  // 4 más uno nuevo al final, no 5 colores nuevos al azar. El reset a []
  // pasa solo al empezar una partida nueva (comenzarPartida()).
  function generarRonda(longitud) {
    while (secuenciaVisual.length < longitud) {
      const visual = elegirColorSiguiente(secuenciaVisual);
      secuenciaVisual.push(visual);
      if (modoEsInhibitorio()) {
        // El audio SIEMPRE nombra un color distinto al que se ilumina.
        secuenciaAuditiva.push(aleatorio(COLORES.filter((c) => c.id !== visual.id)));
      } else {
        secuenciaAuditiva.push(visual); // congruente (o no se usa, en modo "visual")
      }
    }
    // El objetivo a reproducir depende del modo:
    // - inhibir-visual: hay que seguir lo que se ESCUCHÓ (ignorar la luz).
    // - inhibir-auditivo / visual / visual-auditivo: hay que seguir lo que se VIO.
    secuenciaObjetivo = modo === 'inhibir-visual' ? secuenciaAuditiva : secuenciaVisual;
    posicionActual = 0;
  }

  // Cuenta regresiva ("3","2","1") antes de reproducir la secuencia. Usa la
  // misma generación que reproducirRonda() para poder cancelarse si se sale
  // o se reinicia mientras está corriendo. Devuelve false si se canceló.
  async function reproducirCuentaRegresiva(miGeneracion) {
    for (let n = CUENTA_REGRESIVA_DESDE; n >= 1; n--) {
      if (miGeneracion !== generacionRonda) return false;
      mostrarAviso(String(n));
      await esperar(DURACION_DIGITO_MS, timers);
      if (miGeneracion !== generacionRonda) return false;
    }
    ocultarAviso();
    return true;
  }

  // ── Reproducción automática de la secuencia ─────────────────────
  // `conCuenta`: la cuenta regresiva solo se muestra al empezar la partida
  // (la llamada desde comenzarPartida()), no antes de cada ronda — la
  // llamada desde avanzarRonda() pasa false.
  async function reproducirRonda(conCuenta) {
    const miGeneracion = ++generacionRonda;
    aceptando = false;
    elHudTurno.textContent = '';
    if (conCuenta) {
      const siguio = await reproducirCuentaRegresiva(miGeneracion);
      if (!siguio) return;
      await esperar(PAUSA_POST_CUENTA_MS, timers);
      if (miGeneracion !== generacionRonda) return;
    }
    elEstado.textContent = modoUsaAudio() ? 'Mirá y escuchá la secuencia…' : 'Mirá la secuencia…';
    // Se calculan una sola vez para toda la ronda (no cambian ítem a ítem):
    // dependen de la duración configurada y, si está activada la
    // aceleración, de cuántas rondas ya se jugaron (ver factorAceleracion()).
    const duracionLuz = duracionLuzRonda();
    const pausaItems = pausaEntreItemsRonda();
    for (let i = 0; i < secuenciaVisual.length; i++) {
      if (miGeneracion !== generacionRonda) return;
      encender(secuenciaVisual[i].id);
      // Sin voz (modo "visual") el único refuerzo extra es el beep, que no
      // hace falta esperar. Con voz, se espera a que termine de decir el
      // color (ver el comentario de hablarColor() para el motivo) o a que
      // pase duracionLuz, lo que tarde más — por eso Promise.all en vez de
      // esperar solo una de las dos cosas.
      if (modoUsaAudio()) {
        await Promise.all([esperar(duracionLuz, timers), hablarColor(secuenciaAuditiva[i])]);
      } else {
        beep(FRECUENCIAS[secuenciaVisual[i].id], duracionLuz);
        await esperar(duracionLuz, timers);
      }
      if (miGeneracion !== generacionRonda) return;
      apagarTodos();
      await esperar(pausaItems, timers);
      if (miGeneracion !== generacionRonda) return;
    }
    await esperar(PAUSA_ANTES_RESPUESTA_MS, timers);
    if (miGeneracion !== generacionRonda) return;
    empezarEspera();
  }

  function empezarEspera() {
    posicionActual = 0;
    tInicioPosicion = window.performance.now();
    aceptando = true;
    elEstado.textContent = '';
    elHudTurno.textContent = 'Tu turno';
    // Señal sonora inmediata de cambio de turno (07/10/2026, pedido de Gon
    // inspirado en el protocolo Corsi: ahí el turno del jugador se marca con
    // un beep, no con una demora). Tono agudo y corto, distinto de los
    // tonos de color — suena en TODOS los modos, incluso con voz, porque no
    // es una pista de memoria, es la señal de "ahora te toca a vos".
    beep(BEEP_TURNO_FRECUENCIA, BEEP_TURNO_DURACION_MS);
    // Reinicia el "pop" de aparición del texto aunque ya estuviera (mismo
    // truco que mostrarAviso(): sacar y volver a poner la clase, forzando
    // reflow en el medio) — hace que se note incluso si el texto no cambió.
    elHudTurno.classList.remove('epe-simon-hud-turno-anim');
    void elHudTurno.offsetWidth;
    elHudTurno.classList.add('epe-simon-hud-turno-anim');
  }

  function actualizarHud() {
    elErrores.textContent = String(errores);
    if (finalizacion.tipo === 'longitud') {
      elProgreso.textContent = 'Secuencia: ' + secuenciaVisual.length + ' de ' + finalizacion.valor;
    } else if (finalizacion.tipo === 'errores') {
      elProgreso.textContent = 'Secuencia: ' + secuenciaVisual.length;
    } else {
      elProgreso.textContent = 'Secuencia: ' + secuenciaVisual.length;
    }
  }

  // ── Respuesta ────────────────────────────────────────────────────
  function responder(idColor) {
    if (!corriendo || !aceptando) return;
    aceptando = false;

    const esperado = secuenciaObjetivo[posicionActual].id;
    const rt = Math.round(window.performance.now() - tInicioPosicion);
    const correcto = idColor === esperado;
    respuestasRT.push({ longitud: secuenciaVisual.length, posicion: posicionActual, correcto, rt });

    encender(idColor);
    botones[idColor].classList.add(correcto ? 'es-correcto-ahora' : 'es-error');
    // Feedback en la barra del HUD (reemplaza el aviso superpuesto al
    // tablero): verde sostenido si fue correcto, destello rojo si fue un
    // error (ver limpiarMarcas(), que las saca a los FEEDBACK_MS).
    elHud.classList.add(correcto ? 'es-correcto' : 'es-error');
    if (!correcto) {
      errores++;
      encender(esperado);
      botones[esperado].classList.add('es-correcto-ahora');
    }
    actualizarHud();

    posicionActual++;
    const terminoRonda = posicionActual >= secuenciaVisual.length;

    if (finalizacion.tipo === 'errores' && errores >= finalizacion.valor) {
      programar(() => {
        limpiarMarcas();
        terminarPartida();
      }, feedbackMsRonda());
      return;
    }

    programar(() => {
      limpiarMarcas();
      if (terminoRonda) {
        avanzarRonda();
      } else {
        tInicioPosicion = window.performance.now();
        aceptando = true;
      }
    }, feedbackMsRonda());
  }

  function avanzarRonda() {
    if (finalizacion.tipo === 'tiempo' && window.performance.now() >= finTiempo) {
      terminarPartida();
      return;
    }
    if (finalizacion.tipo === 'longitud' && secuenciaVisual.length >= finalizacion.valor) {
      terminarPartida();
      return;
    }
    generarRonda(secuenciaVisual.length + 1);
    actualizarHud();
    programar(() => reproducirRonda(false), pausaEntreRondasMsRonda());
  }

  // ── Reloj (solo en el modo por tiempo) ───────────────────────────
  function tickReloj() {
    const restante = Math.max(0, Math.ceil((finTiempo - window.performance.now()) / 1000));
    elProgreso.textContent = 'Secuencia: ' + secuenciaVisual.length + ' · Tiempo: ' + formatearTiempo(restante);
    if (restante <= 0) terminarPartida();
  }

  // ── Partida ──────────────────────────────────────────────────────
  function comenzarPartida() {
    limpiarTimers();
    limpiarMarcas();
    errores = 0;
    respuestasRT = [];
    corriendo = true;
    aceptando = false;
    generacionRonda++;
    // Partida nueva: acá sí se arranca de cero (generarRonda() ya no
    // resetea, agrega sobre lo que haya).
    secuenciaVisual = [];
    secuenciaAuditiva = [];
    generarRonda(LARGO_INICIAL);
    actualizarHud();
    elEstado.textContent = '';
    elHudTurno.textContent = '';

    if (finalizacion.tipo === 'tiempo') {
      finTiempo = window.performance.now() + finalizacion.valor * 1000;
      tickReloj();
      timerReloj = window.setInterval(tickReloj, 200);
    }
    // Cuenta regresiva SOLO acá (al empezar la partida), no antes de cada
    // ronda (ver avanzarRonda()).
    programar(() => reproducirRonda(true), PAUSA_ANTES_RESPUESTA_MS);
  }

  // ── Resumen ──────────────────────────────────────────────────────
  function fila(etiqueta, valor) {
    const f = document.createElement('div');
    f.className = 'epe-juego-stat';
    const a = document.createElement('span');
    a.className = 'epe-juego-stat-etiqueta';
    a.textContent = etiqueta;
    const b = document.createElement('span');
    b.className = 'epe-juego-stat-valor';
    b.textContent = valor;
    f.appendChild(a);
    f.appendChild(b);
    return f;
  }

  const MODOS_TEXTO = {
    visual: 'Solo visual',
    'visual-auditivo': 'Visual + Auditivo',
    'inhibir-visual': 'Inhibir visual',
    'inhibir-auditivo': 'Inhibir auditivo',
  };

  const FINALIZACION_TEXTO = {
    tiempo: 'Por tiempo',
    longitud: 'Por longitud de secuencia',
    errores: 'Por cantidad de errores',
  };

  function terminarPartida() {
    if (!corriendo) return;
    corriendo = false;
    aceptando = false;
    generacionRonda++; // invalida cualquier reproducirRonda() en curso
    limpiarTimers();
    limpiarMarcas();
    entrada.detener();
    elEstado.textContent = '';
    elHudTurno.textContent = '';

    const longitudAlcanzada = secuenciaVisual.length;
    const total = respuestasRT.length;

    elStats.innerHTML = '';
    elStats.appendChild(fila('Modo de juego', MODOS_TEXTO[modo]));
    elStats.appendChild(fila('Modo de finalización', FINALIZACION_TEXTO[finalizacion.tipo]));
    elStats.appendChild(fila('Longitud de secuencia alcanzada', String(longitudAlcanzada)));
    elStats.appendChild(fila('Errores totales', String(errores)));

    if (total) {
      const tiempos = respuestasRT.map((r) => r.rt);
      const suma = tiempos.reduce((a, b) => a + b, 0);
      const promedio = Math.round(suma / total);
      let min = respuestasRT[0];
      let max = respuestasRT[0];
      respuestasRT.forEach((r) => {
        if (r.rt < min.rt) min = r;
        if (r.rt > max.rt) max = r;
      });
      elStats.appendChild(fila('Tiempo de respuesta promedio', promedio + ' ms'));
      elStats.appendChild(
        fila(
          'Más rápido',
          min.rt + ' ms (posición ' + (min.posicion + 1) + ' de una secuencia de ' + min.longitud + ')'
        )
      );
      elStats.appendChild(
        fila(
          'Más lento',
          max.rt + ' ms (posición ' + (max.posicion + 1) + ' de una secuencia de ' + max.longitud + ')'
        )
      );
    }

    elResumen.hidden = false;
    btnDeNuevo.focus();
  }

  // ── Entrada (teclas directas o barrido) ──────────────────────────
  function getObjetivos() {
    return COLORES.map((c) => ({ id: c.id, el: botones[c.id] }));
  }

  function actualizarAyuda() {
    elAyuda.innerHTML = '';
    window.EpeAcceso.resumenTeclas(cfg, ACCIONES).forEach((item) => {
      const span = document.createElement('span');
      span.className = 'epe-juego-ayuda-item';
      const kbd = document.createElement('kbd');
      kbd.className = 'epe-tecla';
      kbd.textContent = item.tecla;
      span.appendChild(kbd);
      span.appendChild(document.createTextNode(item.texto));
      elAyuda.appendChild(span);
    });
  }

  // Con teclas directas cada bloque muestra su tecla; con barrido las
  // teclas no son por color, así que se ocultan (la ayuda las explica).
  function actualizarChips() {
    const directo = cfg.modo === 'directo';
    COLORES.forEach((c) => {
      const chip = root.querySelector('[data-tecla-color="' + c.id + '"]');
      chip.hidden = !directo;
      if (directo) chip.textContent = window.EpeTeclas.etiqueta(cfg.teclas[c.id]);
    });
    elAyuda.hidden = directo;
  }

  // ── Flujo de pantallas ───────────────────────────────────────────
  function leerEjercicio() {
    modo = selModo.value;
    const v = selFinalizacion.value;
    const tipo = v.charAt(0) === 't' ? 'tiempo' : v.charAt(0) === 'l' ? 'longitud' : 'errores';
    finalizacion = { tipo, valor: Number(v.slice(1)) || 1 };
    acelerarActivado = chkAcelerar.checked;
    porcentajeAceleracion = Number(sliderPorcentajeAcel.value) || PORCENTAJE_ACEL_MIN;
    duracionEstimuloBaseMs = Math.round(Number(sliderDuracionEstimulo.value) * 1000) || DURACION_ESTIMULO_DEFAULT_MS;
  }

  function empezar() {
    guardarConfig();
    leerEjercicio();
    obtenerAudioCtx(); // se crea/retoma acá porque este click SÍ es gesto de usuario
    cfg = panel.leer();
    limpiarTimers();
    if (entrada) entrada.detener();
    entrada = window.EpeEntrada.crear({
      cfg: cfg,
      getObjetivos: getObjetivos,
      alAccion: responder,
      alEscape: function () {
        salirConfirmado(salirAConfig);
      },
    });
    elConfig.hidden = true;
    elResumen.hidden = true;
    elJuego.hidden = false;
    actualizarAspecto();
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
    generacionRonda++;
    limpiarTimers();
    ocultarAviso();
    elHudTurno.textContent = '';
    elHud.classList.remove('es-correcto', 'es-error');
    if (entrada) entrada.detener();
    elResumen.hidden = true;
    elJuego.hidden = true;
    elConfig.hidden = false;
    elEmpezar.focus();
  }

  // ── Configurar dispositivo físico (ver stroop.js, mismo patrón) ──
  function configurarDispositivo() {
    if (!window.EpeConfigurarDispositivo) return;
    const cfgActual = panel.leer();
    const entradas = window.EpeAcceso.entradasNecesarias(cfgActual, ACCIONES);
    window.EpeConfigurarDispositivo.abrir(entradas, { titulo: 'Configurar dispositivo — SimoNeuro' }).then(
      (resultado) => {
        if (resultado && resultado.restaurar) restaurarDispositivo = resultado.restaurar;
        actualizarBotonRestaurar();
        if (resultado && resultado.continuar) empezar();
      }
    );
  }

  function actualizarBotonRestaurar() {
    if (btnRestaurarDispositivo) btnRestaurarDispositivo.hidden = !restaurarDispositivo;
  }

  function restaurarDispositivoClick() {
    if (!restaurarDispositivo) return;
    const fn = restaurarDispositivo;
    restaurarDispositivo = null;
    btnRestaurarDispositivo.disabled = true;
    btnRestaurarDispositivo.textContent = 'Restaurando…';
    fn()
      .then((r) => {
        btnRestaurarDispositivo.textContent = r && r.ok ? 'Listo' : 'Quedó distinto en algún campo';
      })
      .catch(() => {
        btnRestaurarDispositivo.textContent = 'No se pudo restaurar';
      })
      .then(() => {
        window.setTimeout(() => {
          btnRestaurarDispositivo.disabled = false;
          btnRestaurarDispositivo.textContent = 'Restaurar dispositivo';
          actualizarBotonRestaurar();
        }, 2500);
      });
  }

  function salirConfirmado(luegoSalir) {
    if (!(window.EpeConfigurarDispositivo && restaurarDispositivo)) {
      luegoSalir();
      return;
    }
    const fn = restaurarDispositivo;
    window.EpeConfigurarDispositivo.confirmarSalida(fn).then((r) => {
      if (!r.salir) return;
      if (r.restaurado) {
        restaurarDispositivo = null;
        actualizarBotonRestaurar();
      }
      luegoSalir();
    });
  }

  function irAApps() {
    window.location.href = 'index.html';
  }

  // ── Eventos ──────────────────────────────────────────────────────
  chkAcelerar.addEventListener('change', actualizarVisibilidadAcelerar);
  selModo.addEventListener('change', actualizarTopeAceleracion);
  sliderPorcentajeAcel.addEventListener('input', textoPorcentajeAcel);
  sliderDuracionEstimulo.addEventListener('input', textoDuracionEstimulo);
  elEmpezar.addEventListener('click', empezar);
  btnDeNuevo.addEventListener('click', jugarDeNuevo);
  btnConfigurar.addEventListener('click', () => salirConfirmado(salirAConfig));
  btnSalir.addEventListener('click', () => salirConfirmado(salirAConfig));
  enlacesVolverApps.forEach((a) => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      salirConfirmado(irAApps);
    });
  });
  if (btnConfigurarDispositivo) btnConfigurarDispositivo.addEventListener('click', configurarDispositivo);
  if (btnRestaurarDispositivo) {
    btnRestaurarDispositivo.addEventListener('click', restaurarDispositivoClick);
    actualizarBotonRestaurar();
  }
  COLORES.forEach((c) => {
    botones[c.id].addEventListener('click', () => responder(c.id));
  });
  window.addEventListener('resize', actualizarAspecto);

  cargarConfig();
  actualizarAspecto();
  elEmpezar.focus();
}

window.EpeSimon = { init: init };
init(document.querySelector('.epe-simon-shell'));
