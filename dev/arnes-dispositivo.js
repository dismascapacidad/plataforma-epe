// @ts-check
/**
 * arnes-dispositivo.js
 * Arnés de prueba con hardware del núcleo del dispositivo (herramienta de
 * desarrollo). Usa el núcleo REAL (js/features/dispositivo/) tal como lo va a
 * usar el widget: no reimplementa nada de protocolo ni de conexión.
 *
 * Reglas de seguridad de esta página (cada comando queda guardado en la
 * memoria del dispositivo, ver conexion.js):
 *  - Nada se escribe sin un respaldo cargado y la casilla de confirmación.
 *  - Jamás se manda SAVE ni RESET.
 *  - Toda prueba que escribe termina restaurando el respaldo y RELEYENDO el
 *    dispositivo para comprobar que quedó igual.
 *
 * Modo simulado (sin hardware): abrir `arnes-dispositivo.html?simulado=1`.
 * Parámetros opcionales: `&ble=1` (simula Bluetooth), `&ignora=BR` (el
 * firmware falso ignora los CFG de ese botón, para ver cómo se ve un fallo),
 * `&omite=5,6` (el firmware falso no manda esos botones en GETALL), `&sinwho=1`,
 * `&modelo=disHub%20BLE&firmware=R013`.
 */

import {
  Conexion,
  TransporteUsb,
  TransporteBle,
  crearConexionUsb,
  crearConexionBle,
  elegirApiSerial,
  productoPorModelo,
  resumirConfiguracion,
  comandosDeRestauracion,
  compararConfiguraciones,
  snapshotATexto,
  snapshotDeTexto,
  snapshotACsvDelConfigurador,
} from '../js/features/dispositivo/index.js';
import { TransporteSimulado } from './transporte-simulado.js';

/** @typedef {import('../js/features/dispositivo/configuracion.js').Snapshot} Snapshot */

const CLAVE_RESPALDO = 'epe-arnes-respaldo';

const params = new URLSearchParams(location.search);
const SIMULADO = params.has('simulado');

/** @type {Conexion | null} */
let conexion = null;
/** @type {any} */
let transporte = null;
/** @type {Snapshot | null} */
let snapshot = null;
let ocupado = false;
let desconectandoAPropósito = false;
/** @type {Record<string, string>} */
const resultados = {};

/** @param {string} id */
const $ = (id) => /** @type {any} */ (document.getElementById(id));

/* ─────────────── registro y resumen ─────────────── */

/** @param {string} texto */
function log(texto) {
  const el = $('log');
  el.textContent += `[${new Date().toLocaleTimeString()}] ${texto}\n`;
  el.scrollTop = el.scrollHeight;
}

/**
 * @param {string} clave
 * @param {string} valor
 */
function registrar(clave, valor) {
  resultados[clave] = valor;
  renderResumen();
}

function renderResumen() {
  const lineas = [
    `ARNÉS DEL NÚCLEO DEL DISPOSITIVO — ${new Date().toISOString()}`,
    `modo: ${SIMULADO ? 'SIMULADO (sin hardware)' : 'hardware real'}`,
    `navegador: ${navigator.userAgent}`,
    `contexto seguro: ${window.isSecureContext}`,
    '',
  ];
  for (const [k, v] of Object.entries(resultados)) lineas.push(`${k}: ${v}`);
  $('txt-resumen').value = lineas.join('\n');
}

/* ─────────────── avisos en pantalla ─────────────── */

/** @param {string} texto */
function mostrarError(texto) {
  const b = $('banner-error');
  b.textContent = texto;
  b.hidden = false;
  log(`ERROR: ${texto}`);
}

function limpiarError() {
  $('banner-error').hidden = true;
}

/**
 * @param {string} texto
 * @param {boolean} ok
 */
