// @ts-check
import { Conexion, ErrorDeConexion, ESTADOS } from '../../js/features/dispositivo/conexion.js';
import { compararConfiguraciones } from '../../js/features/dispositivo/configuracion.js';
import {
  TransporteSimulado,
  cfgInicial,
  cfgConTapHoldEnBR,
} from '../../dev/transporte-simulado.js';

const RAPIDO = {
  esperaWhoMs: 60,
  silencioGetAllMs: 25,
  esperaMaxGetAllMs: 400,
  pausaEntreComandosMs: 0,
};

/** @param {ConstructorParameters<typeof TransporteSimulado>[0]} [op] */
function armar(op) {
  const t = new TransporteSimulado(op);
  const c = new Conexion(t, RAPIDO);
  return { t, c };
}

// ── Conectar ────────────────────────────────────────────────────────────────

test('conectar: detecta modelo, versión y producto', async () => {
  const { c } = armar();
  const info = await c.conectar();
  expect(c.estado).toBe(ESTADOS.CONECTADO);
  expect(info.modelo).toBe('disMouse');
  expect(info.version).toBe('R019-TH1');
  expect(info.producto?.id).toBe('dismouse');
  expect(info.desactualizado).toBe(false); // R019-TH1 no se lee como 191 ni como viejo
  expect(info.sinWho).toBe(false);
  expect(info.latenciaWhoMs).toBeGreaterThanOrEqual(0);
});

test('conectar: disHub BLE (modelo con espacio) se reconoce como disHub', async () => {
  const { c } = armar({ modelo: 'disHub BLE', firmware: 'R013' });
  const info = await c.conectar();
  expect(info.producto?.id).toBe('dishub');
  expect(info.desactualizado).toBe(false);
});

test('conectar: firmware más viejo que el último conocido → desactualizado', async () => {
  const { c } = armar({ firmware: 'R018' });
  expect((await c.conectar()).desactualizado).toBe(true);
});

test('conectar: si no contesta WHO queda conectado, con sinWho', async () => {
  const { c } = armar({ respondeWho: false });
  const info = await c.conectar();
  expect(c.estado).toBe(ESTADOS.CONECTADO);
  expect(info.sinWho).toBe(true);
  expect(info.modelo).toBeNull();
  expect(info.producto).toBeNull();
  expect(info.latenciaWhoMs).toBeNull();
});

test('conectar: si el transporte falla, queda desconectado y propaga el error', async () => {
  const { t, c } = armar();
  t.conectar = async () => {
    throw new Error('el usuario canceló');
  };
  await expect(c.conectar()).rejects.toThrow('canceló');
  expect(c.estado).toBe(ESTADOS.DESCONECTADO);
});

test('conectar: no permite abrir dos veces', async () => {
  const { c } = armar();
  await c.conectar();
  await expect(c.conectar()).rejects.toThrow(ErrorDeConexion);
});

test('conectar manda solo WHO', async () => {
  const { t, c } = armar();
  await c.conectar();
  expect(t.enviados).toEqual(['WHO']);
});

// ── Leer configuración y snapshot ───────────────────────────────────────────

test('leerConfig: devuelve exactamente la configuración del dispositivo', async () => {
  const { t, c } = armar();
  await c.conectar();
  const cfg = await c.leerConfig();
  expect(compararConfiguraciones(t.cfg, cfg)).toEqual([]);
  expect(c.cfg).toBe(cfg);
});

test('leerConfig: ignora líneas que no son de configuración', async () => {
  const { t, c } = armar({ lineasExtra: ['OK', 'Arduino listo', 'BAT:87'] });
  await c.conectar();
  const cfg = await c.leerConfig();
  expect(compararConfiguraciones(t.cfg, cfg)).toEqual([]);
});

test('leerConfig: si no contesta GETALL, falla con un error claro', async () => {
  const { c } = armar({ respondeGetAll: false });
  await c.conectar();
  await expect(c.leerConfig()).rejects.toThrow(/GETALL/);
});

test('leerConfig: sin conexión falla', async () => {
  const { c } = armar();
  await expect(c.leerConfig()).rejects.toThrow(ErrorDeConexion);
});

