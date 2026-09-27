// @ts-check
import {
  TransporteBle,
  BLE_SERVICIO,
  BLE_RX,
  BLE_TX,
} from '../../js/features/dispositivo/transporte-ble.js';

const enc = new TextEncoder();
const esperar = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {Object} [op]
 * @param {boolean} [op.servicioFalla]
 * @param {string[] | null} [op.serviciosListados]  null → getPrimaryServices también falla
 */
function bleFalso({ servicioFalla = false, serviciosListados = null } = {}) {
  /** @type {Uint8Array[]} */
  const escrituras = [];
  /** @type {((ev: any) => void) | null} */
  let oyenteRx = null;
  /** @type {Record<string, () => void>} */
  const oyentesDispositivo = {};

  const rx = {
    startNotifications: vi.fn(async () => {}),
    addEventListener: (/** @type {string} */ _t, /** @type {(ev: any) => void} */ cb) => {
      oyenteRx = cb;
    },
  };
  const tx = {
    writeValue: async (/** @type {Uint8Array} */ v) => {
      escrituras.push(v);
    },
  };
  const servicio = {
    getCharacteristic: async (/** @type {string} */ uuid) =>
      uuid === BLE_RX ? rx : uuid === BLE_TX ? tx : null,
  };
  const servidor = {
    getPrimaryService: async () => {
      if (servicioFalla) throw new Error('no service');
      return servicio;
    },
    getPrimaryServices: async () => {
      if (serviciosListados === null) throw new Error('no se puede listar');
      return serviciosListados.map((uuid) => ({ uuid }));
    },
  };
  const dispositivo = {
    name: 'disHub BLE',
    gatt: {
      connected: false,
      connect: async () => {
        dispositivo.gatt.connected = true;
        return servidor;
      },
      disconnect: () => {
        dispositivo.gatt.connected = false;
        oyentesDispositivo.gattserverdisconnected?.();
      },
    },
    addEventListener: (/** @type {string} */ tipo, /** @type {() => void} */ cb) => {
      oyentesDispositivo[tipo] = cb;
    },
  };
  const bluetooth = { requestDevice: vi.fn(async () => dispositivo) };
  return {
    bluetooth,
    dispositivo,
    escrituras,
    rx,
    notificar: (/** @type {string} */ texto) =>
      oyenteRx?.({ target: { value: enc.encode(texto) } }),
    /** Simula que el dispositivo se apagó o salió de rango. */
    cortarEnlace: () => oyentesDispositivo.gattserverdisconnected?.(),
  };
}

test('conectar: selector sin filtro de nombre, con el servicio UART como opcional', async () => {
  const f = bleFalso();
  const t = new TransporteBle({ bluetooth: f.bluetooth });
  await t.conectar();
  const opciones = /** @type {any} */ (f.bluetooth.requestDevice.mock.calls[0])[0];
  expect(opciones.acceptAllDevices).toBe(true);
  expect(opciones.optionalServices).toContain(BLE_SERVICIO);
  expect(f.rx.startNotifications).toHaveBeenCalled();
  expect(t.nombre).toBe('disHub BLE');
});

test('recibe líneas por notificaciones, aunque una línea llegue en dos notificaciones', async () => {
  const f = bleFalso();
  const t = new TransporteBle({ bluetooth: f.bluetooth });
  /** @type {string[]} */
  const lineas = [];
  t.alRecibirLinea((l) => lineas.push(l));
  await t.conectar();
  f.notificar('OK:WHO:disHub');
  f.notificar(' BLE:R013\n');
  f.notificar('VEL:10\n');
  expect(lineas).toEqual(['OK:WHO:disHub BLE:R013', 'VEL:10']);
});

test('enviar: una línea corta va en un solo paquete', async () => {
  const f = bleFalso();
  const t = new TransporteBle({ bluetooth: f.bluetooth });
  await t.conectar();
  await t.enviar('WHO');
  expect(f.escrituras.map((p) => new TextDecoder().decode(p))).toEqual(['WHO\n']);
});