function mostrarResultado(texto, ok) {
  const r = $('resultado-prueba');
  r.textContent = texto;
  r.className = `arnes-resultado ${ok ? 'ok' : 'mal'}`;
  r.hidden = false;
}

/** @param {any} e */
function textoDeError(e) {
  const codigo = e?.codigo ? `[${e.codigo}] ` : '';
  return `${codigo}${e?.message ?? e}`;
}

/* ─────────────── entorno ─────────────── */

/**
 * @param {HTMLElement} tabla
 * @param {Array<[string, string, ('si' | 'no' | '')?]>} filas
 */
function pintarTabla(tabla, filas) {
  tabla.innerHTML = '';
  for (const [k, v, estilo] of filas) {
    const tr = document.createElement('tr');
    const a = document.createElement('td');
    const b = document.createElement('td');
    a.textContent = k;
    b.textContent = v;
    if (estilo) b.className = estilo;
    tr.append(a, b);
    tabla.append(tr);
  }
}

function pintarEntorno() {
  const api = elegirApiSerial();
  const usb = TransporteUsb.disponible();
  const ble = TransporteBle.disponible();
  pintarTabla($('tabla-entorno'), [
    ['Modo', SIMULADO ? 'simulado (sin hardware)' : 'hardware real', SIMULADO ? '' : 'si'],
    [
      'Contexto seguro (https o localhost)',
      String(window.isSecureContext),
      window.isSecureContext ? 'si' : 'no',
    ],
    ['USB disponible', usb ? `sí (${api?.via ?? '—'})` : 'no', usb ? 'si' : 'no'],
    ['Bluetooth disponible', ble ? 'sí' : 'no', ble ? 'si' : 'no'],
    ['Navegador', navigator.userAgent],
  ]);
  registrar('entorno.usb', usb ? `sí (${api?.via})` : 'no');
  registrar('entorno.ble', ble ? 'sí' : 'no');
}

/* ─────────────── conexión ─────────────── */

/** @param {'usb' | 'ble'} tipo */
function crearConexion(tipo) {
  if (SIMULADO) {
    const ignora = (params.get('ignora') ?? '').split(',').filter(Boolean);
    const t = new TransporteSimulado({
      modelo: params.get('modelo') ?? 'disMouse',
      firmware: params.get('firmware') ?? 'R019-TH1',
      respondeWho: !params.has('sinwho'),
      ignoraCodigos: ignora,
      omiteBotones: (params.get('omite') ?? '').split(',').filter(Boolean).map(Number),
      latenciaMs: 15,
    });
    t.tipo = /** @type {any} */ (tipo);
    if (tipo === 'ble') /** @type {any} */ (t).reconectarEnSilencio = undefined;
    return { conexion: new Conexion(t), transporte: t };
  }
  return tipo === 'usb' ? crearConexionUsb() : crearConexionBle();
}

/**
 * @param {'usb' | 'ble'} tipo
 * @param {{ silencioso?: boolean }} [op]
 */
async function conectar(tipo, op = {}) {
  await ejecutar(`Conectar ${tipo}`, async () => {
    const c = crearConexion(tipo);
    conexion = c.conexion;
    transporte = c.transporte;
    desconectandoAPropósito = false;
    conexion.alRegistro((e) => log(`${e.sentido === 'tx' ? '→' : '←'} ${e.linea}`));
    conexion.alCambioDeEstado((estado) => {
      log(`estado: ${estado}`);
      if (estado === 'desconectado' && !desconectandoAPropósito) {
        mostrarError('Se perdió la conexión con el dispositivo (¿se desenchufó o se apagó?).');
      }
      actualizar();
    });
    try {
      const info = await conexion.conectar(op);
      const via = tipo === 'usb' ? ` vía ${transporte.via ?? 'simulado'}` : '';
      registrar(
        `conexion.${tipo}${op.silencioso ? '.silenciosa' : ''}`,
        `ok${via} — ${info.modelo ?? '(sin WHO)'} ${info.version ?? ''} — WHO en ${info.latenciaWhoMs ?? '—'} ms`,
      );
      pintarInfo(info, tipo);
    } catch (e) {
      conexion = null;
      const cancelado = /** @type {any} */ (e)?.codigo === 'cancelado';
      registrar(
        `conexion.${tipo}${op.silencioso ? '.silenciosa' : ''}`,
        `${cancelado ? 'cancelada' : 'ERROR'} ${textoDeError(e)}`,
      );
      if (!cancelado) throw e;
      log('Se cerró el selector sin elegir un dispositivo.');
    }
  });
}

