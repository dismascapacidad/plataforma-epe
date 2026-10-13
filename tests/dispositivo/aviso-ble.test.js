// @ts-check
import {
  sistemaDe,
  pasosParaJugar,
  pasosParaRestaurar,
  CODIGO_SOLTADO_PARA_JUGAR,
} from '../../js/features/dispositivo/aviso-ble.js';

test('sistemaDe: reconoce Android y trata todo lo demás como "otro"', () => {
  expect(sistemaDe('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126')).toBe('android');
  expect(sistemaDe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126')).toBe('otro');
  expect(sistemaDe('')).toBe('otro');
  expect(sistemaDe(undefined)).toBe('otro');
});

test('pasosParaJugar: en Android hay que olvidar y volver a conectar', () => {
  const pasos = pasosParaJugar('android', 'disMouse-A1B2');
  expect(pasos).toHaveLength(2);
  expect(pasos[0]).toContain('«disMouse-A1B2»');
  expect(pasos[0]).toContain('Olvidar');
});

test('pasosParaJugar: en el resto alcanza con conectarlo desde el sistema', () => {
  const pasos = pasosParaJugar('otro', 'disMouse-A1B2');
  expect(pasos).toHaveLength(1);
  expect(pasos[0]).toContain('«disMouse-A1B2»');
  expect(pasos[0]).not.toContain('Olvidar');
});

test('sin nombre se habla de "el dispositivo"', () => {
  expect(pasosParaJugar('otro', '')[0]).toContain('el dispositivo');
  expect(pasosParaJugar('otro', '   ')[0]).not.toContain('«');
  expect(pasosParaRestaurar('android', undefined)[0]).toContain('el dispositivo');
});

test('pasosParaRestaurar: termina indicando cómo volver a elegirlo', () => {
  for (const sistema of /** @type {const} */ (['android', 'otro'])) {
    const pasos = pasosParaRestaurar(sistema, 'X');
    expect(pasos.at(-1)).toContain('Elegir dispositivo');
  }
});

test('el código de error es estable', () => {
  expect(CODIGO_SOLTADO_PARA_JUGAR).toBe('soltado-para-jugar');
});
