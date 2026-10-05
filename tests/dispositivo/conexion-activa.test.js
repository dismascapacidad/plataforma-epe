import { describe, it, expect } from 'vitest';
import { respaldoOriginal, olvidarRespaldoOriginal } from '../../js/features/configurar-dispositivo/conexion-activa.js';

describe('respaldo original por conexión', () => {
  it('conserva el primero aunque lleguen respaldos posteriores', () => {
    const c = {};
    const inicial = { cfg: 'inicial' };
    expect(respaldoOriginal(c, inicial)).toBe(inicial);
    expect(respaldoOriginal(c, { cfg: 'del juego 1' })).toBe(inicial);
  });
  it('tras restaurar con éxito, el siguiente parte de cero', () => {
    const c = {};
    respaldoOriginal(c, { cfg: 'a' });
    olvidarRespaldoOriginal(c);
    const nuevo = { cfg: 'b' };
    expect(respaldoOriginal(c, nuevo)).toBe(nuevo);
  });
  it('conexiones distintas no se mezclan', () => {
    const a = {}, b = {};
    respaldoOriginal(a, { cfg: 'a' });
    expect(respaldoOriginal(b, { cfg: 'b' })).toEqual({ cfg: 'b' });
  });
});