/**
 * @param {import('../js/features/dispositivo/conexion.js').InfoDispositivo} info
 * @param {'usb' | 'ble'} tipo
 */
function pintarInfo(info, tipo) {
  const tabla = $('tabla-info');
  const vidpid = transporte?.infoPuerto;
  /** @type {Array<[string, string, ('si' | 'no' | '')?]>} */
  const filas = [
    ['Conexión', tipo === 'usb' ? 'USB' : 'Bluetooth', 'si'],
    ['Modelo (WHO)', info.modelo ?? 'no contestó WHO', info.modelo ? 'si' : 'no'],
    ['Versión de firmware', info.version ?? '—'],
    [
      'Producto reconocido',
      info.producto ? info.producto.nombre : 'no',
      info.producto ? 'si' : 'no',
    ],
    ['Tiempo de respuesta a WHO', info.latenciaWhoMs != null ? `${info.latenciaWhoMs} ms` : '—'],
    ['¿Firmware desactualizado?', info.desactualizado ? 'sí' : 'no'],
  ];
  if (vidpid) {
    filas.push([
      'VID / PID USB',
      `0x${vidpid.usbVendorId?.toString(16)} / 0x${vidpid.usbProductId?.toString(16)}`,
    ]);
  }
  pintarTabla(tabla, filas);
  tabla.hidden = false;
}

async function desconectar() {
  if (!conexion) return;
  desconectandoAPropósito = true;
  await ejecutar('Desconectar', async () => {
    await conexion?.desconectar();
    conexion = null;
    $('tabla-info').hidden = true;
  });
}

/* ─────────────── respaldo ─────────────── */

/** @param {string} texto */
function guardarLocal(texto) {
  try {
    localStorage.setItem(CLAVE_RESPALDO, texto);
  } catch {
    /* sin storage: el respaldo igual se puede descargar */
  }
}

/**
 * @param {Snapshot} snap
 * @param {string} origen
 */
function cargarSnapshot(snap, origen) {
  snapshot = snap;
  const producto = productoPorModelo(snap.modelo);
  $('panel-respaldo').hidden = false;
  $('resumen-respaldo').textContent =
    `Respaldo de ${snap.modelo || 'dispositivo'} ${snap.firmware} (${origen}), ` +
    `${snap.lineasCrudas.length} líneas leídas — ${new Date(snap.tomadoEn).toLocaleString()}`;
  if (producto) {
    pintarTabla(
      $('tabla-respaldo'),
      resumirConfiguracion(snap.cfg, producto).map((f) => [f.etiqueta, f.texto]),
    );
  } else {
    pintarTabla($('tabla-respaldo'), [['Líneas leídas', snap.lineasCrudas.join('\n')]]);
  }
  const texto = snapshotATexto(snap);
  $('txt-respaldo').value = texto;
  guardarLocal(texto);
  actualizar();
}

