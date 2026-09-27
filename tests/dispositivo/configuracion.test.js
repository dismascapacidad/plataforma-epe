// @ts-check
import {
  clonarCfg,
  compararConfiguraciones,
  comandosDeRestauracion,
  snapshotATexto,
  snapshotDeTexto,
  nombreDeTecla,
  describirBoton,
  resumirConfiguracion,
  snapshotACsvDelConfigurador,
  entradasFaltantes,
} from '../../js/features/dispositivo/configuracion.js';
import { PRODUCTOS } from '../../js/features/dispositivo/productos.js';

/** @returns {import('../../js/features/dispositivo/protocolo.js').DeviceCfg} */
function cfgEjemplo() {
  return {
    orient: 0,
    vel: 10,
    acel: 1,
    fmode: 0,
    btns: {
      0: { tipo: 1, modo: 0, debounce: 0, accion: 115, mods: 0, flags: 0 }, // 's'
      1: { tipo: 1, modo: 1, debounce: 50, accion: 215, mods: 0, flags: 0 }, // ENTER al soltar
      2: { tipo: 1, modo: 3, debounce: 0, accion: 99, mods: 1, flags: 0 }, // 'c' + Ctrl, una vez
      3: { tipo: 0, modo: 2, debounce: 0, accion: 1, mods: 0, flags: 1 }, // clic doble, larga
      4: { tipo: 2, modo: 0, debounce: 0, accion: 0, mods: 0, flags: 0 }, // desactivado
      5: { tipo: 0, modo: 0, debounce: 0, accion: 8, mods: 0, flags: 0 }, // scroll ↑
    },
  };
}

test('clonarCfg: copia independiente', () => {
  const a = cfgEjemplo();
  const b = clonarCfg(a);
  b.btns[0].accion = 999;
  expect(a.btns[0].accion).toBe(115);
});

test('compararConfiguraciones: idénticas → sin diferencias', () => {
  expect(compararConfiguraciones(cfgEjemplo(), cfgEjemplo())).toEqual([]);
});

test('compararConfiguraciones: detecta cambios globales y de botón', () => {
  const a = cfgEjemplo();
  const b = cfgEjemplo();
  b.vel = 20;
  b.btns[1].accion = 214;
  expect(compararConfiguraciones(a, b)).toEqual([
    { campo: 'vel', antes: 10, despues: 20 },
    { campo: 'btns.1.accion', antes: 215, despues: 214 },
  ]);
});

test('compararConfiguraciones: botón que falta de un lado', () => {
  const a = cfgEjemplo();
  const b = cfgEjemplo();
  delete b.btns[5];
  const dif = compararConfiguraciones(a, b);
  expect(dif).toHaveLength(1);
  expect(dif[0].campo).toBe('btns.5');
  expect(dif[0].despues).toBeNull();
});

test('compararConfiguraciones: null y undefined cuentan como "sin dato"', () => {
  const a = cfgEjemplo();
  const b = cfgEjemplo();
  a.acel = null;
  delete b.acel;
  expect(compararConfiguraciones(a, b)).toEqual([]);
});

test('comandosDeRestauracion: usa "-" sin espacio y conserva el modo O', () => {
  const { comandos, advertencias } = comandosDeRestauracion(cfgEjemplo());
  expect(advertencias).toEqual([]);
  expect(comandos).toContain('CFG:BR:K:P:0:s:-:-');
  expect(comandos).toContain('CFG:BA:K:R:50:215:-:-');
  expect(comandos).toContain('CFG:BN:K:O:0:c:C:-'); // modo 3 → O (antes se perdía)
  expect(comandos).toContain('CFG:BC:M:H:0:1:-:D');
  expect(comandos).toContain('CFG:FU:X:P:0:0:-:-');
  expect(comandos).toContain('CFG:FD:M:P:0:SU:-:-');
  expect(comandos).toContain('FMODE:0');
  expect(comandos).toContain('ORIENT:0');
  expect(comandos).toContain('VEL:10');
  expect(comandos).toContain('ACEL:1');
  for (const c of comandos) expect(c).not.toMatch(/ $/);
});

