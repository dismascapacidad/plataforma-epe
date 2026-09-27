// @ts-check
/**
 * Spec de la capa de protocolo (`src/protocol.js`).
 *
 * Objetivo de Fase 1: fijar el comportamiento ACTUAL antes de modularizar el
 * resto de la app. Los casos se derivan de los presets de fábrica (`FACTORY_CMDS`
 * en `index.html`) y de las respuestas típicas de `GETALL` / `WHO`.
 *
 * Corre hoy en el navegador (`tests/index.html`) y, cuando haya Node, tal cual
 * bajo Vitest (`test` + `expect` como globales).
 */

import * as P from '../../js/features/dispositivo/protocolo.js';

// `test` y `expect` son globales: los provee Vitest (globals:true) o, en el
// runner de navegador, tests/harness.js vía tests/index.html.

// ── Keycodes ────────────────────────────────────────────────────────────────

test('cvKey: caracteres y dígitos van a minúscula', () => {
  expect(P.cvKey('a')).toBe('a');
  expect(P.cvKey('A')).toBe('a');
  expect(P.cvKey('W')).toBe('w');
  expect(P.cvKey('1')).toBe('1');
});

test('cvKey: tokens especiales → valor de wire (firmware R009+)', () => {
  expect(P.cvKey('ENTER')).toBe('215');
  expect(P.cvKey('UP_ARROW')).toBe('209');
  expect(P.cvKey('F5')).toBe('197');
  expect(P.cvKey('SPACE')).toBe(' ');
});

test('REV_KEY: es la inversa de la tabla actual', () => {
  expect(P.REV_KEY['215']).toBe('ENTER');
  expect(P.REV_KEY['209']).toBe('UP_ARROW');
  expect(P.REV_KEY['204']).toBe('F12');
  expect(P.REV_KEY['32']).toBe('SPACE');
});

test('REV_KEY: la tabla legacy no pisa a la actual', () => {
  expect(P.REV_KEY['176']).toBe('ENTER'); // solo legacy
  expect(P.REV_KEY['212']).toBe('RIGHT_ARROW'); // colisión legacy(DELETE)/actual(RIGHT_ARROW) → gana actual
});

// ── buildButtonCfg ─────────────────────────────────────────────────────────

test('buildButtonCfg: acciones de mouse', () => {
  expect(P.buildButtonCfg({ code: 'BR', tipo: 'M', mouseAction: '1' })).toBe('CFG:BR:M:P:0:1:-:-');
  expect(P.buildButtonCfg({ code: 'BN', tipo: 'M', mouseAction: '1D' })).toBe('CFG:BN:M:P:0:1:-:D');
  expect(P.buildButtonCfg({ code: 'BC', tipo: 'M', mouseAction: '1M' })).toBe('CFG:BC:M:P:0:1:-:M');
  expect(P.buildButtonCfg({ code: 'BN', tipo: 'M', mouseAction: 'SU' })).toBe(
    'CFG:BN:M:P:0:SU:-:-',
  );
  expect(P.buildButtonCfg({ code: 'BA', tipo: 'M', mouseAction: '2' })).toBe('CFG:BA:M:P:0:2:-:-');
});

test('buildButtonCfg: teclado con y sin modificadores', () => {
  expect(P.buildButtonCfg({ code: 'BR', tipo: 'K', key: 's' })).toBe('CFG:BR:K:P:0:s:-:-');
  expect(P.buildButtonCfg({ code: 'BC', tipo: 'K', key: 'ENTER' })).toBe('CFG:BC:K:P:0:215:-:-');
  expect(P.buildButtonCfg({ code: 'BN', tipo: 'K', key: 'c', ctrl: true })).toBe(
    'CFG:BN:K:P:0:c:C:-',
  );
  expect(P.buildButtonCfg({ code: 'BN', tipo: 'K', key: '', ctrl: true, shift: true })).toBe(
    'CFG:BN:K:P:0:0:CS:-',
  );
});

test('buildButtonCfg: desactivado y modo/debounce personalizados', () => {
  expect(P.buildButtonCfg({ code: 'FU', tipo: 'X' })).toBe('CFG:FU:X:P:0:0:-:-');
  expect(
    P.buildButtonCfg({ code: 'BR', tipo: 'M', mouseAction: '1', modo: 'R', debounce: 150 }),
  ).toBe('CFG:BR:M:R:150:1:-:-');
});