async function tomarRespaldo() {
  await ejecutar('Respaldo', async () => {
    const t0 = performance.now();
    const snap = await /** @type {Conexion} */ (conexion).tomarSnapshot();
    const ms = Math.round(performance.now() - t0);
    if (snap.faltantes?.length) {
      // Un respaldo incompleto no sirve para volver atrás: no se habilitan las pruebas.
      snapshot = null;
      actualizar();
      registrar(
        'respaldo',
        `INCOMPLETO — faltan: ${snap.faltantes.join(', ')} (${snap.lineasCrudas.length} líneas en ${ms} ms)`,
      );
      throw new Error(
        `El respaldo salió incompleto (faltan: ${snap.faltantes.join(', ')}). ` +
          'No se habilitan las pruebas. Volvé a intentar; si se repite, pasame el resumen: puede que el dispositivo conteste más lento de lo previsto.',
      );
    }
    cargarSnapshot(snap, 'recién leído');
    registrar(
      'respaldo',
      `ok — ${snap.lineasCrudas.length} líneas en ${ms} ms (incluye la espera final de silencio)`,
    );
    mostrarResultado(
      'Respaldo listo. Descargalo ahora (.json y, si querés, el CSV) antes de correr cualquier prueba.',
      true,
    );
  });
}

function cargarPegado() {
  try {
    const snap = snapshotDeTexto($('txt-respaldo').value);
    cargarSnapshot(snap, 'pegado');
    registrar('respaldo', 'cargado desde texto pegado');
  } catch (e) {
    mostrarError(textoDeError(e));
  }
}

function avisoDeRespaldoGuardado() {
  try {
    const texto = localStorage.getItem(CLAVE_RESPALDO);
    if (!texto) return;
    const snap = snapshotDeTexto(texto);
    $('texto-respaldo-guardado').textContent =
      `Hay un respaldo guardado en este navegador: ${snap.modelo} ${snap.firmware}, del ${new Date(snap.tomadoEn).toLocaleString()}.`;
    $('aviso-respaldo-guardado').hidden = false;
    $('btn-usar-guardado').addEventListener('click', () => {
      cargarSnapshot(snap, 'guardado en el navegador');
      registrar('respaldo', 'cargado desde el navegador');
    });
  } catch {
    /* respaldo ilegible: se ignora */
  }
}

/**
 * @param {string} nombre
 * @param {string} texto
 * @param {string} mime
 */
