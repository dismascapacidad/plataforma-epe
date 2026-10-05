import { describe, it, expect } from 'vitest';
import {
  armarComandos,
  cursorInicial,
  describir,
  pideCursor,
  requisitosConBoton,
  VEL_DEFECTO,
} from '../../js/features/configurar-dispositivo/comandos.js';
import { validarTeclas } from '../../js/features/configurar-dispositivo/teclas-externas.js';
import { esComandoDeConfiguracion } from '../../js/features/dispositivo/protocolo.js';

const req = (v) => validarTeclas(v);

describe('armarComandos', () => {
  it('tecla: espacio sale como SPACE (nunca un nombre sin traducir)', () => {
    const [r] = req([{ id: 'e', etiqueta: 'Espacio', tecla: ' ' }]);
    expect(armarComandos({ asignaciones: [{ requisito: r, codigo: 'BR' }] })).toEqual(['CFG:BR:K:P:0: :-:-']);
  });

  it('tecla con modificadores', () => {
    const [r] = req([{ id: 'z', etiqueta: 'Deshacer', tecla: 'z', mods: ['ctrl', 'shift'] }]);
    expect(armarComandos({ asignaciones: [{ requisito: r, codigo: 'BA' }] })).toEqual(['CFG:BA:K:P:0:z:CS:-']);
  });

  it('mouse: clic, derecho, doble clic y scroll', () => {
    const lista = req([
      { id: 'a', etiqueta: 'A', mouse: 'clic' },
      { id: 'b', etiqueta: 'B', mouse: 'clic-derecho' },
      { id: 'c', etiqueta: 'C', mouse: 'doble-clic' },
      { id: 'd', etiqueta: 'D', mouse: 'scroll-abajo' },
    ]);
    const codigos = ['BR', 'BA', 'BN', 'BC'];
    const cmds = armarComandos({ asignaciones: lista.map((requisito, i) => ({ requisito, codigo: codigos[i] })) });
    expect(cmds).toEqual([
      'CFG:BR:M:P:0:1:-:-',
      'CFG:BA:M:P:0:2:-:-',
      'CFG:BN:M:P:0:1:-:D',
      'CFG:BC:M:P:0:SD:-:-',
    ]);
  });

  it('arrastrar: "toque" deja el clic mantenido (flag M); "mantener" es clic simple al presionar', () => {
    const [r] = req([{ id: 'ar', etiqueta: 'Arrastrar', arrastrar: true }]);
    const a = [{ requisito: r, codigo: 'BR' }];
    expect(armarComandos({ asignaciones: a, arrastre: 'toque' })).toEqual(['CFG:BR:M:P:0:1:-:M']);
    expect(armarComandos({ asignaciones: a, arrastre: 'mantener' })).toEqual(['CFG:BR:M:P:0:1:-:-']);
  });

  it('cursor: FMODE:1 con la velocidad y aceleración elegidas, sin tocar ORIENT', () => {
    const cmds = armarComandos({ asignaciones: [], cursor: { vel: 22, acel: true } });
    expect(cmds).toEqual(['FMODE:1', 'VEL:22', 'ACEL:1']);
    expect(cmds.some((c) => c.startsWith('ORIENT'))).toBe(false);
  });

  it('la velocidad se acota a 1..50', () => {
    expect(armarComandos({ asignaciones: [], cursor: { vel: 999, acel: false } })).toContain('VEL:50');
    expect(armarComandos({ asignaciones: [], cursor: { vel: -4, acel: false } })).toContain('VEL:1');
  });

  it('modo individual: solo si se pide y no hay cursor', () => {
    expect(armarComandos({ asignaciones: [], modoIndividual: true })).toEqual(['FMODE:0']);
    expect(armarComandos({ asignaciones: [], cursor: { vel: 10, acel: false }, modoIndividual: true })).not.toContain(
      'FMODE:0',
    );
  });

  it('TODO lo que se arma pasa la lista blanca del núcleo', () => {
    const lista = req([
      { id: 'cursor', etiqueta: 'Cursor', cursor: true },
      { id: 'ar', etiqueta: 'Arrastrar', arrastrar: true },
      { id: 'k', etiqueta: 'Tecla', tecla: 'arrowleft', mods: ['alt'] },
      { id: 'm', etiqueta: 'Mouse', mouse: 'clic-central' },
    ]);
    const botones = requisitosConBoton(lista);
    const cmds = armarComandos({
      asignaciones: botones.map((requisito, i) => ({ requisito, codigo: ['BR', 'BA', 'BN'][i] })),
      cursor: { vel: 15, acel: false },
      arrastre: 'toque',
    });
    expect(cmds.length).toBe(6);
    for (const c of cmds) expect(esComandoDeConfiguracion(c)).toBe(true);
  });
});

describe('pideCursor / requisitosConBoton', () => {
  it('el cursor no consume botón', () => {
    const l = req([
      { id: 'cursor', etiqueta: 'Cursor', cursor: true },
      { id: 'ar', etiqueta: 'Arrastrar', arrastrar: true },
    ]);
    expect(pideCursor(l)).toBe(true);
    expect(requisitosConBoton(l).map((r) => r.id)).toEqual(['ar']);
    expect(pideCursor(req([{ id: 'e', etiqueta: 'E', tecla: ' ' }]))).toBe(false);
  });
});

describe('cursorInicial', () => {
  it('conserva la velocidad que ya tenía el dispositivo', () => {
    expect(cursorInicial({ vel: 30, acel: 1 })).toEqual({ vel: 30, acel: true });
  });
  it('usa el default si no hay dato o está fuera de rango', () => {
    expect(cursorInicial(null)).toEqual({ vel: VEL_DEFECTO, acel: false });
    expect(cursorInicial({ vel: 0, acel: 0 }).vel).toBe(VEL_DEFECTO);
    expect(cursorInicial({ vel: 77, acel: 0 }).vel).toBe(VEL_DEFECTO);
    expect(cursorInicial({ vel: null, acel: null })).toEqual({ vel: VEL_DEFECTO, acel: false });
  });
});

describe('describir', () => {
  it('frases legibles', () => {
    const [t, m, a] = req([
      { id: 't', etiqueta: 'T', tecla: ' ' },
      { id: 'm', etiqueta: 'M', mouse: 'doble-clic' },
      { id: 'a', etiqueta: 'A', arrastrar: true },
    ]);
    expect(describir(t)).toBe('tecla Espacio');
    expect(describir(m)).toBe('doble clic');
    expect(describir(a, 'toque')).toContain('un toque agarra');
    expect(describir(a, 'mantener')).toContain('mantenés presionado');
  });
});