test('buildButtonCfg: reproduce las líneas CFG del preset asterics_barrido', () => {
  const specs = /** @type {const} */ ([
    { code: 'BR', tipo: 'K', key: 's' },
    { code: 'BN', tipo: 'K', key: 's' },
    { code: 'BA', tipo: 'K', key: 'c' },
    { code: 'BC', tipo: 'K', key: 'c' },
    { code: 'FU', tipo: 'X' },
    { code: 'FD', tipo: 'X' },
    { code: 'FL', tipo: 'X' },
    { code: 'FR', tipo: 'X' },
  ]);
  expect(specs.map((s) => P.buildButtonCfg(s))).toEqual([
    'CFG:BR:K:P:0:s:-:-',
    'CFG:BN:K:P:0:s:-:-',
    'CFG:BA:K:P:0:c:-:-',
    'CFG:BC:K:P:0:c:-:-',
    'CFG:FU:X:P:0:0:-:-',
    'CFG:FD:X:P:0:0:-:-',
    'CFG:FL:X:P:0:0:-:-',
    'CFG:FR:X:P:0:0:-:-',
  ]);
});

// ── buildArrowCommands ─────────────────────────────────────────────────────

test('buildArrowCommands: modo cursor emite VEL y ACEL', () => {
  expect(P.buildArrowCommands({ fmode: 1, orient: 0, vel: 35, acel: true })).toEqual([
    'FMODE:1',
    'ORIENT:0',
    'VEL:35',
    'ACEL:1',
  ]);
});

test('buildArrowCommands: modo teclas ↑↓←→ no emite VEL/ACEL', () => {
  expect(P.buildArrowCommands({ fmode: 2, orient: 3 })).toEqual(['FMODE:2', 'ORIENT:3']);
});

test('buildArrowCommands: modo individual sí emite VEL/ACEL', () => {
  expect(P.buildArrowCommands({ fmode: 0, orient: 0, vel: 25, acel: false })).toEqual([
    'FMODE:0',
    'ORIENT:0',
    'VEL:25',
    'ACEL:0',
  ]);
});

test('buildButtonCfg + buildArrowCommands reproducen el preset std_enter completo', () => {
  const cmds = [
    P.buildButtonCfg({ code: 'BR', tipo: 'M', mouseAction: '1' }),
    P.buildButtonCfg({ code: 'BN', tipo: 'M', mouseAction: '1D' }),
    P.buildButtonCfg({ code: 'BC', tipo: 'K', key: 'ENTER' }),
    P.buildButtonCfg({ code: 'BA', tipo: 'M', mouseAction: '2' }),
    ...P.buildArrowCommands({ fmode: 1, orient: 0, vel: 35, acel: true }),
  ];
  expect(cmds).toEqual([
    'CFG:BR:M:P:0:1:-:-',
    'CFG:BN:M:P:0:1:-:D',
    'CFG:BC:K:P:0:215:-:-',
    'CFG:BA:M:P:0:2:-:-',
    'FMODE:1',
    'ORIENT:0',
    'VEL:35',
    'ACEL:1',
  ]);
});

// ── resolvePreset / primaryMod ─────────────────────────────────────────────

test('primaryMod: Mac → G, Windows → C', () => {
  expect(P.primaryMod('mac')).toBe('G');
  expect(P.primaryMod('win')).toBe('C');
});

test('resolvePreset: sustituye %P% según osMode (preset std_copy)', () => {
  const raw = ['CFG:BR:M:P:0:1:-:-', 'CFG:BN:K:P:0:c:%P%:-', 'CFG:BC:K:P:0:v:%P%:-', 'FMODE:1'];
  expect(P.resolvePreset(raw, 'win')).toEqual([
    'CFG:BR:M:P:0:1:-:-',
    'CFG:BN:K:P:0:c:C:-',
    'CFG:BC:K:P:0:v:C:-',
    'FMODE:1',
  ]);
  expect(P.resolvePreset(raw, 'mac')).toEqual([
    'CFG:BR:M:P:0:1:-:-',
    'CFG:BN:K:P:0:c:G:-',
    'CFG:BC:K:P:0:v:G:-',
    'FMODE:1',
  ]);
});

// ── parseWho ───────────────────────────────────────────────────────────────

test('parseWho: reconoce OK:WHO y extrae modelo/versión', () => {
  expect(P.parseWho('OK:WHO:disMouse:R019')).toEqual({ model: 'disMouse', version: 'R019' });
  expect(P.parseWho('OK:WHO:disHub:R013')).toEqual({ model: 'disHub', version: 'R013' });
  expect(P.parseWho('OK:WHO:AdMouse:R019')).toEqual({ model: 'AdMouse', version: 'R019' });
});

test('parseWho: null para cualquier otra línea', () => {
  expect(P.parseWho('FMODE:1')).toBeNull();
  expect(P.parseWho('OK:SAVED')).toBeNull();
});

// ── parseDeviceLine ────────────────────────────────────────────────────────

test('parseDeviceLine: vuelca ORIENT/VEL/ACEL/FMODE/BTN en el cfg', () => {
  const cfg = P.emptyCfg();
  ['FMODE:1', 'ORIENT:2', 'VEL:35', 'ACEL:1', 'BTN:0:0:0:0:1:0:0', 'BTN:2:1:0:50:99:1:0'].forEach(
    (l) => P.parseDeviceLine(l, cfg),
  );
  expect(cfg).toEqual({
    orient: 2,
    vel: 35,
    acel: 1,
    fmode: 1,
    btns: {
      0: { tipo: 0, modo: 0, debounce: 0, accion: 1, mods: 0, flags: 0 },
      2: { tipo: 1, modo: 0, debounce: 50, accion: 99, mods: 1, flags: 0 },
    },
  });
});