function descargar(nombre, texto, mime) {
  const url = URL.createObjectURL(new Blob([texto], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nombreBase() {
  const s = /** @type {Snapshot} */ (snapshot);
  const fecha = s.tomadoEn.slice(0, 19).replace(/[:T]/g, '-');
  return `respaldo-${(s.modelo || 'dispositivo').replace(/\s+/g, '_')}-${fecha}`;
}

/** @param {HTMLTextAreaElement} ta */
function copiar(ta) {
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    log('Copiado (o seleccionado: usá Ctrl+C si no).');
  } catch {
    log('Seleccionado: copialo con Ctrl+C.');
  }
}

/* ─────────────── pruebas ─────────────── */

/**
 * @param {string} etiqueta
 * @param {import('../js/features/dispositivo/conexion.js').ResultadoRestauracion} r
 * @param {number} ms
 */
function textoDeRestauracion(etiqueta, r, ms) {
  const lineas = [
    `${etiqueta}: ${r.ok ? 'OK — quedó idéntico al respaldo' : 'QUEDÓ DISTINTO'} (${r.comandosEnviados} comandos, ${ms} ms)`,
  ];
  for (const d of r.diferencias) {
    lineas.push(
      `  · ${d.campo}: respaldo=${JSON.stringify(d.antes)} actual=${JSON.stringify(d.despues)}`,
    );
  }
  for (const a of r.advertencias) lineas.push(`  · aviso: ${a}`);
  return lineas.join('\n');
}

async function pruebaA() {
  await ejecutar('Prueba A', async () => {
    const t0 = performance.now();
    const r = await /** @type {Conexion} */ (conexion).restaurar(
      /** @type {Snapshot} */ (snapshot),
    );
    const ms = Math.round(performance.now() - t0);
    registrar(
      'prueba A (ida y vuelta)',
      r.ok
        ? `OK — ${r.comandosEnviados} comandos, ${ms} ms, ${r.advertencias.length} avisos`
        : `DIFERENCIAS: ${r.diferencias.map((d) => d.campo).join(', ')}`,
    );
    mostrarResultado(textoDeRestauracion('Prueba A', r, ms), r.ok);
  });
}

async function pruebaB() {
  await ejecutar('Prueba B', async () => {
    const con = /** @type {Conexion} */ (conexion);
    const snap = /** @type {Snapshot} */ (snapshot);

    const indices = Object.keys(snap.cfg.btns)
      .map(Number)
      .sort((a, b) => a - b);
    if (!indices.length) throw new Error('El respaldo no tiene ninguna entrada para probar.');
    const idx = indices[0];
    const original = snap.cfg.btns[idx];
    const nuevo = original.debounce === 7 ? 8 : 7;
    const { comandos } = comandosDeRestauracion({
      btns: { [idx]: { ...original, debounce: nuevo } },
    });
    if (comandos.length !== 1) throw new Error('No se pudo armar el comando de prueba.');

    let cambioVisible = null;
    /** @type {string | null} */
    let falloIntermedio = null;
    const t0 = performance.now();
    try {
      await con.aplicar(comandos);
      const leido = await con.leerConfig();
      const dif = compararConfiguraciones(snap.cfg, leido);
      cambioVisible =
        dif.length === 1 && dif[0].campo === `btns.${idx}.debounce` && dif[0].despues === nuevo;
    } catch (e) {
      falloIntermedio = textoDeError(e);
      log(`La prueba B falló a mitad: ${falloIntermedio}. Se intenta restaurar igual.`);
    }

    // Siempre se intenta volver atrás, haya salido bien o mal lo anterior.
    /** @type {import('../js/features/dispositivo/conexion.js').ResultadoRestauracion} */
    let r;
    try {
      r = await con.restaurar(snap);
    } catch (e) {
      mostrarError(
        `NO SE PUDO RESTAURAR: ${textoDeError(e)}\n` +
          `El dispositivo puede haber quedado con el antirrebote de la entrada ${idx} en ${nuevo} ms (el original era ${original.debounce} ms). ` +
          'Reconectá y usá "Restaurar respaldo", o importá el CSV del respaldo en el configurador de siempre.',
      );
      registrar('prueba B (cambio mínimo)', `RESTAURACIÓN FALLÓ: ${textoDeError(e)}`);
      return;
    }
    const ms = Math.round(performance.now() - t0);
    const ok = r.ok && cambioVisible === true && !falloIntermedio;

    const lineas = [
      `Comando de prueba: ${comandos[0]} (antirrebote ${original.debounce} → ${nuevo} ms en la entrada ${idx})`,
      falloIntermedio
        ? `Fallo antes de restaurar: ${falloIntermedio}`
        : `El cambio se vio al releer el dispositivo: ${cambioVisible ? 'sí' : 'NO'}`,
      textoDeRestauracion('Restauración', r, ms),
    ];
    registrar(
      'prueba B (cambio mínimo)',
      ok
        ? `OK — cambio visible al releer y restauración idéntica (${ms} ms)`
        : `PROBLEMA — cambio visible: ${cambioVisible}; restauración ok: ${r.ok}; fallo: ${falloIntermedio ?? 'ninguno'}`,
    );
    mostrarResultado(lineas.join('\n'), ok);
  });
}

async function restaurarAhora() {
  await ejecutar('Restaurar', async () => {
    const t0 = performance.now();
    const r = await /** @type {Conexion} */ (conexion).restaurar(
      /** @type {Snapshot} */ (snapshot),
    );
    const ms = Math.round(performance.now() - t0);
    registrar(
      'restauración manual',
      r.ok ? `OK (${ms} ms)` : `DIFERENCIAS: ${r.diferencias.map((d) => d.campo).join(', ')}`,
    );
    mostrarResultado(textoDeRestauracion('Restauración', r, ms), r.ok);
  });
}

/* ─────────────── ejecución y estado de los botones ─────────────── */

/**
 * Corre una operación evitando que se pisen dos a la vez y mostrando cualquier
 * error en pantalla.
 * @param {string} nombre
 * @param {() => Promise<void>} fn
 */
async function ejecutar(nombre, fn) {
  if (ocupado) return;
  ocupado = true;
  limpiarError();
  actualizar();
  log(`— ${nombre}…`);
  try {
    await fn();
  } catch (e) {
    mostrarError(`${nombre}: ${textoDeError(e)}`);
    registrar(`error.${nombre}`, textoDeError(e));
  } finally {
    ocupado = false;
    actualizar();
  }
}

function actualizar() {
  const conectado = conexion?.estado === 'conectado';
  const listo = conectado && snapshot !== null;
  const entiendo = $('chk-entiendo').checked;

  const usbOk = SIMULADO || TransporteUsb.disponible();
  const bleOk = SIMULADO || TransporteBle.disponible();
  $('btn-usb').disabled = conectado || ocupado || !usbOk;
  $('btn-usb-silencioso').disabled = conectado || ocupado || !usbOk;
  $('btn-ble').disabled = conectado || ocupado || !bleOk;
  $('btn-desconectar').disabled = !conexion || ocupado;
  $('btn-respaldo').disabled = !conectado || ocupado;

  $('chk-entiendo').disabled = snapshot === null;
  $('btn-prueba-a').disabled = !(listo && entiendo) || ocupado;
  $('btn-prueba-b').disabled = !(listo && entiendo) || ocupado;
  $('btn-restaurar').disabled = !listo || ocupado;

  const hayRespaldo = snapshot !== null;
  $('btn-desc-json').disabled = !hayRespaldo;
  $('btn-desc-csv').disabled = !hayRespaldo;
  $('btn-copiar-respaldo').disabled = !hayRespaldo;
}

/* ─────────────── arranque ─────────────── */

function iniciar() {
  $('banner-simulado').hidden = !SIMULADO;
  pintarEntorno();
  avisoDeRespaldoGuardado();

  $('btn-usb').addEventListener('click', () =>
    conectar(params.has('ble') && SIMULADO ? 'ble' : 'usb'),
  );
  $('btn-ble').addEventListener('click', () => conectar('ble'));
  $('btn-usb-silencioso').addEventListener('click', () => conectar('usb', { silencioso: true }));
  $('btn-desconectar').addEventListener('click', desconectar);
  $('btn-respaldo').addEventListener('click', tomarRespaldo);
  $('btn-cargar-pegado').addEventListener('click', cargarPegado);
  $('btn-desc-json').addEventListener('click', () => {
    if (snapshot) descargar(`${nombreBase()}.json`, snapshotATexto(snapshot), 'application/json');
  });
  $('btn-desc-csv').addEventListener('click', () => {
    if (!snapshot) return;
    const prod = productoPorModelo(snapshot.modelo);
    descargar(
      `${nombreBase()}.csv`,
      snapshotACsvDelConfigurador(snapshot, prod?.id ?? null),
      'text/csv;charset=utf-8',
    );
  });
  $('btn-copiar-respaldo').addEventListener('click', () => copiar($('txt-respaldo')));
  $('chk-entiendo').addEventListener('change', actualizar);
  $('btn-prueba-a').addEventListener('click', pruebaA);
  $('btn-prueba-b').addEventListener('click', pruebaB);
  $('btn-restaurar').addEventListener('click', restaurarAhora);
  $('btn-copiar-resumen').addEventListener('click', () => copiar($('txt-resumen')));

  actualizar();
  log(
    SIMULADO
      ? 'Arnés listo en modo SIMULADO.'
      : 'Arnés listo. Conectá un dispositivo para empezar.',
  );
}

iniciar();
