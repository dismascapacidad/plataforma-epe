// @ts-check
import {
  leerVersion,
  compararVersiones,
  estaDesactualizado,
  ULTIMAS_VERSIONES,
} from '../../js/features/dispositivo/firmware.js';

test('leerVersion: versión simple', () => {
  expect(leerVersion('R019')).toEqual({ numero: 19, sufijo: '', texto: 'R019' });
});

test('leerVersion: con sufijo tras el guion (caso real R019-TH1)', () => {
  expect(leerVersion('R019-TH1')).toEqual({ numero: 19, sufijo: 'TH1', texto: 'R019-TH1' });
});

test('leerVersion: tolera minúscula y espacios en los extremos', () => {
  expect(leerVersion('  r013 ')?.numero).toBe(13);
});

test('leerVersion: null si no tiene el formato', () => {
  expect(leerVersion('')).toBeNull();
  expect(leerVersion(undefined)).toBeNull();
  expect(leerVersion('19')).toBeNull();
  expect(leerVersion('V019')).toBeNull();
  expect(leerVersion('R')).toBeNull();
});

test('compararVersiones: por número, ignorando el sufijo', () => {
  expect(compararVersiones('R019-TH1', 'R019')).toBe(0);
  expect(compararVersiones('R018', 'R019')).toBeLessThan(0);
  expect(compararVersiones('R020', 'R019-TH1')).toBeGreaterThan(0);
});

test('compararVersiones: null si alguna no se puede leer', () => {
  expect(compararVersiones('???', 'R019')).toBeNull();
  expect(compararVersiones('R019', '')).toBeNull();
});

test('regresión: R019-TH1 NO se lee como 191 (error del configurador actual)', () => {
  // Con parseInt(replace(/\D/g,'')) daba 191 y un futuro R020 quedaría "más viejo".
  expect(leerVersion('R019-TH1')?.numero).toBe(19);
  expect(compararVersiones('R019-TH1', 'R020')).toBeLessThan(0);
});

test('estaDesactualizado: compara contra la última versión del modelo', () => {
  expect(estaDesactualizado('disMouse', 'R018')).toBe(true);
  expect(estaDesactualizado('disMouse', 'R019')).toBe(false);
  expect(estaDesactualizado('disMouse', 'R019-TH1')).toBe(false);
  expect(estaDesactualizado('disHub', 'R012')).toBe(true);
});

test('estaDesactualizado: modelo sin versión conocida o versión ilegible → false', () => {
  expect(estaDesactualizado('disHub BLE', 'R013')).toBe(false); // no figura en la tabla
  expect(estaDesactualizado('disMouse', 'rara')).toBe(false);
  expect(estaDesactualizado('Desconocido', 'R001')).toBe(false);
});

test('la tabla de últimas versiones coincide con la del configurador actual', () => {
  expect(ULTIMAS_VERSIONES).toEqual({
    disMouse: 'R019',
    disButton: 'R019',
    disHub: 'R013',
    disMouth: 'R001',
  });
});
