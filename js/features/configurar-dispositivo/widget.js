// @ts-check
/**
 * Widget "Configurar dispositivo" (paso 2 del roadmap, 26/09/2026).
 *
 * Lo que hace: detecta un dispositivo dis+ conectado, y para cada acción que
 * la app que lo invoca necesita ({ id, etiqueta, tecla }) le pregunta al
 * usuario a qué botón físico asignarla — con un modal de instrucciones tipo
 * "Asigná «Varilla 1» a un botón" — arma y manda los comandos con el núcleo
 * del dispositivo, y ofrece deshacer.
 *
 * Módulo ES (todo el código nuevo se escribe así, ver "Embeber el
 * configurador"). Se invoca desde scripts clásicos vía el puente
 * `window.EpeConfigurarDispositivo.abrir(entradas)` que este archivo instala
 * al cargarse — mismo criterio que el resto de los puentes ES↔clásico de la
 * plataforma.
 *
 * Fuera de alcance de esta primera versión (a propósito, ver el doc del
 * proyecto "Widget Configurar dispositivo - análisis y plan"):
 * - Guardar el perfil (recién en el paso 4, cuando exista la tabla en Supabase).
 * - Acciones que necesitan "mantener apretado" (Piano, Duración de pulsación):
 *   esta versión solo arma botones de "al presionar" (modo P), que alcanza
 *   para las acciones de tipo "una tecla = un disparo" (Hanói, N-back, Stroop,
 *   Lado Correcto, Vincular imagen).
 */

import {
  crearConexionUsb,
  crearConexionBle,
  TransporteUsb,
  TransporteBle,
  productoPorModelo,
  todasLasEntradas,
  buildButtonCfg,
} from '../dispositivo/index.js';

/** Códigos de flecha (ver productos.js: solo asignables una por una si FMODE=0). */
const CODIGOS_FLECHA = ['FU', 'FD', 'FL', 'FR'];

/**
 * @typedef {Object} EntradaNecesaria
 * @property {string} id       Identificador de la acción (lo define la app).
 * @property {string} etiqueta Nombre legible ("Varilla 1", "Avanzar").
 * @property {string} tecla    Tecla en formato `KeyboardEvent.key` en
 *   minúscula (lo que ya usan `EpeTeclas`/`EpeAcceso`): `"a"`, `" "`,
 *   `"arrowleft"`, `"escape"`...
 */

// ─────────────────────────────────────────────────────────────────────────
// Traducción de tecla: formato de las apps (EpeTeclas) → token que entiende
// `buildButtonCfg`/`cvKey` del núcleo. Ver "Widget Configurar dispositivo -
// análisis y plan" (doc del proyecto) — sin esto, espacio/flechas/escape
// quedarían mal configurados en el dispositivo sin ningún aviso.
// ─────────────────────────────────────────────────────────────────────────
const TOKEN_ESPECIAL = {
  ' ': 'SPACE',
  arrowleft: 'LEFT_ARROW',
  arrowright: 'RIGHT_ARROW',
  arrowup: 'UP_ARROW',
  arrowdown: 'DOWN_ARROW',
  escape: 'ESC',
};

/** @param {string} tecla */
function tokenParaNucleo(tecla) {
  return TOKEN_ESPECIAL[tecla] ?? tecla;
}