test('comandosDeRestauracion: la tecla espacio (32) queda como espacio literal', () => {
  const cfg = cfgEjemplo();
  cfg.btns[0] = { tipo: 1, modo: 0, debounce: 0, accion: 32, mods: 0, flags: 0 };
  const { comandos } = comandosDeRestauracion(cfg);
  expect(comandos).toContain('CFG:BR:K:P:0: :-:-');
});

test('comandosDeRestauracion: una tecla ":" no se envía y queda como advertencia', () => {
  const cfg = cfgEjemplo();
  cfg.btns[0] = { tipo: 1, modo: 0, debounce: 0, accion: 58, mods: 0, flags: 0 }; // ':'
  const { comandos, advertencias } = comandosDeRestauracion(cfg);
  expect(comandos.some((c) => c.startsWith('CFG:BR:'))).toBe(false);
  expect(advertencias).toHaveLength(1);
});

test('comandosDeRestauracion: nunca produce SAVE, RESET ni WHO', () => {
  const { comandos } = comandosDeRestauracion(cfgEjemplo());
  for (const c of comandos) expect(c).toMatch(/^(CFG|FMODE|ORIENT|VEL|ACEL):/);
});

test('snapshot: ida y vuelta a texto', () => {
  const snap = {
    formato: 1,
    tomadoEn: '2026-09-26T12:00:00.000Z',
    modelo: 'disMouse',
    firmware: 'R019-TH1',
    cfg: cfgEjemplo(),
    lineasCrudas: ['ORIENT:0', 'BTN:0:1:0:0:115:0:0'],
  };
  expect(snapshotDeTexto(snapshotATexto(snap))).toEqual(snap);
});

test('snapshotDeTexto: rechaza texto que no es un respaldo', () => {
  expect(() => snapshotDeTexto('no es json')).toThrow(/JSON/);
  expect(() => snapshotDeTexto('{"hola":1}')).toThrow(/formato/);
  expect(() => snapshotDeTexto('null')).toThrow(/formato/);
});

// ── Descripciones legibles ──────────────────────────────────────────────────

test('nombreDeTecla: letras, especiales y códigos desconocidos', () => {
  expect(nombreDeTecla(115)).toBe('S');
  expect(nombreDeTecla(49)).toBe('1');
  expect(nombreDeTecla(215)).toBe('Enter');
  expect(nombreDeTecla(32)).toBe('Espacio');
  expect(nombreDeTecla(209)).toBe('↑');
  expect(nombreDeTecla(197)).toBe('F5');
  expect(nombreDeTecla(7)).toBe('tecla de código 7');
});

test('describirBoton: teclado con modificador, modo y antirrebote', () => {
  expect(describirBoton({ tipo: 1, modo: 3, debounce: 30, accion: 99, mods: 1, flags: 0 })).toBe(
    'Teclado: Ctrl + C · una vez por pulsación · antirrebote 30 ms',
  );
  expect(describirBoton({ tipo: 1, modo: 0, debounce: 0, accion: 215, mods: 0, flags: 0 })).toBe(
    'Teclado: Enter · al presionar',
  );
});

test('describirBoton: mouse (clic, doble clic, mantener, scroll)', () => {
  const base = { modo: 0, debounce: 0, mods: 0 };
  expect(describirBoton({ ...base, tipo: 0, accion: 1, flags: 0 })).toBe(
    'Mouse: clic izquierdo · al presionar',
  );
  expect(describirBoton({ ...base, tipo: 0, accion: 1, flags: 1 })).toBe(
    'Mouse: clic izquierdo (doble clic) · al presionar',
  );
  expect(describirBoton({ ...base, tipo: 0, accion: 1, flags: 2 })).toBe(
    'Mouse: clic izquierdo (mantener presionado) · al presionar',
  );
  expect(describirBoton({ ...base, tipo: 0, accion: 8, flags: 0 })).toBe(
    'Mouse: scroll hacia arriba · al presionar',
  );
});

test('describirBoton: desactivado', () => {
  expect(describirBoton({ tipo: 2, modo: 0, debounce: 0, accion: 0, mods: 0, flags: 0 })).toBe(
    'Desactivado',
  );
});

