// @ts-check
/**
 * Widget "Configurar dispositivo" (paso 2 del roadmap, 26/09/2026).
 *
 * Lo que hace: detecta un dispositivo dis+ conectado, y para cada acción que
 * la app que lo invoca necesita ({ id, etiqueta, tecla } o un requisito de mouse/cursor) le pregunta al
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
 * Criterio: configurar el dispositivo de la forma MÁS SIMPLE y solo para usar
 * el recurso en concreto. Pregunta únicamente lo imprescindible (con qué
 * botón se hace cada cosa; para arrastrar, cómo) y, si el recurso pide mover
 * el cursor, muestra velocidad y aceleración. La personalización detallada
 * es del configurador, no de este asistente.
 *
 * Un botón, dos eventos (Tap-Hold): si la app lo pide (`abrir(entradas,
 * { combinar: true })`) o la acción lo declara (`combinable: true`, recursos de
 * terceros) y el firmware lo soporta, un evento puede asignarse como pulsación
 * larga de un botón ya elegido para otro (toque corto). Para combinar dos
 * acciones, las dos tienen que admitirlo. Es opt-in: sin eso el flujo es
 * exactamente el de siempre. Guía completa: README.md de esta carpeta.
 *
 * Fuera de alcance (a propósito): guardar el perfil (paso 4 del roadmap, con
 * la tabla en Supabase).
 */

import {
  TransporteUsb,
  TransporteBle,
  productoPorModelo,
  todasLasEntradas,
} from '../dispositivo/index.js';
import {
  conectarCompartida,
  obtenerActiva,
  soltarActivas,
  respaldoOriginal,
  olvidarRespaldoOriginal,
} from './conexion-activa.js';
import {
  admiteCombinar,
  armarComandos,
  candidatasParaLarga,
  cuantasEntran,
  cursorInicial,
  describir,
  describirCombinado,
  pideCursor,
  requisitosConBoton,
  umbralEfectivo,
  TH_DEFAULT_MS,
  TH_MIN_MS,
  TH_MAX_MS,
  VEL_MIN,
  VEL_MAX,
} from './comandos.js';

/** Códigos de flecha (ver productos.js: solo asignables una por una si FMODE=0). */
const CODIGOS_FLECHA = ['FU', 'FD', 'FL', 'FR'];

/** @typedef {import('./teclas-externas.js').Requisito} Requisito */

// ─────────────────────────────────────────────────────────────────────────
// Textos según para qué se abre el widget: un juego propio (Apps EpE) o un
// recurso externo de terceros (ver `externo` en `abrir()`). Un recurso
// externo cambia el vocabulario y suma un aviso: el dispositivo se restaura
// desde la pestaña de la plataforma, no desde el recurso.
// ─────────────────────────────────────────────────────────────────────────
const TEXTOS_JUEGO = {
  sujeto: 'el juego',
  conectar:
    'Conectá el dispositivo de dis+capacidad (disMouse, disHub…) para dejarlo listo para este juego.',
  exito: 'Listo, el dispositivo ya está configurado para este juego.',
  continuar: 'Empezar',
  aviso: null,
};

/** @param {string} nombre */
function textosExterno(nombre) {
  return {
    sujeto: 'el recurso',
    conectar: `Conectá el dispositivo de dis+capacidad (disMouse, disHub…) para dejarlo listo para «${nombre}».`,
    exito: `Listo, el dispositivo ya está configurado para «${nombre}».`,
    continuar: 'Abrir recurso',
    aviso:
      'Como es un recurso externo, para restaurar el dispositivo tenés que volver a esta pestaña de la ' +
      'plataforma y presionar «Restaurar». No la cierres mientras usás el recurso.',
  };
}

/** Textos del widget abierto ahora (hay un solo widget a la vez: comparte el modal). */
let T = TEXTOS_JUEGO;
/** ¿La app que abrió el widget permite combinar TODAS sus acciones? (ver `abrir`; cada acción puede además declarar `combinable`). */
let combinar = false;
/** Respaldo guardado de una sesión anterior (ver `abrir`). @type {any} */
let originalPrevio = null;
/** Estado ORIGINAL del dispositivo: adonde vuelve "restaurar" (ver conexion-activa.js). @type {any} */
let destino = null;