test('tomarSnapshot: guarda modelo, firmware, cfg y líneas crudas, sin modificar nada', async () => {
  const { t, c } = armar();
  await c.conectar();
  const snap = await c.tomarSnapshot();
  expect(snap.formato).toBe(1);
  expect(snap.modelo).toBe('disMouse');
  expect(snap.firmware).toBe('R019-TH1');
  expect(compararConfiguraciones(t.cfg, snap.cfg)).toEqual([]);
  expect(snap.lineasCrudas.length).toBe(4 + 8); // 4 globales + 8 botones
  expect(c.ultimoSnapshot).toBe(snap);
  expect(t.enviados).toEqual(['WHO', 'GETALL']); // solo lecturas
});

// ── Aplicar ────────────────────────────────────────────────────────────────

test('aplicar: envía los comandos en orden y el dispositivo cambia', async () => {
  const { t, c } = armar();
  await c.conectar();
  const r = await c.aplicar(['CFG:BR:K:P:0:s:-:-', 'CFG:BA:K:P:0:215:-:-', 'FMODE:2']);
  expect(r.enviados).toBe(3);
  expect(t.enviados.slice(1)).toEqual(['CFG:BR:K:P:0:s:-:-', 'CFG:BA:K:P:0:215:-:-', 'FMODE:2']);
  await new Promise((r) => setTimeout(r, 10));
  // El firmware simulado por defecto es -TH (Tap-Hold): cualquier CFG que no
  // sea modo T deja los 4 campos Tap-Hold en 0 (ver protocolo-configurador-dis-epe.md).
  expect(t.cfg.btns[0]).toEqual({
    tipo: 1,
    modo: 0,
    debounce: 0,
    accion: 115,
    mods: 0,
    flags: 0,
    accionLarga: 0,
    modsLarga: 0,
    flagsLarga: 0,
    umbral: 0,
  });
  expect(t.cfg.fmode).toBe(2);
});

test('aplicar: si un solo comando no está permitido, no se envía NINGUNO', async () => {
  const { t, c } = armar();
  await c.conectar();
  await expect(c.aplicar(['CFG:BR:K:P:0:s:-:-', 'RESET', 'FMODE:0'])).rejects.toThrow(
    /no se envió ninguno/,
  );
  expect(t.enviados).toEqual(['WHO']);
});

test('aplicar: nunca deja pasar SAVE, RESET ni comandos crudos', async () => {
  const { t, c } = armar();
  await c.conectar();
  for (const malo of ['SAVE', 'RESET', 'GETALL', 'WHO', 'CFG:BR:K:P:0:s:-:-\nRESET']) {
    await expect(c.aplicar([malo])).rejects.toThrow(ErrorDeConexion);
  }
  expect(t.enviados).toEqual(['WHO']);
  expect(t.guardados).toBe(0);
  expect(t.reseteos).toBe(0);
});

test('aplicar: sin conexión falla', async () => {
  const { c } = armar();
  await expect(c.aplicar(['FMODE:0'])).rejects.toThrow(ErrorDeConexion);
});

test('operaciones simultáneas se serializan: no se mezclan los comandos', async () => {
  const { t, c } = armar();
  await c.conectar();
  const a = c.aplicar(['CFG:BR:K:P:0:a:-:-', 'CFG:BA:K:P:0:b:-:-']);
  const b = c.aplicar(['CFG:BN:K:P:0:c:-:-', 'CFG:BC:K:P:0:d:-:-']);
  await Promise.all([a, b]);
  expect(t.enviados.slice(1)).toEqual([
    'CFG:BR:K:P:0:a:-:-',
    'CFG:BA:K:P:0:b:-:-',
    'CFG:BN:K:P:0:c:-:-',
    'CFG:BC:K:P:0:d:-:-',
  ]);
});

// ── SAVE / RESET explícitos ─────────────────────────────────────────────────

test('guardarEnMemoria: manda SAVE una sola vez, solo cuando se pide', async () => {
  const { t, c } = armar();
  await c.conectar();
  await c.aplicar(['FMODE:1']);
  expect(t.enviados).not.toContain('SAVE');
  await c.guardarEnMemoria();
  expect(t.enviados.filter((l) => l === 'SAVE')).toHaveLength(1);
});

test('restablecerDeFabrica: exige confirmación explícita', async () => {
  const { t, c } = armar();
  await c.conectar();
  // @ts-expect-error llamada sin argumento a propósito
  await expect(c.restablecerDeFabrica()).rejects.toThrow(/confirmación/);
  await expect(c.restablecerDeFabrica({ confirmado: false })).rejects.toThrow(/confirmación/);
  expect(t.enviados).not.toContain('RESET');
  await c.restablecerDeFabrica({ confirmado: true });
  expect(t.enviados).toContain('RESET');
});