test('resumirConfiguracion: una fila por entrada del producto, y el modo de flechas si aplica', () => {
  const filas = resumirConfiguracion(cfgEjemplo(), PRODUCTOS.dismouse);
  expect(filas).toHaveLength(9); // 8 entradas + modo de flechas
  expect(filas[0]).toEqual({
    clave: 'BR',
    etiqueta: 'Botón Rojo',
    texto: 'Teclado: S · al presionar',
  });
  expect(filas[6].texto).toBe('sin datos'); // el ejemplo no trae el botón 6
  expect(filas[8]).toEqual({
    clave: 'FMODE',
    etiqueta: 'Modo de flechas',
    texto: 'cada flecha con su propia acción',
  });
});

test('resumirConfiguracion: en disHub no hay modo de flechas y se muestran las notas', () => {
  const filas = resumirConfiguracion(cfgEjemplo(), PRODUCTOS.dishub);
  expect(filas).toHaveLength(8);
  expect(filas[0].etiqueta).toBe('Botón Rojo (también Conector 1)');
});

// ── CSV compatible con el configurador actual ───────────────────────────────

/** Copia fiel de parseCSVLine del configurador actual, para probar la compatibilidad. */
function parseCSVLine(/** @type {string} */ line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      result.push(cur);
      cur = '';
    } else cur += c;
  }
  result.push(cur);
  return result;
}

test('snapshotACsvDelConfigurador: el configurador actual lo puede importar tal cual', () => {
  const snap = {
    formato: 1,
    tomadoEn: '2026-09-26T12:34:56.000Z',
    modelo: 'disMouse',
    firmware: 'R019-TH1',
    cfg: cfgEjemplo(),
    lineasCrudas: [],
  };
  const csv = snapshotACsvDelConfigurador(snap, 'dismouse');
  const lineas = csv.split(/\r?\n/).filter((l) => l.trim());
  expect(lineas).toHaveLength(2);
  const cabecera = parseCSVLine(lineas[0]);
  expect(cabecera).toEqual(['name', 'date', 'prodId', 'notes', 'cfg_json']);
  const cols = parseCSVLine(lineas[1]);
  expect(cols[cabecera.indexOf('name')]).toBe('Respaldo disMouse 2026-09-26 12:34');
  expect(cols[cabecera.indexOf('prodId')]).toBe('dismouse');
  expect(JSON.parse(cols[cabecera.indexOf('cfg_json')])).toEqual(snap.cfg);
});

// ── Lectura incompleta ─────────────────────────────────────────────────────

test('entradasFaltantes: lectura completa → vacío', () => {
  const cfg = cfgEjemplo();
  for (const i of [6, 7])
    cfg.btns[i] = { tipo: 2, modo: 0, debounce: 0, accion: 0, mods: 0, flags: 0 };
  cfg.btns[5] = { tipo: 2, modo: 0, debounce: 0, accion: 0, mods: 0, flags: 0 };
  cfg.btns[4] = { tipo: 2, modo: 0, debounce: 0, accion: 0, mods: 0, flags: 0 };
  cfg.btns[3] = { tipo: 2, modo: 0, debounce: 0, accion: 0, mods: 0, flags: 0 };
  expect(entradasFaltantes(cfg, PRODUCTOS.dismouse)).toEqual([]);
});

test('entradasFaltantes: avisa qué entradas y qué ajustes globales no llegaron', () => {
  const cfg = cfgEjemplo(); // trae 0..5: faltan 6 y 7 (flechas ← →)
  const faltan = entradasFaltantes(cfg, PRODUCTOS.dismouse);
  expect(faltan).toEqual(['BTN 6 (Flecha ←)', 'BTN 7 (Flecha →)']);
  cfg.fmode = null;
  delete cfg.vel;
  expect(entradasFaltantes(cfg, PRODUCTOS.dismouse)).toEqual(
    expect.arrayContaining(['FMODE', 'VEL']),
  );
});

test('entradasFaltantes: en modelos sin flechas los ajustes globales no se exigen', () => {
  const cfg = { btns: { 0: { tipo: 0, modo: 0, debounce: 0, accion: 1, mods: 0, flags: 0 } } };
  expect(entradasFaltantes(cfg, PRODUCTOS.disbutton)).toEqual([]);
});

test('entradasFaltantes: sin producto reconocido solo se exige alguna entrada', () => {
  expect(entradasFaltantes({ btns: {} }, null)).toEqual(['BTN (ninguna entrada)']);
  expect(entradasFaltantes(cfgEjemplo(), null)).toEqual([]);
});