/** @param {string} tecla Igual criterio de etiqueta legible que `EpeTeclas.etiqueta`. */
function teclaLegible(tecla) {
  const NOMBRES = {
    ' ': 'Espacio',
    enter: 'Enter',
    tab: 'Tab',
    escape: 'Esc',
    arrowleft: '←',
    arrowright: '→',
    arrowup: '↑',
    arrowdown: '↓',
    backspace: 'Retroceso',
    delete: 'Supr',
  };
  if (!tecla) return '—';
  if (NOMBRES[tecla]) return NOMBRES[tecla];
  if (tecla.length === 1) return tecla.toUpperCase();
  return tecla.charAt(0).toUpperCase() + tecla.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────
// Textos según para qué se abre el widget: un juego propio (Apps EpE) o un
// recurso externo de terceros (ver `externo` en `abrir()`). Un recurso
// externo cambia el vocabulario y suma un aviso: el dispositivo se restaura
// desde la pestaña de la plataforma, no desde el recurso.
// ─────────────────────────────────────────────────────────────────────────
const TEXTOS_JUEGO = {
  sujeto: 'el juego',
  conectar:
    'Conectá el dispositivo de dis+capacidad (disMouse, disHub…) para asignarle los botones que necesita este juego.',
  exito: 'Listo, el dispositivo ya está configurado para este juego.',
  continuar: 'Empezar',
  aviso: null,
};

/** @param {string} nombre */
function textosExterno(nombre) {
  return {
    sujeto: 'el recurso',
    conectar: `Conectá el dispositivo de dis+capacidad (disMouse, disHub…) para asignarle los botones que necesita «${nombre}».`,
    exito: `Listo, el dispositivo ya está configurado para «${nombre}».`,
    continuar: 'Abrir recurso',
    aviso:
      'Como es un recurso externo, para restaurar el dispositivo tenés que volver a esta pestaña de la ' +
      'plataforma y presionar «Restaurar». No la cierres mientras usás el recurso.',
  };
}

/** Textos del widget abierto ahora (hay un solo widget a la vez: comparte el modal). */
let T = TEXTOS_JUEGO;

function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

/**
 * Escribe en `cabecera` qué dispositivo se detectó (modelo + firmware).
 * Queda fijo arriba del contenido mientras dura el resto del flujo.
 * @param {HTMLElement} cabecera
 * @param {{ modelo: string|null, version: string|null, producto: import('../dispositivo/index.js').Producto|null }} info
 */
function mostrarCabecera(cabecera, info) {
  cabecera.innerHTML = '';
  const nombre = (info.producto && info.producto.nombre) || info.modelo || 'Dispositivo desconocido';
  const texto = info.version ? `${nombre} — firmware ${info.version}` : nombre;
  cabecera.appendChild(el('p', 'epe-cd-detectado', texto));
}

/**
 * Abre el widget dentro de un modal (`EpeModal`, ya cargado por la página) y
 * lleva al usuario por el flujo completo. No lanza excepciones: cualquier
 * problema se muestra dentro del modal mismo.
 *
 * @param {EntradaNecesaria[]} entradas Lo que la app necesita ahora mismo.
 * @param {{ titulo?: string, externo?: { nombre: string } }} [opciones]
 *   `externo`: se abre para un recurso de terceros (cambia los textos y suma
 *   el aviso de cómo restaurar; ver `textosExterno`).
 * @returns {Promise<{ ok: boolean, motivo?: string, snapshot?: object, restaurar?: () => Promise<{ok: boolean, diferencias: any[]}>, continuar?: boolean }>}
 *   `ok:true` cuando se aplicó una configuración nueva y el usuario cerró el
 *   widget conforme. Si aplicó y no deshizo dentro del propio widget, viene
 *   también `restaurar`: una función ya lista (atada a esa conexión y a ese
 *   snapshot) para devolver el dispositivo a como estaba, pensada para que la
 *   app la llame más tarde (por ejemplo al salir del juego). `continuar:true`
 *   cuando el usuario ya eligió "Empezar" desde el propio modal de éxito: la
 *   app puede arrancar el juego directo, sin pedirle un segundo click. `ok:false`
 *   si se canceló antes de aplicar nada.
 */
export function abrir(entradas, opciones = {}) {
  T = opciones.externo ? textosExterno(opciones.externo.nombre) : TEXTOS_JUEGO;
  return new Promise((resolve) => {
    if (!window.EpeModal) {
      // No debería pasar: cada página que usa el widget carga modal.js.
      console.error('EpeConfigurarDispositivo: falta cargar js/core/modal.js en esta página.');
      resolve({ ok: false, motivo: 'sin-modal' });
      return;
    }
    if (!entradas || !entradas.length) {
      resolve({ ok: false, motivo: 'sin-entradas' });
      return;
    }

    const cabecera = el('div', 'epe-cd-cabecera');
    const cuerpo = el('div', 'epe-cd-cuerpo');
    const contenido = el('div', 'epe-cd');
    contenido.appendChild(cabecera);
    contenido.appendChild(cuerpo);
    let terminado = false;

    /** @param {{ ok: boolean, motivo?: string }} resultado */
    function cerrar(resultado) {
      if (terminado) return;
      terminado = true;
      window.EpeModal.close();
      resolve(resultado);
    }

    window.EpeModal.open({
      titulo: opciones.titulo || 'Configurar dispositivo',
      contenido,
      onClose: () => cerrar({ ok: false, motivo: 'cerrado' }),
    });

    pasoConectar(cuerpo, entradas, cerrar, cabecera);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Paso 1: conectar
// ─────────────────────────────────────────────────────────────────────────

function pasoConectar(raiz, entradas, cerrar, cabecera) {
  raiz.innerHTML = '';
  raiz.appendChild(el('p', 'epe-cd-intro', T.conectar));

  const usbOk = TransporteUsb.disponible();
  const bleOk = TransporteBle.disponible();
  const filaBotones = el('div', 'epe-cd-botones');

  const btnUsb = el('button', 'epe-btn-acc', 'Conectar por USB');
  btnUsb.type = 'button';
  btnUsb.disabled = !usbOk;
  btnUsb.addEventListener('click', () => conectar('usb', raiz, entradas, cerrar, cabecera));
  filaBotones.appendChild(btnUsb);

  const btnBle = el('button', 'epe-btn-ghost', 'Conectar por Bluetooth');
  btnBle.type = 'button';
  btnBle.disabled = !bleOk;
  btnBle.addEventListener('click', () => conectar('ble', raiz, entradas, cerrar, cabecera));
  filaBotones.appendChild(btnBle);

  raiz.appendChild(filaBotones);

  if (!usbOk && !bleOk) {
    raiz.appendChild(
      el(
        'p',
        'epe-cd-error',
        'Este navegador no puede conectarse a dispositivos USB ni Bluetooth. Probá con Chrome o Edge en una compu.',
      ),
    );
  }

  const btnCancelar = el('button', 'epe-btn-ghost epe-cd-cancelar', 'Cancelar');
  btnCancelar.type = 'button';
  btnCancelar.addEventListener('click', () => cerrar({ ok: false, motivo: 'cancelado' }));
  raiz.appendChild(btnCancelar);
}

async function conectar(tipo, raiz, entradas, cerrar, cabecera) {
  raiz.innerHTML = '';
  raiz.appendChild(el('p', 'epe-cd-intro', 'Conectando…'));

  const { conexion } = tipo === 'usb' ? crearConexionUsb() : crearConexionBle();
  try {
    const info = await conexion.conectar();
    const producto = productoPorModelo(info.modelo);
    if (!producto) {
      raiz.innerHTML = '';
      raiz.appendChild(
        el(
          'p',
          'epe-cd-error',
          `No reconozco este dispositivo (${info.modelo || 'sin modelo'}). Probá con otro, o avisale a dis+capacidad.`,
        ),
      );
      agregarVolver(raiz, () => pasoConectar(raiz, entradas, cerrar, cabecera));
      return;
    }
    mostrarCabecera(cabecera, info);
    pasoSnapshot(raiz, entradas, cerrar, conexion, producto, cabecera);
  } catch (e) {
    raiz.innerHTML = '';
    const cancelado = e && e.codigo === 'cancelado';
    if (!cancelado) {
      raiz.appendChild(
        el('p', 'epe-cd-error', `No se pudo conectar: ${(e && e.message) || e}`),
      );
    }
    agregarVolver(raiz, () => pasoConectar(raiz, entradas, cerrar, cabecera));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Paso 2: respaldo obligatorio (no hay "aplicar sin guardar" en este protocolo)
// ─────────────────────────────────────────────────────────────────────────

async function pasoSnapshot(raiz, entradas, cerrar, conexion, producto, cabecera) {
  raiz.innerHTML = '';
  raiz.appendChild(el('p', 'epe-cd-intro', 'Leyendo la configuración actual del dispositivo…'));
  try {
    const snapshot = await conexion.tomarSnapshot();
    // Mostramos siempre todas las entradas, incluidas las flechas: si el
    // usuario asigna alguna, "Aplicar" pone el dispositivo en modo botones
    // individuales (FMODE:0) para que se puedan configurar una por una (ver
    // entradasAsignables en productos.js).
    const disponibles = todasLasEntradas(producto);
    pasoAsignar(raiz, entradas, cerrar, conexion, producto, snapshot, disponibles);
  } catch (e) {
    raiz.innerHTML = '';
    raiz.appendChild(
      el('p', 'epe-cd-error', `No se pudo leer el dispositivo: ${(e && e.message) || e}`),
    );
    agregarVolver(raiz, () => pasoConectar(raiz, entradas, cerrar, cabecera));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Paso 3: asignar cada tecla a un botón físico, una por una
// ─────────────────────────────────────────────────────────────────────────

function pasoAsignar(raiz, entradas, cerrar, conexion, producto, snapshot, disponibles) {
  const aUsar = entradas.slice(0, disponibles.length);
  const asignaciones = []; // { entrada, codigo }

  function pedir(idx) {
    if (idx >= aUsar.length) {
      pasoResumen(raiz, entradas, aUsar, asignaciones, cerrar, conexion, producto, snapshot);
      return;
    }
    const entrada = aUsar[idx];
    raiz.innerHTML = '';

    if (idx === 0 && entradas.length > disponibles.length) {
      raiz.appendChild(
        el(
          'p',
          'epe-cd-aviso',
          `Este dispositivo tiene ${disponibles.length} entradas y ${T.sujeto} necesita ${entradas.length}. ` +
            `Se van a asignar las primeras ${disponibles.length}; el resto queda sin configurar.`,
        ),
      );
    }

    raiz.appendChild(
      el(
        'p',
        'epe-cd-intro',
        `Elegí a qué botón asignar «${entrada.etiqueta}» (tecla ${teclaLegible(entrada.tecla)}):`,
      ),
    );

    const lista = el('div', 'epe-cd-lista-entradas');
    disponibles.forEach((d) => {
      const yaUsada = asignaciones.find((a) => a.codigo === d.codigo);
      const label = el('label', 'epe-cd-entrada' + (yaUsada ? ' is-deshabilitada' : ''));
      const radio = el('input');
      radio.type = 'radio';
      radio.name = 'epe-cd-entrada';
      radio.value = d.codigo;
      radio.disabled = !!yaUsada;
      radio.addEventListener('change', () => {
        asignaciones.push({ entrada, codigo: d.codigo });
        pedir(idx + 1);
      });
      const punto = el('span', 'epe-cd-color');
      punto.style.backgroundColor = d.color;
      const texto = el('span', 'epe-cd-entrada-texto');
      texto.appendChild(el('strong', null, d.etiqueta));
      if (yaUsada) texto.appendChild(el('small', null, `ya asignado a «${yaUsada.entrada.etiqueta}»`));
      else if (d.nota) texto.appendChild(el('small', null, d.nota));
      label.appendChild(radio);
      label.appendChild(punto);
      label.appendChild(texto);
      lista.appendChild(label);
    });
    raiz.appendChild(lista);

    const filaBotones = el('div', 'epe-cd-botones');
    if (idx > 0) {
      const btnAtras = el('button', 'epe-btn-ghost', 'Atrás');
      btnAtras.type = 'button';
      btnAtras.addEventListener('click', () => {
        asignaciones.pop();
        pedir(idx - 1);
      });
      filaBotones.appendChild(btnAtras);
    }
    const btnCancelar = el('button', 'epe-btn-ghost', 'Cancelar');
    btnCancelar.type = 'button';
    btnCancelar.addEventListener('click', () => cerrar({ ok: false, motivo: 'cancelado' }));
    filaBotones.appendChild(btnCancelar);
    raiz.appendChild(filaBotones);
  }

  pedir(0);
}

// ─────────────────────────────────────────────────────────────────────────
// Paso 4: resumen y aplicar
// ─────────────────────────────────────────────────────────────────────────

function pasoResumen(raiz, entradasPedidas, aUsar, asignaciones, cerrar, conexion, producto, snapshot) {
  raiz.innerHTML = '';
  raiz.appendChild(el('p', 'epe-cd-intro', 'Así va a quedar configurado el dispositivo:'));

  const lista = el('ul', 'epe-cd-resumen');
  asignaciones.forEach((a) => {
    const entradaInfo = [...producto.botones, ...producto.secundarias].find(
      (d) => d.codigo === a.codigo,
    );
    lista.appendChild(
      el(
        'li',
        null,
        `${entradaInfo ? entradaInfo.etiqueta : a.codigo} → ${a.entrada.etiqueta} (${teclaLegible(a.entrada.tecla)})`,
      ),
    );
  });
  raiz.appendChild(lista);

  if (entradasPedidas.length > aUsar.length) {
    const sinAsignar = entradasPedidas.slice(aUsar.length).map((e) => e.etiqueta);
    raiz.appendChild(
      el('p', 'epe-cd-aviso', `Sin configurar (no alcanzaron los botones): ${sinAsignar.join(', ')}.`),
    );
  }

  const necesitaModoIndividual =
    producto.secundariasSoloModoIndividual &&
    asignaciones.some((a) => CODIGOS_FLECHA.includes(a.codigo));
  if (necesitaModoIndividual) {
    raiz.appendChild(
      el(
        'p',
        'epe-cd-aviso',
        'Esto va a poner el dispositivo en modo "botones individuales": mientras esté así, las flechas ' +
          'no van a mover el cursor ni emular teclas direccionales, van a funcionar como botones aparte.',
      ),
    );
  }

  if (T.aviso) raiz.appendChild(el('p', 'epe-cd-aviso', T.aviso));

  const filaBotones = el('div', 'epe-cd-botones');
  const btnAplicar = el('button', 'epe-btn-acc', 'Aplicar');
  btnAplicar.type = 'button';
  btnAplicar.addEventListener('click', () =>
    aplicar(raiz, cerrar, conexion, asignaciones, snapshot, necesitaModoIndividual),
  );
  filaBotones.appendChild(btnAplicar);
  const btnCancelar = el('button', 'epe-btn-ghost', 'Cancelar');
  btnCancelar.type = 'button';
  btnCancelar.addEventListener('click', () => cerrar({ ok: false, motivo: 'cancelado' }));
  filaBotones.appendChild(btnCancelar);
  raiz.appendChild(filaBotones);
}

async function aplicar(raiz, cerrar, conexion, asignaciones, snapshot, necesitaModoIndividual) {
  raiz.innerHTML = '';
  raiz.appendChild(el('p', 'epe-cd-intro', 'Aplicando…'));

  const comandos = asignaciones.map((a) =>
    buildButtonCfg({
      code: a.codigo,
      tipo: 'K',
      modo: 'P',
      key: tokenParaNucleo(a.entrada.tecla),
    }),
  );
  if (necesitaModoIndividual) comandos.push('FMODE:0');

  try {
    const { errorDispositivo } = await conexion.aplicar(comandos);
    raiz.innerHTML = '';
    const exito = !errorDispositivo;
    raiz.appendChild(
      el(
        'p',
        exito ? 'epe-cd-ok' : 'epe-cd-error',
        exito ? T.exito : `El dispositivo respondió: ${errorDispositivo}`,
      ),
    );
    if (exito && T.aviso) raiz.appendChild(el('p', 'epe-cd-aviso', T.aviso));
    const filaBotones = el('div', 'epe-cd-botones');
    const btnDeshacer = el('button', 'epe-btn-ghost', 'Deshacer (volver a como estaba)');
    btnDeshacer.type = 'button';
    btnDeshacer.addEventListener('click', () => deshacer(raiz, cerrar, conexion, snapshot));
    filaBotones.appendChild(btnDeshacer);
    // Éxito: un solo click ("Empezar") cierra el widget Y arranca el juego —
    // antes hacía falta cerrar el modal y encima apretar "Empezar" aparte.
    // Si falló la aplicación, se deja "Cerrar" nomás: no tiene sentido
    // arrancar como si el dispositivo ya estuviera listo.
    const btnContinuar = el('button', 'epe-btn-acc', exito ? T.continuar : 'Cerrar');
    btnContinuar.type = 'button';
    btnContinuar.addEventListener('click', () =>
      cerrar({ ok: true, snapshot, restaurar: () => conexion.restaurar(snapshot), continuar: exito }),
    );
    filaBotones.appendChild(btnContinuar);
    raiz.appendChild(filaBotones);
  } catch (e) {
    raiz.innerHTML = '';
    raiz.appendChild(
      el('p', 'epe-cd-error', `No se pudo aplicar: ${(e && e.message) || e}. Podés reintentar o cancelar.`),
    );
    const filaBotones = el('div', 'epe-cd-botones');
    const btnCancelar = el('button', 'epe-btn-ghost', 'Cancelar');
    btnCancelar.type = 'button';
    btnCancelar.addEventListener('click', () => cerrar({ ok: false, motivo: 'error' }));
    filaBotones.appendChild(btnCancelar);
    raiz.appendChild(filaBotones);
  }
}

async function deshacer(raiz, cerrar, conexion, snapshot) {
  raiz.innerHTML = '';
  raiz.appendChild(el('p', 'epe-cd-intro', 'Restaurando la configuración anterior…'));
  try {
    const r = await conexion.restaurar(snapshot);
    raiz.innerHTML = '';
    raiz.appendChild(
      el(
        'p',
        r.ok ? 'epe-cd-ok' : 'epe-cd-error',
        r.ok
          ? 'Listo, quedó como estaba antes.'
          : `Quedó distinto en ${r.diferencias.length} campo(s). Puede que el dispositivo no haya podido volver a algún valor exacto.`,
      ),
    );
    const btnCerrar = el('button', 'epe-btn-acc', 'Cerrar');
    btnCerrar.type = 'button';
    btnCerrar.addEventListener('click', () => cerrar({ ok: true }));
    raiz.appendChild(btnCerrar);
  } catch (e) {
    raiz.innerHTML = '';
    raiz.appendChild(
      el('p', 'epe-cd-error', `No se pudo deshacer: ${(e && e.message) || e}.`),
    );
    const btnCerrar = el('button', 'epe-btn-ghost', 'Cerrar igual');
    btnCerrar.type = 'button';
    btnCerrar.addEventListener('click', () => cerrar({ ok: false, motivo: 'error-deshacer' }));
    raiz.appendChild(btnCerrar);
  }
}

function agregarVolver(raiz, onVolver) {
  const btn = el('button', 'epe-btn-ghost', 'Volver a intentar');
  btn.type = 'button';
  btn.addEventListener('click', onVolver);
  raiz.appendChild(btn);
}

// ─────────────────────────────────────────────────────────────────────────
// Recordatorio antes de salir del juego (Esc/Salir, "Cambiar configuración"
// o "Volver a Apps EpE"): si queda una `restaurar` pendiente (ver `abrir()`),
// pregunta antes de dejar que la app siga con la salida. Cada app decide qué
// significa "salir" (volver a su propia pantalla de config, o navegar afuera
// de la página) — este modal no lo sabe ni le importa.
// ─────────────────────────────────────────────────────────────────────────

/**
 * @param {(() => Promise<{ok: boolean, diferencias: any[]}>) | null | undefined} restaurar
 *   La función que devolvió `abrir()`, o `null`/`undefined` si no hay nada
 *   pendiente (en ese caso resuelve enseguida, sin mostrar nada).
 * @returns {Promise<{ salir: boolean, restaurado: boolean }>} `salir:false`
 *   si el usuario canceló (hay que quedarse). `restaurado:true` si se llegó
 *   a restaurar antes de salir (la app puede descartar su `restaurar`).
 */
export function confirmarSalida(restaurar) {
  return new Promise((resolve) => {
    if (!restaurar || !window.EpeModal) {
      resolve({ salir: true, restaurado: false });
      return;
    }

    const contenido = el('div', 'epe-cd');
    contenido.appendChild(
      el(
        'p',
        'epe-cd-intro',
        'Dejaste el dispositivo configurado para este juego. ¿Querés devolverlo a como estaba antes de salir?',
      ),
    );
    const filaBotones = el('div', 'epe-cd-botones');
    let terminado = false;

    function cerrar(resultado) {
      if (terminado) return;
      terminado = true;
      window.EpeModal.close();
      resolve(resultado);
    }

    const btnRestaurar = el('button', 'epe-btn-acc', 'Restaurar y salir');
    btnRestaurar.type = 'button';
    btnRestaurar.addEventListener('click', () => {
      btnRestaurar.disabled = true;
      btnRestaurar.textContent = 'Restaurando…';
      Promise.resolve(restaurar())
        .catch(() => {})
        .then(() => cerrar({ salir: true, restaurado: true }));
    });
    filaBotones.appendChild(btnRestaurar);

    const btnSinRestaurar = el('button', 'epe-btn-ghost', 'Salir sin restaurar');
    btnSinRestaurar.type = 'button';
    btnSinRestaurar.addEventListener('click', () => cerrar({ salir: true, restaurado: false }));
    filaBotones.appendChild(btnSinRestaurar);

    const btnCancelar = el('button', 'epe-btn-ghost', 'Cancelar');
    btnCancelar.type = 'button';
    btnCancelar.addEventListener('click', () => cerrar({ salir: false, restaurado: false }));
    filaBotones.appendChild(btnCancelar);

    contenido.appendChild(filaBotones);

    // Se difiere al siguiente tick: si esto se disparó por Esc (el juego lo
    // usa como atajo de salida), el propio EpeModal también cierra modales
    // con Esc — abrir en el mismo evento haría que ese mismo keydown, al
    // seguir propagándose, cierre este modal apenas lo abrimos (parpadeo
    // invisible, se ve como que "no pasa nada"). Con el modal ya abierto en
    // el siguiente tick, un Esc posterior lo cierra normalmente (y cuenta
    // como "Cancelar", que es lo esperado).
    window.setTimeout(() => {
      if (terminado) return;
      window.EpeModal.open({
        titulo: 'Antes de salir',
        contenido,
        onClose: () => cerrar({ salir: false, restaurado: false }),
      });
    }, 0);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Puente para scripts clásicos (namespace, mismo criterio que el resto de
// la plataforma mientras conviven módulos ES y scripts clásicos).
// ─────────────────────────────────────────────────────────────────────────
window.EpeConfigurarDispositivo = { abrir, confirmarSalida };