// ── Restaurar (volver atrás) ────────────────────────────────────────────────

test('restaurar: snapshot → cambios → restaurar deja el dispositivo idéntico', async () => {
  const { t, c } = armar();
  await c.conectar();
  const snap = await c.tomarSnapshot();

  await c.aplicar([
    'CFG:BR:K:P:0:s:-:-',
    'CFG:BA:K:P:0:c:-:-',
    'CFG:BN:X:P:0:0:-:-',
    'CFG:BC:M:R:0:2:-:-', // modo H está retirado (ERR:MODE); se usa R para el cambio
    'FMODE:2',
    'ORIENT:3',
  ]);
  await new Promise((r) => setTimeout(r, 10));
  expect(compararConfiguraciones(snap.cfg, t.cfg).length).toBeGreaterThan(0); // cambió de verdad

  const r = await c.restaurar(snap);
  expect(r.ok).toBe(true);
  expect(r.diferencias).toEqual([]);
  expect(r.advertencias).toEqual([]);
  expect(compararConfiguraciones(snap.cfg, t.cfg)).toEqual([]);
});

test('restaurar: conserva el modo "una vez por pulsación" (modo 3) del botón naranja', async () => {
  const { t, c } = armar();
  await c.conectar();
  const snap = await c.tomarSnapshot();
  expect(snap.cfg.btns[2].modo).toBe(3);
  await c.aplicar(['CFG:BN:K:P:0:x:-:-']);
  await new Promise((r) => setTimeout(r, 10));
  const r = await c.restaurar(snap);
  expect(r.ok).toBe(true);
  expect(t.cfg.btns[2].modo).toBe(3);
});

test('restaurar: no manda SAVE ni RESET (ni siquiera con verificación)', async () => {
  const { t, c } = armar();
  await c.conectar();
  const snap = await c.tomarSnapshot();
  await c.restaurar(snap);
  expect(t.enviados).not.toContain('SAVE');
  expect(t.enviados).not.toContain('RESET');
  expect(t.guardados).toBe(0);
  expect(t.reseteos).toBe(0);
});

test('restaurar: si el dispositivo no acepta un cambio, la verificación lo informa', async () => {
  const { t, c } = armar({ ignoraCodigos: ['BR'] });
  await c.conectar();
  const snap = await c.tomarSnapshot();
  // Cambiamos "a mano" el estado del simulado para forzar una diferencia que
  // el firmware (que ignora BR) no va a poder revertir.
  t.cfg.btns[0].accion = 115;
  const r = await c.restaurar(snap);
  expect(r.ok).toBe(false);
  expect(r.diferencias.map((d) => d.campo)).toContain('btns.0.accion');
});

test('restaurar: no acepta el respaldo de otro modelo', async () => {
  const { c } = armar();
  await c.conectar();
  const snap = await c.tomarSnapshot();
  snap.modelo = 'disHub BLE';
  await expect(c.restaurar(snap)).rejects.toThrow(/es de un disHub BLE/);
});

test('restaurar: una tecla no representable queda como advertencia y no se envía', async () => {
  const cfg = cfgInicial();
  cfg.btns[0] = { tipo: 1, modo: 0, debounce: 0, accion: 58, mods: 0, flags: 0 }; // ':'
  const { t, c } = armar({ cfg });
  await c.conectar();
  const snap = await c.tomarSnapshot();
  const r = await c.restaurar(snap);
  expect(r.advertencias).toHaveLength(1);
  expect(t.enviados.some((l) => l.startsWith('CFG:BR:'))).toBe(false);
});

// ── Desconexión ─────────────────────────────────────────────────────────────

test('si el dispositivo se desconecta a mitad de una lectura, la operación falla', async () => {
  const { t, c } = armar({ latenciaMs: 5 });
  await c.conectar();
  const lectura = c.leerConfig();
  const esperado = expect(lectura).rejects.toThrow(/desconect/);
  setTimeout(() => t.caerse(), 2);
  await esperado;
  expect(c.estado).toBe(ESTADOS.DESCONECTADO);
});

test('desconectar: pasa a desconectado y avisa el cambio de estado', async () => {
  const { c } = armar();
  /** @type {string[]} */
  const estados = [];
  c.alCambioDeEstado((e) => estados.push(e));
  await c.conectar();
  await c.desconectar();
  expect(estados).toEqual(['conectando', 'conectado', 'desconectado']);
});

