// @ts-check
/**
 * Compatibilizar un recurso EXTERNO (de terceros) con un dispositivo
 * dis+capacidad.
 *
 * Un recurso externo vive en otro sitio: no podemos exponerle una función de
 * "salir" ni restaurar el dispositivo desde ahí. Entonces el flujo es:
 *
 *   1. Desde el detalle del recurso (modal previo a abrir la página externa),
 *      se abre el widget "Configurar dispositivo" con las teclas que el
 *      recurso declara (ej. las 4 flechas): la persona elige a qué botón del
 *      dispositivo va cada una. El widget hace el respaldo antes de tocar nada.
 *   2. Se abre el recurso en una pestaña nueva.
 *   3. En ESTA pestaña de la plataforma queda un modal bloqueado con el botón
 *      «Restaurar»: al volver, la persona restaura el dispositivo.
 *   4. Por si la pestaña se cierra o se recarga antes de restaurar, el
 *      respaldo se guarda en localStorage (ver pendiente.js): la próxima vez
 *      que se abra la página de terceros se ofrece reconectar y restaurar.
 *
 * Módulo ES. Se usa desde scripts clásicos vía el puente
 * `window.EpeDispositivoExterno` (ver el final del archivo).
 */

import { abrir } from './widget.js';
import {
  crearConexionUsb,
  crearConexionBle,
  snapshotATexto,
  snapshotDeTexto,
  TransporteUsb,
  TransporteBle,
} from '../dispositivo/index.js';
import { validarTeclas, urlSegura } from './teclas-externas.js';
import * as pendiente from './pendiente.js';

/**
 * @typedef {Object} ContextoRestauracion
 * @property {string} nombre
 * @property {string | null} url
 * @property {string} snapshotTexto
 * @property {(() => Promise<{ ok: boolean, diferencias: any[] }>) | null} enMemoria
 *   Restaurar con la conexión que sigue abierta en esta pestaña (null después de recargar).
 * @property {'activo' | 'error-al-aplicar' | 'recuperado'} origen
 */

/** `true` mientras hay un modal de restauración abierto en esta pestaña. */
let hayModalAbierto = false;

function almacen() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * @param {string} tag
 * @param {string} [clase]
 * @param {string} [texto]
 */
function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}

/** @param {BeforeUnloadEvent} ev */
function avisarAntesDeIrse(ev) {
  ev.preventDefault();
  ev.returnValue = '';
}

/**
 * ¿Este recurso declara teclas válidas? (decide si se muestra "Compatible
 * dis+capacidad" y el botón de configurar).
 * @param {{ teclas?: unknown }} app
 */
export function soporta(app) {
  return !!app && validarTeclas(app.teclas) !== null;
}

/** ¿Hay una restauración guardada de una sesión anterior? */
export function hayPendiente() {
  return pendiente.leer(almacen()) !== null;
}

/**
 * Lleva el flujo completo (ver el encabezado). Devuelve lo que devolvió el
 * widget; `ok:false` si se canceló antes de tocar el dispositivo.
 * @param {{ nombre: string, url?: string, teclas?: unknown }} app
 */
export async function configurarYAbrir(app) {
  const teclas = validarTeclas(app && app.teclas);
  if (!teclas) return { ok: false, motivo: 'teclas-invalidas' };
  const url = urlSegura(app.url);

  const r = await abrir(teclas, {
    titulo: 'Configurar dispositivo',
    externo: { nombre: app.nombre },
  });

  // Sin snapshot ni `restaurar` no se aplicó nada (canceló, o deshizo desde el widget).
  if (!r.snapshot || !r.restaurar) return r;

  const snapshotTexto = snapshotATexto(/** @type {any} */ (r.snapshot));
  pendiente.guardar(almacen(), {
    nombre: app.nombre,
    url,
    snapshotTexto,
    creadoEn: new Date().toISOString(),
  });

  // Esto corre en el mismo gesto del clic en «Abrir recurso» (la activación
  // del usuario dura unos segundos), así que el navegador no lo bloquea.
  // Con `noopener` window.open siempre devuelve null: no se puede saber si
  // se bloqueó, por eso el modal de abajo trae un link para abrirlo de nuevo.
  if (r.continuar && url) window.open(url, '_blank', 'noopener,noreferrer');

  mostrarRestauracion({
    nombre: app.nombre,
    url,
    snapshotTexto,
    enMemoria: r.restaurar,
    origen: r.continuar ? 'activo' : 'error-al-aplicar',
  });
  return r;
}

