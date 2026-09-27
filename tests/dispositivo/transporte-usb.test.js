// @ts-check
import {
  TransporteUsb,
  elegirApiSerial,
  FILTROS_USB_CONOCIDOS,
} from '../../js/features/dispositivo/transporte-usb.js';
import { ErrorDeTransporte } from '../../js/features/dispositivo/errores.js';
import { Conexion } from '../../js/features/dispositivo/conexion.js';
import { compararConfiguraciones } from '../../js/features/dispositivo/configuracion.js';
import { TransporteSimulado } from '../../dev/transporte-simulado.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Un puerto Web Serial falso, con flujos reales de Node. */
function puertoFalso() {
  /** @type {ReadableStreamDefaultController<Uint8Array>} */
  let controlador;
  /** @type {string[]} */
  const escrito = [];
  const puerto = {
    readable: new ReadableStream({
      start(c) {
        controlador = c;
      },
    }),
    writable: new WritableStream({
      write(trozo) {
        escrito.push(dec.decode(trozo));
      },
    }),
    open: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    forget: vi.fn(async () => {}),
    getInfo: () => ({ usbVendorId: 0x2341, usbProductId: 0x8037 }),
    escrito,
    /** @param {string} texto */
    emitir(texto) {
      controlador.enqueue(enc.encode(texto));
    },
    romper() {
      controlador.error(new Error('el cable se soltó'));
    },
  };
  return puerto;
}

/** @param {any} puerto  @param {any} [extra] */
function apiFalsa(puerto, extra = {}) {
  return {
    requestPort: vi.fn(async () => puerto),
    getPorts: vi.fn(async () => (puerto ? [puerto] : [])),
    ...extra,
  };
}

const esperar = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

test('conectar: pide puerto sin filtros por defecto y abre a 9600', async () => {
  const p = puertoFalso();
  const api = apiFalsa(p);
  const t = new TransporteUsb({ api });
  await t.conectar();
  expect(api.requestPort).toHaveBeenCalledWith(undefined);
  expect(p.open).toHaveBeenCalledWith({ baudRate: 9600 });
  expect(t.infoPuerto).toEqual({ usbVendorId: 0x2341, usbProductId: 0x8037 });
});

test('conectar: con filtros los pasa al selector del navegador', async () => {
  const p = puertoFalso();
  const api = apiFalsa(p);
  await new TransporteUsb({ api, filtros: FILTROS_USB_CONOCIDOS }).conectar();
  expect(api.requestPort).toHaveBeenCalledWith({
    filters: [{ usbVendorId: 0x2341, usbProductId: 0x8037 }],
  });
});

test('recibe líneas aunque lleguen cortadas', async () => {
  const p = puertoFalso();
  const t = new TransporteUsb({ api: apiFalsa(p) });
  /** @type {string[]} */
  const lineas = [];
  t.alRecibirLinea((l) => lineas.push(l));
  await t.conectar();
  p.emitir('OK:WHO:disMo');
  p.emitir('use:R019-TH1\nORIENT:0\n');
  await esperar(10);
  expect(lineas).toEqual(['OK:WHO:disMouse:R019-TH1', 'ORIENT:0']);
});

test('enviar: agrega el salto de línea', async () => {
  const p = puertoFalso();
  const t = new TransporteUsb({ api: apiFalsa(p) });
  await t.conectar();
  await t.enviar('WHO');
  expect(p.escrito).toEqual(['WHO\n']);
});

test('enviar sin puerto abierto falla con un error claro', async () => {
  const t = new TransporteUsb({ api: apiFalsa(null) });
  await expect(t.enviar('WHO')).rejects.toMatchObject({ codigo: 'sin-conexion' });
});

test('cerrar el selector sin elegir → error "cancelado"', async () => {
  const api = apiFalsa(null, {
    requestPort: vi.fn(async () => {
      throw Object.assign(new Error('nada'), { name: 'NotFoundError' });
    }),
  });
  const t = new TransporteUsb({ api });
  await expect(t.conectar()).rejects.toMatchObject({
    name: 'ErrorDeTransporte',
    codigo: 'cancelado',
  });
});

test('puerto que no abre (otro programa lo usa) → "puerto-ocupado"', async () => {
  const p = puertoFalso();
  p.open = vi.fn(async () => {
    throw Object.assign(new Error('Failed to open serial port'), { name: 'NetworkError' });
  });
  const t = new TransporteUsb({ api: apiFalsa(p) });
  await expect(t.conectar()).rejects.toMatchObject({ codigo: 'puerto-ocupado' });
});