/** Restaura al estado original y, si quedó idéntico, lo da por resuelto. */
async function restaurarOriginal(conexion, snapshot) {
  const r = await conexion.restaurar(destino || snapshot);
  if (r.ok) olvidarRespaldoOriginal(conexion);
  return r;
}

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
 * @param {Requisito[]} entradas Lo que la app necesita ahora mismo (ver teclas-externas.js).
 * @param {{ titulo?: string, externo?: { nombre: string }, originalPrevio?: any, combinar?: boolean }} [opciones]
 *   `combinar`: la app acepta que un botón dé dos eventos (toque y pulsación larga)
 *   en todas sus acciones. Una acción también puede declararlo ella sola con
 *   `combinable: true`. Solo se ofrece si además el firmware conectado soporta
 *   Tap-Hold. Opt-in.
 *   `originalPrevio`: respaldo del estado original guardado en una sesión anterior
 *   (se usa como destino de "restaurar" si es del mismo modelo).
 *   `externo`: se abre para un recurso de terceros (cambia los textos y suma
 *   el aviso de cómo restaurar; ver `textosExterno`).
 * @returns {Promise<{ ok: boolean, motivo?: string, snapshot?: object, restaurar?: () => Promise<{ok: boolean, diferencias: any[]}>, continuar?: boolean, combinados?: { corto: string, largo: string, umbral: number }[] }>}
 *   `ok:true` cuando se aplicó una configuración nueva y el usuario cerró el
 *   widget conforme. Si aplicó y no deshizo dentro del propio widget, viene
 *   también `restaurar`: una función ya lista (atada a esa conexión y a ese
 *   snapshot) para devolver el dispositivo a como estaba, pensada para que la
 *   app la llame más tarde (por ejemplo al salir del juego). `continuar:true`
 *   cuando el usuario ya eligió "Empezar" desde el propio modal de éxito: la
 *   app puede arrancar el juego directo, sin pedirle un segundo click. `ok:false`
 *   si se canceló antes de aplicar nada. `combinados` (solo si se aplicó) lista
 *   los botones que quedaron con dos eventos: `corto` y `largo` son los `id` de
 *   las acciones y `umbral` los ms desde los que cuenta como pulsación larga.
 *   Vacío o ausente = ningún botón combinado (la app no necesita hacer nada).
 */