// ── Registro ───────────────────────────────────────────────────────────────

test('alRegistro: informa lo enviado (tx) y lo recibido (rx)', async () => {
  const { c } = armar();
  /** @type {{ sentido: string, linea: string }[]} */
  const log = [];
  const quitar = c.alRegistro((e) => log.push(e));
  await c.conectar();
  quitar();
  expect(log[0]).toEqual({ sentido: 'tx', linea: 'WHO' });
  expect(log[1].sentido).toBe('rx');
  expect(log[1].linea).toMatch(/^OK:WHO:disMouse/);
});

// ── Reconexión silenciosa ───────────────────────────────────────────────────

test('conectar({ silencioso }): reabre sin selector cuando hay un puerto recordado', async () => {
  const { t, c } = armar();
  t.conectar = vi.fn(async () => {});
  /** @type {any} */ (t).reconectarEnSilencio = vi.fn(async () => {
    t.conectado = true;
    return true;
  });
  const info = await c.conectar({ silencioso: true });
  expect(t.conectar).not.toHaveBeenCalled();
  expect(info.modelo).toBe('disMouse');
});

test('conectar({ silencioso }): sin puerto recordado falla y queda desconectado', async () => {
  const { t, c } = armar();
  /** @type {any} */ (t).reconectarEnSilencio = vi.fn(async () => false);
  await expect(c.conectar({ silencioso: true })).rejects.toThrow(/autorizado/);
  expect(c.estado).toBe(ESTADOS.DESCONECTADO);
});

test('conectar({ silencioso }): un transporte que no lo soporta (BLE) lo explica', async () => {
  const { t, c } = armar();
  /** @type {any} */ (t).reconectarEnSilencio = undefined; // como TransporteBle
  await expect(c.conectar({ silencioso: true })).rejects.toThrow(/sin selector/);
  expect(c.estado).toBe(ESTADOS.DESCONECTADO);
});

// ── Respaldo incompleto ────────────────────────────────────────────────────

test('tomarSnapshot: un respaldo completo no marca faltantes', async () => {
  const { c } = armar();
  await c.conectar();
  const snap = await c.tomarSnapshot();
  expect(snap.faltantes).toEqual([]);
});

test('tomarSnapshot: si el dispositivo no mandó todas las entradas, lo informa', async () => {
  const { c } = armar({ omiteBotones: [5, 6] });
  await c.conectar();
  const snap = await c.tomarSnapshot();
  expect(snap.faltantes).toEqual(['BTN 5 (Flecha ↓)', 'BTN 6 (Flecha ←)']);
});

// ── Tap-Hold (firmware -TH) ──────────────────────────────────────────────────
//
// Este bloque reproduce el caso real encontrado en la prueba de hardware del
// 2026-09-27: un disMouse R019-TH1 con BR en Tap-Hold (corto 'k', largo 'l',
// 500 ms). Antes de este bloque el núcleo no sabía nada del modo T y una
// "restauración sin cambios" lo aplanaba a una pulsación simple — ver
// protocolo-configurador-dis-epe.md.

test('conectar: detecta soportaTapHold por la versión (-TH<n>)', async () => {
  const { c } = armar({ firmware: 'R019-TH1' });
  const info = await c.conectar();
  expect(info.soportaTapHold).toBe(true);

  const { c: c2 } = armar({ firmware: 'R019' });
  const info2 = await c2.conectar();
  expect(info2.soportaTapHold).toBe(false);
});

test('conectar: soportaTapHold se recalcula en cada conexión (no se hereda)', async () => {
  const { t, c } = armar({ firmware: 'R019-TH1' });
  await c.conectar();
  expect(c.info?.soportaTapHold).toBe(true);
  await c.desconectar();
  t.firmware = 'R019'; // mismo dispositivo, firmware distinto en la próxima conexión
  await c.conectar();
  expect(c.info?.soportaTapHold).toBe(false);
});

test('tomarSnapshot: lee correctamente un botón en Tap-Hold (caso real: BR con k/l a 500ms)', async () => {
  const { t, c } = armar({ cfg: cfgConTapHoldEnBR() });
  await c.conectar();
  const snap = await c.tomarSnapshot();
  expect(snap.cfg.btns[0]).toEqual({
    tipo: 1,
    modo: 4,
    debounce: 0,
    accion: 107, // 'k'
    mods: 0,
    flags: 0,
    accionLarga: 108, // 'l'
    modsLarga: 0,
    flagsLarga: 0,
    umbral: 500,
  });
  expect(snap.faltantes).toEqual([]);
  expect(t.enviados).toEqual(['WHO', 'GETALL']); // tomar el respaldo no escribe nada
});