test('enviar: una línea de más de 20 bytes se parte en paquetes de a lo sumo 20', async () => {
  const f = bleFalso();
  const t = new TransporteBle({ bluetooth: f.bluetooth });
  await t.conectar();
  await t.enviar('CFG:BR:K:P:0:215:-:-'); // 20 caracteres + "\n" = 21 bytes
  expect(f.escrituras.map((p) => p.length)).toEqual([20, 1]);
  const junto = f.escrituras.map((p) => new TextDecoder().decode(p)).join('');
  expect(junto).toBe('CFG:BR:K:P:0:215:-:-\n');
});

test('enviar sin conexión falla con un error claro', async () => {
  const t = new TransporteBle({ bluetooth: bleFalso().bluetooth });
  await expect(t.enviar('WHO')).rejects.toMatchObject({ codigo: 'sin-conexion' });
});

test('cerrar el selector sin elegir → "cancelado"', async () => {
  const f = bleFalso();
  f.bluetooth.requestDevice = vi.fn(async () => {
    throw Object.assign(new Error('User cancelled'), { name: 'NotFoundError' });
  });
  await expect(new TransporteBle({ bluetooth: f.bluetooth }).conectar()).rejects.toMatchObject({
    codigo: 'cancelado',
  });
});

test('sin Web Bluetooth (iOS, Firefox, Safari): "no-disponible" con explicación', async () => {
  const t = new TransporteBle({ bluetooth: null });
  // En Node `navigator.bluetooth` no existe, así que el valor por defecto también es null.
  await expect(t.conectar()).rejects.toMatchObject({ codigo: 'no-disponible' });
  expect(TransporteBle.disponible()).toBe(false);
});

test('servicio UART inaccesible pero presente en el listado → "hid-windows"', async () => {
  const f = bleFalso({
    servicioFalla: true,
    serviciosListados: [BLE_SERVICIO, '00001812-0000-1000-8000-00805f9b34fb'],
  });
  await expect(new TransporteBle({ bluetooth: f.bluetooth }).conectar()).rejects.toMatchObject({
    codigo: 'hid-windows',
  });
});

test('servicios ilegibles (emparejado como HID en el sistema) → "hid-windows"', async () => {
  const f = bleFalso({ servicioFalla: true, serviciosListados: null });
  await expect(new TransporteBle({ bluetooth: f.bluetooth }).conectar()).rejects.toMatchObject({
    codigo: 'hid-windows',
  });
});

test('dispositivo sin servicio UART (se eligió otro de la lista) → "sin-uart"', async () => {
  const f = bleFalso({
    servicioFalla: true,
    serviciosListados: ['0000180f-0000-1000-8000-00805f9b34fb'],
  });
  await expect(new TransporteBle({ bluetooth: f.bluetooth }).conectar()).rejects.toMatchObject({
    codigo: 'sin-uart',
  });
});

test('si la conexión falla, no queda el enlace GATT abierto', async () => {
  const f = bleFalso({ servicioFalla: true, serviciosListados: [] });
  await expect(new TransporteBle({ bluetooth: f.bluetooth }).conectar()).rejects.toBeTruthy();
  expect(f.dispositivo.gatt.connected).toBe(false);
});

test('si el dispositivo se apaga o se va de rango, avisa una sola vez', async () => {
  const f = bleFalso();
  const t = new TransporteBle({ bluetooth: f.bluetooth });
  const avisos = vi.fn();
  t.alDesconectar(avisos);
  await t.conectar();
  f.cortarEnlace();
  await esperar(5);
  expect(avisos).toHaveBeenCalledTimes(1);
});

test('desconectar a propósito NO dispara el aviso de desconexión', async () => {
  const f = bleFalso();
  const t = new TransporteBle({ bluetooth: f.bluetooth });
  const avisos = vi.fn();
  t.alDesconectar(avisos);
  await t.conectar();
  await t.desconectar();
  await esperar(5);
  expect(f.dispositivo.gatt.connected).toBe(false);
  expect(avisos).not.toHaveBeenCalled();
});
