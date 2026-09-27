// @ts-check
import { EnsambladorDeLineas, partirEnPaquetes } from '../../js/features/dispositivo/lineas.js';

test('EnsambladorDeLineas: líneas completas', () => {
  /** @type {string[]} */
  const salida = [];
  const e = new EnsambladorDeLineas((l) => salida.push(l));
  e.empujar('OK:WHO:disMouse:R019\nORIENT:0\n');
  expect(salida).toEqual(['OK:WHO:disMouse:R019', 'ORIENT:0']);
});

test('EnsambladorDeLineas: una línea cortada en varios trozos', () => {
  /** @type {string[]} */
  const salida = [];
  const e = new EnsambladorDeLineas((l) => salida.push(l));
  e.empujar('OK:WH');
  e.empujar('O:disHub');
  expect(salida).toEqual([]);
  e.empujar(' BLE:R013\n');
  expect(salida).toEqual(['OK:WHO:disHub BLE:R013']);
});

test('EnsambladorDeLineas: ignora \\r y líneas vacías', () => {
  /** @type {string[]} */
  const salida = [];
  const e = new EnsambladorDeLineas((l) => salida.push(l));
  e.empujar('VEL:10\r\n\r\n\nACEL:1\r\n');
  expect(salida).toEqual(['VEL:10', 'ACEL:1']);
});

test('EnsambladorDeLineas: acepta bytes y no rompe caracteres multibyte cortados', () => {
  /** @type {string[]} */
  const salida = [];
  const e = new EnsambladorDeLineas((l) => salida.push(l));
  const bytes = new TextEncoder().encode('Flecha ↑\n'); // ↑ ocupa 3 bytes
  e.empujar(bytes.slice(0, 8)); // corta en medio de la flecha
  e.empujar(bytes.slice(8));
  expect(salida).toEqual(['Flecha ↑']);
});

test('EnsambladorDeLineas: reiniciar descarta lo pendiente', () => {
  /** @type {string[]} */
  const salida = [];
  const e = new EnsambladorDeLineas((l) => salida.push(l));
  e.empujar('basura sin terminar');
  e.reiniciar();
  e.empujar('OK\n');
  expect(salida).toEqual(['OK']);
});

test('partirEnPaquetes: paquetes de a lo sumo 20 bytes (MTU mínimo BLE)', () => {
  const bytes = new TextEncoder().encode('CFG:BR:K:P:0:215:-:-\n'); // 21 bytes
  const p = partirEnPaquetes(bytes, 20);
  expect(p.map((x) => x.length)).toEqual([20, 1]);
  const juntos = new Uint8Array(p.flatMap((x) => [...x]));
  expect(new TextDecoder().decode(juntos)).toBe('CFG:BR:K:P:0:215:-:-\n');
});

test('partirEnPaquetes: mensaje corto y tamaño inválido', () => {
  expect(partirEnPaquetes(new TextEncoder().encode('WHO\n'), 20)).toHaveLength(1);
  expect(partirEnPaquetes(new Uint8Array(0), 20)).toEqual([]);
  expect(() => partirEnPaquetes(new Uint8Array(3), 0)).toThrow();
});