test('restaurar: un botón en Tap-Hold vuelve IDÉNTICO — antes se aplanaba a pulsación simple', async () => {
  const { c } = armar({ cfg: cfgConTapHoldEnBR() });
  await c.conectar();
  const snap = await c.tomarSnapshot();

  // "Ida y vuelta sin cambios" — es exactamente la Prueba A del arnés que
  // falló en hardware real antes de este arreglo.
  const r = await c.restaurar(snap);
  expect(r.ok).toBe(true);
  expect(r.diferencias).toEqual([]);
  expect(r.advertencias).toEqual([]);

  const releido = await c.leerConfig();
  expect(releido.btns[0]).toEqual(snap.cfg.btns[0]); // incluye accionLarga/modsLarga/flagsLarga/umbral
});

test('restaurar: sin soporte Tap-Hold confirmado, un botón en modo T se degrada a P (no se manda T a ciegas)', async () => {
  // Dispositivo que NO declara -TH pero cuyo snapshot (tomado en otra conexión,
  // o cargado desde un archivo) tiene un botón en modo 4. Nunca se debe mandar
  // `T` a un firmware que no lo demostró soportar.
  const { t, c } = armar({ firmware: 'R019', cfg: cfgInicial() });
  await c.conectar();
  expect(c.info?.soportaTapHold).toBe(false);

  const snapConTapHold = {
    formato: 1,
    tomadoEn: new Date().toISOString(),
    modelo: 'disMouse',
    firmware: 'R019-TH1',
    cfg: cfgConTapHoldEnBR(),
    lineasCrudas: [],
  };
  const r = await c.restaurar(snapConTapHold, { verificar: false });
  const cmdBR = t.enviados.find((l) => l.startsWith('CFG:BR:'));
  expect(cmdBR).toBe('CFG:BR:K:P:0:k:-:-'); // 7 campos: se perdió la acción larga, a propósito
  expect(r.comandosEnviados).toBeGreaterThan(0);
});

test('aplicar: un modo no soportado por el firmware vuelve como ERR:MODE en errorDispositivo', async () => {
  // `pausaEntreComandosMs` en 0 (como en el resto de este archivo, para que los
  // tests corran rápido) no le da tiempo a la respuesta simulada de llegar antes
  // de que `aplicar()` resuelva: acá se necesita algo de margen, igual que en
  // producción los 90ms fijos después de cada `send()` (ver protocolo real).
  const t = new TransporteSimulado({ firmware: 'R019' }); // sin Tap-Hold
  const c = new Conexion(t, { ...RAPIDO, pausaEntreComandosMs: 10 });
  await c.conectar();
  // La lista blanca deja pasar la forma (BC:M:T:... con 11 campos es válida en
  // el protocolo), pero ESTE firmware simulado no soporta T y contesta ERR:MODE
  // — igual que pasaría con hardware real.
  const r = await c.aplicar(['CFG:BC:M:T:0:1:-:-:2:0:0:400']);
  expect(r.errorDispositivo).toBe('El dispositivo no acepta ese modo de disparo.');
});

test('red de seguridad: una línea BTN de 11 campos activa soportaTapHold aunque WHO no lo haya declarado', async () => {
  // Simula un firmware cuya versión no sigue la convención `-TH<n>` pero cuyo
  // GETALL ya contesta en formato extendido — mismo mecanismo que el
  // configurador publicado (`isExtendedBtnLine` en connection.js real).
  const { t, c } = armar({ firmware: 'R099-RARO', cfg: cfgConTapHoldEnBR() });
  // fuerza al transporte simulado a mandar 11 campos igual, aunque la versión
  // no matchee -TH<n> (el transporte decide por `firmware`, así que se pisa
  // el getter para este único test)
  Object.defineProperty(t, 'tapHold', { get: () => true });
  const info = await c.conectar();
  expect(info.soportaTapHold).toBe(false); // por versión, todavía no
  const snap = await c.tomarSnapshot();
  expect(c.info?.soportaTapHold).toBe(true); // la red de seguridad lo activó
  expect(snap.cfg.btns[0].modo).toBe(4);
});