test('política de permisos que bloquea el puerto → "permiso-bloqueado"', async () => {
  const api = apiFalsa(null, {
    requestPort: vi.fn(async () => {
      throw Object.assign(new Error('disallowed by permissions policy'), { name: 'SecurityError' });
    }),
  });
  await expect(new TransporteUsb({ api }).conectar()).rejects.toMatchObject({
    codigo: 'permiso-bloqueado',
  });
});

test('reconectarEnSilencio: sin puertos recordados devuelve false y no muestra el selector', async () => {
  const api = apiFalsa(null);
  const t = new TransporteUsb({ api });
  expect(await t.reconectarEnSilencio()).toBe(false);
  expect(api.requestPort).not.toHaveBeenCalled();
});

test('reconectarEnSilencio: con un puerto recordado lo abre sin selector', async () => {
  const p = puertoFalso();
  const api = apiFalsa(p);
  const t = new TransporteUsb({ api });
  expect(await t.reconectarEnSilencio()).toBe(true);
  expect(api.requestPort).not.toHaveBeenCalled();
  expect(p.open).toHaveBeenCalledWith({ baudRate: 9600 });
});

test('si el cable se suelta, avisa una sola vez que se desconectó', async () => {
  const p = puertoFalso();
  const t = new TransporteUsb({ api: apiFalsa(p) });
  const avisos = vi.fn();
  t.alDesconectar(avisos);
  await t.conectar();
  p.romper();
  await esperar(10);
  expect(avisos).toHaveBeenCalledTimes(1);
  await expect(t.enviar('WHO')).rejects.toBeInstanceOf(ErrorDeTransporte);
});

test('desconectar a propósito cierra el puerto y NO dispara el aviso de desconexión', async () => {
  const p = puertoFalso();
  const t = new TransporteUsb({ api: apiFalsa(p) });
  const avisos = vi.fn();
  t.alDesconectar(avisos);
  await t.conectar();
  await t.desconectar();
  await esperar(10);
  expect(p.close).toHaveBeenCalled();
  expect(avisos).not.toHaveBeenCalled();
});

test('olvidar: cierra y revoca el permiso del puerto', async () => {
  const p = puertoFalso();
  const t = new TransporteUsb({ api: apiFalsa(p) });
  await t.conectar();
  await t.olvidar();
  expect(p.forget).toHaveBeenCalled();
});

test('sin ninguna API serie (Node): no disponible, y conectar explica por qué', async () => {
  expect(elegirApiSerial()).toBeNull();
  await expect(new TransporteUsb().conectar()).rejects.toMatchObject({ codigo: 'no-disponible' });
});

test('integración: Conexion sobre TransporteUsb con un firmware simulado detrás del puerto', async () => {
  const sim = new TransporteSimulado({ modelo: 'disMouse', firmware: 'R019-TH1' });
  await sim.conectar();
  const p = puertoFalso();
  // El "cable": lo que se escribe en el puerto le llega al firmware simulado, y
  // lo que el firmware responde vuelve a leerse por el puerto.
  p.writable = new WritableStream({
    write(trozo) {
      for (const l of dec.decode(trozo).split('\n').filter(Boolean)) sim.enviar(l);
    },
  });
  sim.alRecibirLinea((l) => p.emitir(l + '\n'));

  const t = new TransporteUsb({ api: apiFalsa(p) });
  const c = new Conexion(t, {
    esperaWhoMs: 200,
    silencioGetAllMs: 40,
    esperaMaxGetAllMs: 500,
    pausaEntreComandosMs: 0,
  });

  const info = await c.conectar();
  expect(info.producto?.id).toBe('dismouse');

  const snap = await c.tomarSnapshot();
  await c.aplicar(['CFG:BR:K:P:0:s:-:-', 'CFG:BA:K:P:0:d:-:-', 'FMODE:2']);
  await esperar(10);
  expect(compararConfiguraciones(snap.cfg, sim.cfg).length).toBeGreaterThan(0);

  const r = await c.restaurar(snap);
  expect(r.ok).toBe(true);
  expect(compararConfiguraciones(snap.cfg, sim.cfg)).toEqual([]);
  expect(sim.enviados).not.toContain('SAVE');
  expect(sim.enviados).not.toContain('RESET');
});

test('elegirApiSerial usa la nativa si el navegador la trae', () => {
  const previo = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: { serial: { marca: 'nativa' } },
    configurable: true,
  });
  try {
    expect(elegirApiSerial()).toEqual({ api: { marca: 'nativa' }, via: 'nativo' });
  } finally {
    if (previo) Object.defineProperty(globalThis, 'navigator', previo);
  }
});