/**
 * Si quedó una restauración guardada de antes (pestaña cerrada o recargada
 * con el dispositivo ya reconfigurado), ofrece restaurarla.
 */
export function revisarPendiente() {
  if (hayModalAbierto) return;
  const p = pendiente.leer(almacen());
  if (!p) return;
  mostrarRestauracion({
    nombre: p.nombre,
    url: urlSegura(p.url),
    snapshotTexto: p.snapshotTexto,
    enMemoria: null,
    origen: 'recuperado',
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Modal de restauración (bloqueado: no se cierra con Esc ni clic afuera)
// ─────────────────────────────────────────────────────────────────────────

/** @param {ContextoRestauracion} ctx */
function mostrarRestauracion(ctx) {
  if (!window.EpeModal) return;
  hayModalAbierto = true;
  window.addEventListener('beforeunload', avisarAntesDeIrse);

  const contenido = el('div', 'epe-cd');
  const intro = el(
    'p',
    'epe-cd-intro',
    ctx.origen === 'recuperado'
      ? `La última vez, el dispositivo quedó configurado para «${ctx.nombre}», un recurso externo, y no se restauró.`
      : ctx.origen === 'error-al-aplicar'
        ? `No se pudo terminar de configurar el dispositivo para «${ctx.nombre}». Conviene dejarlo como estaba.`
        : `El dispositivo quedó con los botones asignados a «${ctx.nombre}», un recurso externo.`,
  );
  contenido.appendChild(intro);
  contenido.appendChild(
    el(
      'p',
      'epe-cd-aviso',
      ctx.origen === 'recuperado'
        ? 'Presioná «Restaurar» para devolver el dispositivo a como estaba. Hay que reconectarlo.'
        : 'Cuando termines, volvé a esta pestaña de la plataforma y presioná «Restaurar» para devolver el dispositivo a como estaba.',
    ),
  );

  if (ctx.url && ctx.origen !== 'error-al-aplicar') {
    const enlace = /** @type {HTMLAnchorElement} */ (el('a', 'epe-btn-ghost epe-btn-sm', `Abrir de nuevo «${ctx.nombre}»`));
    enlace.href = ctx.url;
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    enlace.style.alignSelf = 'flex-start';
    contenido.appendChild(enlace);
  }

  const estado = el('div', 'epe-cd-estado');
  const acciones = el('div', 'epe-cd-botones');
  contenido.appendChild(estado);
  contenido.appendChild(acciones);

  function cerrarModal() {
    hayModalAbierto = false;
    window.removeEventListener('beforeunload', avisarAntesDeIrse);
    window.EpeModal.close();
  }

  /** @param {'ok' | 'error' | 'aviso' | 'intro'} tipo @param {string} texto */
  function decir(tipo, texto) {
    estado.innerHTML = '';
    estado.appendChild(el('p', `epe-cd-${tipo}`, texto));
  }

  function hecho() {
    pendiente.borrar(almacen());
    acciones.innerHTML = '';
    decir('ok', 'Listo, el dispositivo quedó como estaba antes.');
    const cerrar = el('button', 'epe-btn-acc', 'Cerrar');
    cerrar.setAttribute('type', 'button');
    cerrar.addEventListener('click', cerrarModal);
    acciones.appendChild(cerrar);
  }

  /** @param {{ ok: boolean, diferencias: any[] }} r */
  function resultado(r) {
    if (r.ok) {
      hecho();
      return;
    }
    decir(
      'error',
      `Quedó distinto en ${r.diferencias.length} campo(s): puede que el dispositivo no haya podido volver a algún valor exacto. Podés reintentar.`,
    );
    mostrarAcciones();
  }

  /** Restaura leyendo el respaldo guardado, reconectando el dispositivo. @param {'usb' | 'ble'} tipo */
  async function restaurarReconectando(tipo) {
    acciones.innerHTML = '';
    decir('intro', 'Conectando…');
    try {
      const { conexion } = tipo === 'usb' ? crearConexionUsb() : crearConexionBle();
      if (tipo === 'usb') {
        // Primero sin selector (puerto ya autorizado); si no hay, con selector.
        await conexion.conectar({ silencioso: true }).catch(() => conexion.conectar());
      } else {
        await conexion.conectar();
      }
      decir('intro', 'Restaurando…');
      resultado(await conexion.restaurar(snapshotDeTexto(ctx.snapshotTexto)));
    } catch (e) {
      const cancelado = e && /** @type {any} */ (e).codigo === 'cancelado';
      decir('error', cancelado ? 'Se canceló la conexión.' : `No se pudo restaurar: ${(e && /** @type {any} */ (e).message) || e}`);
      mostrarAcciones(true);
    }
  }

  async function restaurarEnMemoria() {
    acciones.innerHTML = '';
    decir('intro', 'Restaurando…');
    try {
      const enMemoria = /** @type {NonNullable<ContextoRestauracion['enMemoria']>} */ (ctx.enMemoria);
      resultado(await enMemoria());
    } catch {
      // La conexión que seguía abierta ya no responde (se desenchufó, la
      // pestaña estuvo suspendida…): se vuelve a conectar con el respaldo guardado.
      decir('aviso', 'Se perdió la conexión con el dispositivo. Reconectalo para restaurarlo.');
      mostrarAcciones(true);
    }
  }

  /** @param {boolean} [forzarReconectar] */
  function mostrarAcciones(forzarReconectar = false) {
    acciones.innerHTML = '';
    const puedeEnMemoria = !!ctx.enMemoria && !forzarReconectar;
    if (puedeEnMemoria) {
      const b = el('button', 'epe-btn-acc', 'Restaurar dispositivo');
      b.setAttribute('type', 'button');
      b.addEventListener('click', restaurarEnMemoria);
      acciones.appendChild(b);
    } else {
      const usb = el('button', 'epe-btn-acc', 'Restaurar por USB');
      usb.setAttribute('type', 'button');
      /** @type {HTMLButtonElement} */ (usb).disabled = !TransporteUsb.disponible();
      usb.addEventListener('click', () => restaurarReconectando('usb'));
      acciones.appendChild(usb);
      const ble = el('button', 'epe-btn-ghost', 'Restaurar por Bluetooth');
      ble.setAttribute('type', 'button');
      /** @type {HTMLButtonElement} */ (ble).disabled = !TransporteBle.disponible();
      ble.addEventListener('click', () => restaurarReconectando('ble'));
      acciones.appendChild(ble);
    }

    // Dejar el dispositivo así: pide una segunda confirmación (no se puede deshacer desde acá).
    const dejar = el('button', 'epe-btn-ghost', 'Dejar configurado así');
    dejar.setAttribute('type', 'button');
    let confirmando = false;
    dejar.addEventListener('click', () => {
      if (!confirmando) {
        confirmando = true;
        dejar.textContent = 'Sí, dejar así (no se restaura)';
        decir('aviso', 'El dispositivo va a seguir con estos botones asignados hasta que lo restaures desde el configurador.');
        return;
      }
      pendiente.borrar(almacen());
      cerrarModal();
    });
    acciones.appendChild(dejar);
  }

  mostrarAcciones();

  window.EpeModal.open({
    titulo: `Dispositivo configurado para «${ctx.nombre}»`,
    contenido,
    bloqueado: true,
  });
}

// Puente para scripts clásicos (mismo criterio que widget.js).
/** @type {any} */ (window).EpeDispositivoExterno = {
  soporta,
  hayPendiente,
  configurarYAbrir,
  revisarPendiente,
};
