// @ts-check
import {
  PRODUCTOS,
  normalizarModelo,
  productoPorModelo,
  todasLasEntradas,
  entradasAsignables,
} from '../../js/features/dispositivo/productos.js';
import { BTN_CODES } from '../../js/features/dispositivo/protocolo.js';

test('cada producto usa solo códigos válidos y sin repetir', () => {
  for (const p of Object.values(PRODUCTOS)) {
    const codigos = todasLasEntradas(p).map((e) => e.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const c of codigos) expect(BTN_CODES).toContain(c);
  }
});

test('cantidad de entradas por modelo (según el configurador actual)', () => {
  expect(todasLasEntradas(PRODUCTOS.dismouse)).toHaveLength(8);
  expect(todasLasEntradas(PRODUCTOS.disjoystick)).toHaveLength(8);
  expect(todasLasEntradas(PRODUCTOS.disbutton)).toHaveLength(1);
  expect(todasLasEntradas(PRODUCTOS.dishub)).toHaveLength(8);
  expect(todasLasEntradas(PRODUCTOS.dishubmini)).toHaveLength(6);
  expect(todasLasEntradas(PRODUCTOS.dishubkeys)).toHaveLength(4);
});

test('el id de cada producto coincide con su clave', () => {
  for (const [clave, p] of Object.entries(PRODUCTOS)) expect(p.id).toBe(clave);
});

test('normalizarModelo: minúscula y sin espacios', () => {
  expect(normalizarModelo('disHub BLE')).toBe('dishubble');
  expect(normalizarModelo('  disMouse ')).toBe('dismouse');
  expect(normalizarModelo(null)).toBe('');
});

test('productoPorModelo: nombres reales devueltos por WHO', () => {
  expect(productoPorModelo('disMouse')?.id).toBe('dismouse');
  expect(productoPorModelo('disHub BLE')?.id).toBe('dishub'); // caso real de la prueba de hardware
  expect(productoPorModelo('disButton')?.id).toBe('disbutton');
  expect(productoPorModelo('disJoystick')?.id).toBe('disjoystick');
  expect(productoPorModelo('disHub mini')?.id).toBe('dishubmini');
  expect(productoPorModelo('disHub keys')?.id).toBe('dishubkeys');
});

test('productoPorModelo: variantes y alias del configurador actual', () => {
  expect(productoPorModelo('DISMOUSE')?.id).toBe('dismouse');
  expect(productoPorModelo('AdMouse')?.id).toBe('dismouse');
  expect(productoPorModelo('disButton BT')?.id).toBe('disbutton');
  expect(productoPorModelo('disHub BT')?.id).toBe('dishub');
});

test('productoPorModelo: modelo desconocido o vacío → null', () => {
  expect(productoPorModelo('disMouth')).toBeNull(); // sin soporte completo todavía
  expect(productoPorModelo('Otra cosa')).toBeNull();
  expect(productoPorModelo('')).toBeNull();
  expect(productoPorModelo(undefined)).toBeNull();
});

test('entradasAsignables: flechas de disMouse solo con FMODE 0', () => {
  const m = PRODUCTOS.dismouse;
  expect(entradasAsignables(m, 0)).toHaveLength(8);
  expect(entradasAsignables(m, 1)).toHaveLength(4); // cursor
  expect(entradasAsignables(m, 2)).toHaveLength(4); // teclas ↑↓←→
  expect(entradasAsignables(m, null)).toHaveLength(4); // desconocido → lo seguro
});

test('entradasAsignables: en disHub las secundarias siempre son entradas propias', () => {
  expect(entradasAsignables(PRODUCTOS.dishub, 1)).toHaveLength(8);
  expect(entradasAsignables(PRODUCTOS.dishubmini, null)).toHaveLength(6);
  expect(entradasAsignables(PRODUCTOS.disbutton, 2)).toHaveLength(1);
});