export function abrir(entradasPedidas, opciones = {}) {
  originalPrevio = opciones.originalPrevio || null;
  combinar = opciones.combinar === true;
  destino = null;
  // Las Apps EpE siguen pasando `{ id, etiqueta, tecla }` sin `tipo`: son teclas.
  const entradas = (entradasPedidas || []).map((e) => (e && e.tipo ? e : { ...e, tipo: 'tecla' }));
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

    // Si el dispositivo ya está conectado en esta página (por un juego o recurso
    // anterior), se salta el paso de conectar: no hace falta volver a elegirlo.
    const activa = obtenerActiva();
    if (activa && activa.conexion.info) {
      despuesDeConectar(cuerpo, entradas, cerrar, cabecera, activa.conexion, activa.conexion.info);
    } else {
      pasoConectar(cuerpo, entradas, cerrar, cabecera);
    }
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

  try {
    // Reutiliza la conexión ya abierta en esta página, si la hay (ver conexion-activa.js).
    const { conexion, info } = await conectarCompartida(tipo);
    despuesDeConectar(raiz, entradas, cerrar, cabecera, conexion, info);
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

/** Ya hay una conexión abierta: reconoce el modelo y sigue con el respaldo. */
function despuesDeConectar(raiz, entradas, cerrar, cabecera, conexion, info) {
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
}

// ─────────────────────────────────────────────────────────────────────────
// Paso 2: respaldo obligatorio (no hay "aplicar sin guardar" en este protocolo)
// ─────────────────────────────────────────────────────────────────────────

async function pasoSnapshot(raiz, entradas, cerrar, conexion, producto, cabecera) {
  raiz.innerHTML = '';
  raiz.appendChild(el('p', 'epe-cd-intro', 'Leyendo la configuración actual del dispositivo…'));
  try {
    const actual = await conexion.tomarSnapshot();
    // `actual` es lo que tiene el dispositivo ahora (sirve para los valores iniciales
    // de los controles). Pero el destino de "restaurar" es el estado ORIGINAL: si
    // ya se configuró otro recurso antes sin restaurar, `actual` ya no es el original.
    // `originalPrevio` es un respaldo guardado de una sesión anterior (misma máquina
    // y modelo), por si se recargó la página con el dispositivo sin restaurar.
    const previo = originalPrevio;
    const candidato = previo && previo.modelo === actual.modelo ? previo : actual;
    destino = respaldoOriginal(conexion, candidato);
    const snapshot = actual;
    // Si el recurso pide mover el cursor con las flechas, las flechas quedan
    // reservadas para eso y solo se ofrecen los botones principales. Si no, se
    // ofrecen todas las entradas: si el usuario asigna una flecha, "Aplicar"
    // pone el dispositivo en modo botones individuales (FMODE:0) para que se
    // pueda configurar una por una (ver entradasAsignables en productos.js).
    const disponibles = pideCursor(entradas) ? producto.botones : todasLasEntradas(producto);
    pasoAsignar(raiz, entradas, cerrar, conexion, producto, snapshot, disponibles);
  } catch (e) {
    // La conexión puede haber quedado en mal estado: se suelta para que
    // "Volver a intentar" abra una nueva en lugar de repetir el mismo fallo.
    await soltarActivas();
    raiz.innerHTML = '';
    raiz.appendChild(
      el('p', 'epe-cd-error', `No se pudo leer el dispositivo: ${(e && e.message) || e}`),
    );
    agregarVolver(raiz, () => pasoConectar(raiz, entradas, cerrar, cabecera));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Paso 3: elegir con qué botón se hace cada cosa que el recurso necesita.
// Solo se pregunta lo imprescindible: qué botón (y, para arrastrar, cómo).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Una opción de radio con título y detalle (mismo estilo que la lista de botones).
 * @param {string} nombre
 * @param {string} valor
 * @param {string} titulo
 * @param {string} detalle
 * @param {() => void} alElegir
 */
function opcionRadio(nombre, valor, titulo, detalle, alElegir) {
  const label = el('label', 'epe-cd-entrada');
  const radio = el('input');
  radio.type = 'radio';
  radio.name = nombre;
  radio.value = valor;
  radio.addEventListener('change', alElegir);
  const texto = el('span', 'epe-cd-entrada-texto');
  texto.appendChild(el('strong', null, titulo));
  texto.appendChild(el('small', null, detalle));
  label.appendChild(radio);
  label.appendChild(texto);
  return label;
}

function pasoAsignar(raiz, entradas, cerrar, conexion, producto, snapshot, disponibles) {
  const pedidas = requisitosConBoton(entradas);
  // Un botón puede dar dos eventos (toque + pulsación larga) solo si la app lo
  // permite Y el firmware lo soporta (ver `abrir`).
  const firmwareConTapHold = !!(conexion.info && conexion.info.soportaTapHold);
  const combinables = pedidas.filter((r) => admiteCombinar(r, combinar));
  // Para compartir botón hacen falta al menos dos acciones que lo admitan.
  const conLarga = firmwareConTapHold && combinables.length >= 2;
  let aUsar = pedidas.slice(0, cuantasEntran(pedidas, disponibles.length, conLarga, combinar));
  const capacidad = aUsar.length;
  /** @type {{ requisito: Requisito, codigo: string, largo?: Requisito|null, umbral?: number }[]} */
  const asignaciones = [];
  /** Historial para "Atrás": cada paso fue un botón nuevo o una larga sumada a uno. */
  /** @type {{ tipo: 'boton'|'larga', asignacion: any }[]} */
  const pasos = [];
  /** @type {import('./comandos.js').Arrastre | undefined} */
  let arrastre;

  function atras(idx) {
    const ultimo = pasos.pop();
    if (ultimo) {
      if (ultimo.tipo === 'larga') {
        ultimo.asignacion.largo = null;
        ultimo.asignacion.umbral = undefined;
      } else {
        asignaciones.splice(asignaciones.indexOf(ultimo.asignacion), 1);
      }
    }
    pedir(idx - 1);
  }

  function filaBotonesBasica(onAtras) {
    const filaBotones = el('div', 'epe-cd-botones');
    if (onAtras) {
      const btnAtras = el('button', 'epe-btn-ghost', 'Atrás');
      btnAtras.type = 'button';
      btnAtras.addEventListener('click', onAtras);
      filaBotones.appendChild(btnAtras);
    }
    const btnCancelar = el('button', 'epe-btn-ghost', 'Cancelar');
    btnCancelar.type = 'button';
    btnCancelar.addEventListener('click', () => cerrar({ ok: false, motivo: 'cancelado' }));
    filaBotones.appendChild(btnCancelar);
    return filaBotones;
  }

  // Arrastrar y soltar se puede hacer de dos formas con el mismo botón de clic.
  function preguntarArrastre(idx) {
    raiz.innerHTML = '';
    raiz.appendChild(el('p', 'epe-cd-intro', 'Para arrastrar y soltar, ¿cómo preferís usar el botón?'));
    const lista = el('div', 'epe-cd-lista-entradas');
    lista.appendChild(
      opcionRadio(
        'epe-cd-arrastre',
        'toque',
        'Un toque agarra y otro toque suelta',
        'No hace falta mantener el botón apretado mientras movés el cursor.',
        () => {
          arrastre = 'toque';
          pedir(idx);
        },
      ),
    );
    lista.appendChild(
      opcionRadio(
        'epe-cd-arrastre',
        'mantener',
        'Mantener el botón presionado',
        'Agarra mientras lo mantenés apretado y suelta cuando lo largás.',
        () => {
          arrastre = 'mantener';
          pedir(idx);
        },
      ),
    );
    raiz.appendChild(lista);
    raiz.appendChild(filaBotonesBasica(idx > 0 ? () => atras(idx) : null));
  }

  function pedir(idx) {
    if (idx >= aUsar.length) {
      pasoResumen(raiz, entradas, aUsar, asignaciones, arrastre, cerrar, conexion, producto, snapshot);
      return;
    }
    const entrada = aUsar[idx];
    // Compartir botón: solo si las dos acciones lo admiten y son compatibles.
    const candidatas =
      conLarga && admiteCombinar(entrada, combinar)
        ? candidatasParaLarga(asignaciones, entrada).filter((c) => admiteCombinar(c.requisito, combinar))
        : [];
    // Sin botón libre ni botón con el que combinar: no hay dónde ubicar este
    // evento (ni los que siguen). Se pasa al resumen y quedan como sin configurar.
    const hayLibre = disponibles.some((d) => !asignaciones.find((a) => a.codigo === d.codigo));
    if (!hayLibre && !candidatas.length) {
      aUsar = aUsar.slice(0, idx);
      pasoResumen(raiz, entradas, aUsar, asignaciones, arrastre, cerrar, conexion, producto, snapshot);
      return;
    }
    if (entrada.tipo === 'arrastrar' && !arrastre) {
      preguntarArrastre(idx);
      return;
    }
    raiz.innerHTML = '';

    if (idx === 0 && pedidas.length > capacidad) {
      raiz.appendChild(
        el(
          'p',
          'epe-cd-aviso',
          `Este dispositivo permite ${capacidad} ${capacidad === 1 ? 'evento' : 'eventos'} y ${T.sujeto} necesita ${pedidas.length}. ` +
            `Se van a asignar los primeros ${capacidad}; el resto queda sin configurar.`,
        ),
      );
    }
    if (idx === 0 && conLarga && pedidas.length > 1) {
      raiz.appendChild(
        el(
          'p',
          'epe-cd-intro',
          combinar
            ? 'Este dispositivo permite dos eventos por botón (toque y pulsación larga): después del primero, ' +
                'vas a poder asignar otro evento como pulsación larga de un botón ya elegido.'
            : `Este dispositivo permite dos eventos por botón (toque y pulsación larga) y ${T.sujeto} admite ` +
                'que algunas de sus acciones lo usen: después de elegir una de ellas, vas a poder asignar otra ' +
                'como pulsación larga del mismo botón.',
        ),
      );
    } else if (
      idx === 0 &&
      combinables.length >= 2 &&
      !firmwareConTapHold &&
      pedidas.length > disponibles.length
    ) {
      raiz.appendChild(
        el(
          'p',
          'epe-cd-aviso',
          'Con un firmware que soporte Tap-Hold, un mismo botón podría dar dos eventos (toque y pulsación ' +
            'larga) y entrarían todos. Actualizá el firmware desde el configurador si querés usarlo.',
        ),
      );
    }

    raiz.appendChild(
      el(
        'p',
        'epe-cd-intro',
        `Elegí a qué botón asignar «${entrada.etiqueta}» (${describir(entrada, arrastre)}):`,
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
        const nueva = { requisito: entrada, codigo: d.codigo };
        asignaciones.push(nueva);
        pasos.push({ tipo: 'boton', asignacion: nueva });
        pedir(idx + 1);
      });
      const punto = el('span', 'epe-cd-color');
      punto.style.backgroundColor = d.color;
      const texto = el('span', 'epe-cd-entrada-texto');
      texto.appendChild(el('strong', null, d.etiqueta));
      if (yaUsada) texto.appendChild(el('small', null, `ya asignado a «${yaUsada.requisito.etiqueta}»`));
      else if (d.nota) texto.appendChild(el('small', null, d.nota));
      label.appendChild(radio);
      label.appendChild(punto);
      label.appendChild(texto);
      lista.appendChild(label);
    });
    raiz.appendChild(lista);

    // Un botón, dos eventos: este evento como pulsación larga de un botón ya asignado.
    if (candidatas.length) {
      raiz.appendChild(el('p', 'epe-cd-intro', 'O como pulsación larga de un botón que ya elegiste:'));
      const listaLarga = el('div', 'epe-cd-lista-entradas');
      candidatas.forEach((c) => {
        const d = disponibles.find((x) => x.codigo === c.codigo);
        const label = el('label', 'epe-cd-entrada');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = 'epe-cd-entrada';
        radio.value = `larga:${c.codigo}`;
        radio.addEventListener('change', () => {
          c.largo = entrada;
          c.umbral = TH_DEFAULT_MS;
          pasos.push({ tipo: 'larga', asignacion: c });
          pedir(idx + 1);
        });
        const punto = el('span', 'epe-cd-color');
        if (d) punto.style.backgroundColor = d.color;
        const texto = el('span', 'epe-cd-entrada-texto');
        texto.appendChild(el('strong', null, `Pulsación larga de ${d ? d.etiqueta : c.codigo}`));
        texto.appendChild(el('small', null, `El toque corto de este botón es «${c.requisito.etiqueta}».`));
        label.appendChild(radio);
        label.appendChild(punto);
        label.appendChild(texto);
        listaLarga.appendChild(label);
      });
      raiz.appendChild(listaLarga);
    }

    raiz.appendChild(filaBotonesBasica(idx > 0 ? () => atras(idx) : null));
  }

  pedir(0);
}

// ─────────────────────────────────────────────────────────────────────────
// Paso 4: resumen y aplicar. Si el recurso pide mover el cursor, acá mismo
// están los dos únicos controles: velocidad y aceleración.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Velocidad (deslizador) y aceleración (casilla) del cursor.
 * @param {{ vel: number, acel: boolean }} inicial
 */
function crearControlesCursor(inicial) {
  const caja = el('div', 'epe-cd-controles');

  const filaVel = el('div', 'epe-cd-control');
  const etiquetaVel = el('label', null, 'Velocidad del cursor');
  etiquetaVel.htmlFor = 'epe-cd-vel';
  const slider = el('input');
  slider.type = 'range';
  slider.id = 'epe-cd-vel';
  slider.min = String(VEL_MIN);
  slider.max = String(VEL_MAX);
  slider.step = '1';
  slider.value = String(inicial.vel);
  const valor = el('output', 'epe-cd-control-valor', String(inicial.vel));
  valor.htmlFor = 'epe-cd-vel';
  slider.addEventListener('input', () => {
    valor.textContent = slider.value;
  });
  filaVel.appendChild(etiquetaVel);
  filaVel.appendChild(slider);
  filaVel.appendChild(valor);
  caja.appendChild(filaVel);

  const filaAcel = el('label', 'epe-cd-control epe-cd-control-check');
  const casilla = el('input');
  casilla.type = 'checkbox';
  casilla.checked = inicial.acel;
  filaAcel.appendChild(casilla);
  filaAcel.appendChild(el('span', null, 'Aceleración (el cursor va más rápido cuanto más tiempo se mantiene la flecha)'));
  caja.appendChild(filaAcel);

  return {
    el: caja,
    leer: () => ({ vel: parseInt(slider.value, 10) || inicial.vel, acel: casilla.checked }),
  };
}

function pasoResumen(raiz, entradas, aUsar, asignaciones, arrastre, cerrar, conexion, producto, snapshot) {
  raiz.innerHTML = '';
  const conCursor = pideCursor(entradas);
  raiz.appendChild(el('p', 'epe-cd-intro', 'Así va a quedar configurado el dispositivo:'));

  const lista = el('ul', 'epe-cd-resumen');
  if (conCursor) lista.appendChild(el('li', null, 'Las flechas del dispositivo → mueven el cursor'));
  /** Botones con dos eventos: cada uno tiene su umbral ajustable. */
  const combinados = [];
  asignaciones.forEach((a) => {
    const entradaInfo = [...producto.botones, ...producto.secundarias].find(
      (d) => d.codigo === a.codigo,
    );
    const nombre = entradaInfo ? entradaInfo.etiqueta : a.codigo;
    const texto = () =>
      a.largo
        ? `${nombre} → ${describirCombinado(a.requisito, a.largo, a.umbral)}`
        : `${nombre} → ${a.requisito.etiqueta} (${describir(a.requisito, arrastre)})`;
    const li = el('li', null, texto());
    lista.appendChild(li);
    if (a.largo) combinados.push({ a, nombre, li, texto });
  });
  raiz.appendChild(lista);

  if (combinados.length) {
    const caja = el('div', 'epe-cd-controles');
    combinados.forEach(({ a, nombre, li, texto }, i) => {
      const fila = el('div', 'epe-cd-control');
      const etiqueta = el('label', null, `Desde cuándo es pulsación larga (${nombre})`);
      etiqueta.htmlFor = `epe-cd-umbral-${i}`;
      const slider = el('input');
      slider.type = 'range';
      slider.id = `epe-cd-umbral-${i}`;
      slider.min = String(TH_MIN_MS);
      slider.max = String(TH_MAX_MS);
      slider.step = '50';
      slider.value = String(umbralEfectivo(a.umbral));
      const valor = el('output', 'epe-cd-control-valor', `${slider.value} ms`);
      valor.htmlFor = slider.id;
      slider.addEventListener('input', () => {
        a.umbral = parseInt(slider.value, 10);
        valor.textContent = `${slider.value} ms`;
        li.textContent = texto();
      });
      fila.appendChild(etiqueta);
      fila.appendChild(slider);
      fila.appendChild(valor);
      caja.appendChild(fila);
    });
    raiz.appendChild(caja);
    raiz.appendChild(
      el(
        'p',
        'epe-cd-aviso',
        'Si soltás el botón antes de ese tiempo cuenta como toque; si lo mantenés más, como pulsación larga.',
      ),
    );
  }

  const controles = conCursor ? crearControlesCursor(cursorInicial(snapshot && snapshot.cfg)) : null;
  if (controles) raiz.appendChild(controles.el);

  const pedidas = requisitosConBoton(entradas);
  if (pedidas.length > aUsar.length) {
    const sinAsignar = pedidas.slice(aUsar.length).map((e) => e.etiqueta);
    raiz.appendChild(
      el('p', 'epe-cd-aviso', `Sin configurar (no alcanzaron los botones): ${sinAsignar.join(', ')}.`),
    );
  }

  const necesitaModoIndividual =
    !conCursor &&
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
    aplicar(
      raiz,
      cerrar,
      conexion,
      armarComandos({
        asignaciones,
        cursor: controles ? controles.leer() : null,
        arrastre,
        modoIndividual: necesitaModoIndividual,
      }),
      snapshot,
      // Se calcula al apretar «Aplicar»: los umbrales pudieron cambiar en el resumen.
      () =>
        asignaciones
          .filter((a) => a.largo)
          .map((a) => ({ corto: a.requisito.id, largo: /** @type {Requisito} */ (a.largo).id, umbral: umbralEfectivo(a.umbral) })),
    ),
  );
  filaBotones.appendChild(btnAplicar);
  const btnCancelar = el('button', 'epe-btn-ghost', 'Cancelar');
  btnCancelar.type = 'button';
  btnCancelar.addEventListener('click', () => cerrar({ ok: false, motivo: 'cancelado' }));
  filaBotones.appendChild(btnCancelar);
  raiz.appendChild(filaBotones);
}

async function aplicar(raiz, cerrar, conexion, comandos, snapshot, leerCombinados) {
  raiz.innerHTML = '';
  raiz.appendChild(el('p', 'epe-cd-intro', 'Aplicando…'));

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
      cerrar({
        ok: true,
        snapshot: destino || snapshot,
        restaurar: () => restaurarOriginal(conexion, snapshot),
        continuar: exito,
        combinados: leerCombinados(),
      }),
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
    const r = await restaurarOriginal(conexion, snapshot);
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