test('parseDeviceLine: ignora OK:WHO y líneas desconocidas', () => {
  const cfg = P.emptyCfg();
  P.parseDeviceLine('OK:WHO:disMouse:R019', cfg);
  P.parseDeviceLine('ruido cualquiera', cfg);
  expect(cfg).toEqual(P.emptyCfg());
});

// ── cfgToCommands (round-trip) ─────────────────────────────────────────────

test('cfgToCommands: round-trip de un cfg leído del dispositivo — QUIRK del separador "- "', () => {
  const cfg = {
    orient: 0,
    vel: 35,
    acel: 1,
    fmode: 1,
    btns: {
      0: { tipo: 0, modo: 0, debounce: 0, accion: 1, mods: 0, flags: 0 }, // BR: clic izquierdo
      2: { tipo: 1, modo: 0, debounce: 0, accion: 99, mods: 1, flags: 0 }, // BN: 'c' + Ctrl
    },
  };
  // QUIRK: el fallback sin mods/flags es '- ' (con espacio), no '-'. Es el
  // comportamiento actual de applyCustom(); se documenta, no se "corrige" acá.
  expect(P.cfgToCommands(cfg)).toEqual([
    'CFG:BR:M:P:0:1:- :- ',
    'CFG:BN:K:P:0:c:C:- ',
    'FMODE:1',
    'ORIENT:0',
    'VEL:35',
    'ACEL:1',
  ]);
});

test('cfgToCommands: scroll (8/16) y flags doble/mantener', () => {
  const cfg = {
    btns: {
      0: { tipo: 0, modo: 0, debounce: 0, accion: 8, mods: 0, flags: 0 }, // scroll ↑
      1: { tipo: 0, modo: 0, debounce: 0, accion: 1, mods: 0, flags: 1 }, // doble clic
      2: { tipo: 0, modo: 0, debounce: 0, accion: 1, mods: 0, flags: 2 }, // mantener
    },
  };
  expect(P.cfgToCommands(cfg)).toEqual([
    'CFG:BR:M:P:0:SU:- :- ',
    'CFG:BA:M:P:0:1:- :D',
    'CFG:BN:M:P:0:1:- :M',
  ]);
});

// ── Agregados del núcleo (no existían en protocol.js original) ─────────────

test('cfgToCommands: el modo 3 ("una vez por pulsación") se restaura como O, no como P', () => {
  const cfg = {
    btns: { 0: { tipo: 1, modo: 3, debounce: 0, accion: 97, mods: 0, flags: 0 } },
  };
  expect(P.cfgToCommands(cfg)[0]).toBe('CFG:BR:K:O:0:a:- :- ');
});

test('esComandoDeConfiguracion: acepta los comandos de los presets de fábrica', () => {
  const buenos = [
    'CFG:BR:K:P:0:s:-:-',
    'CFG:BN:K:P:0:215:-:-',
    'CFG:BA:K:P:0: :-:-', // espacio literal
    'CFG:FU:X:P:0:0:-:-',
    'CFG:BC:M:P:0:SU:-:-',
    'CFG:BN:K:P:0:c:C:-',
    'CFG:BR:K:O:0:a:- :- ', // forma que emite cfgToCommands (QUIRK del espacio)
    'FMODE:0',
    'FMODE:2',
    'ORIENT:3',
    'VEL:1',
    'VEL:50',
    'ACEL:0',
    'ACEL:1',
  ];
  for (const c of buenos) expect(P.esComandoDeConfiguracion(c)).toBe(true);
});

test('esComandoDeConfiguracion: rechaza SAVE, RESET, WHO, GETALL y lo mal formado', () => {
  const malos = [
    'SAVE',
    'RESET',
    'WHO',
    'GETALL',
    'PING',
    '',
    'cfg:BR:K:P:0:s:-:-', // minúscula
    'CFG:XX:K:P:0:s:-:-', // código inexistente
    'CFG:BR:Z:P:0:s:-:-', // tipo inválido
    'CFG:BR:K:Q:0:s:-:-', // modo inválido
    'CFG:BR:K:P:0:s:-', // faltan campos
    'CFG:BR:K:P:0:::-:-', // acción ':' rompe el formato
    'CFG:BR:K:P:9999:s:-:-', // debounce fuera de rango
    'FMODE:3',
    'ORIENT:4',
    'VEL:0',
    'VEL:51',
    'ACEL:2',
    'RESET\nCFG:BR:K:P:0:s:-:-',
  ];
  for (const c of malos) expect(P.esComandoDeConfiguracion(c)).toBe(false);
  expect(P.esComandoDeConfiguracion(null)).toBe(false);
});
