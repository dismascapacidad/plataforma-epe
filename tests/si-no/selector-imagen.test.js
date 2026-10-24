import { describe, it, expect } from 'vitest';
import {
  ladoReducido,
  archivoAceptable,
  MAX_LADO,
} from '../../js/features/apps-epe/_comun/selector-imagen.js';

describe('ladoReducido', () => {
  it('no agranda una imagen que ya es chica', () => {
    expect(ladoReducido(200, 100)).toEqual({ ancho: 200, alto: 100 });
  });
  it('reduce el lado mayor a MAX_LADO conservando la proporción', () => {
    expect(ladoReducido(1600, 800)).toEqual({ ancho: MAX_LADO, alto: MAX_LADO / 2 });
    expect(ladoReducido(500, 2000)).toEqual({ ancho: 100, alto: MAX_LADO });
  });
  it('nunca devuelve 0', () => {
    expect(ladoReducido(10000, 1)).toEqual({ ancho: MAX_LADO, alto: 1 });
    expect(ladoReducido(0, 0)).toEqual({ ancho: 1, alto: 1 });
  });
});

describe('archivoAceptable', () => {
  it('acepta PNG/JPEG/WebP razonables', () => {
    expect(archivoAceptable({ type: 'image/png', size: 1000 }).ok).toBe(true);
    expect(archivoAceptable({ type: 'image/jpeg', size: 5_000_000 }).ok).toBe(true);
    expect(archivoAceptable({ type: 'image/webp', size: 10 }).ok).toBe(true);
  });
  it('rechaza SVG, otros tipos, enormes y vacío', () => {
    expect(archivoAceptable({ type: 'image/svg+xml', size: 10 }).ok).toBe(false);
    expect(archivoAceptable({ type: 'application/pdf', size: 10 }).ok).toBe(false);
    expect(archivoAceptable({ type: 'image/png', size: 11 * 1024 * 1024 }).ok).toBe(false);
    expect(archivoAceptable(null).ok).toBe(false);
  });
});
