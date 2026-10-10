import { describe, it, expect } from 'vitest';
import {
  admiteCombinar,
  armarComandos,
  candidatasParaLarga,
  capacidadEventos,
  cuantasEntran,
  cursorInicial,
  describir,
  describirCombinado,
  pideCursor,
  puedeCombinar,
  requisitosConBoton,
  umbralEfectivo,
  TH_DEFAULT_MS,
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

describe('un botón, dos eventos (Tap-Hold)', () => {
  const [k1, k2, m1, m2, dc, ar] = req([
    { id: 'avanzar', etiqueta: 'Avanzar', tecla: 'k' },
    { id: 'seleccionar', etiqueta: 'Seleccionar', tecla: 'l' },
    { id: 'm1', etiqueta: 'Clic', mouse: 'clic' },
    { id: 'm2', etiqueta: 'Derecho', mouse: 'clic-derecho' },
    { id: 'dc', etiqueta: 'Doble', mouse: 'doble-clic' },
    { id: 'ar', etiqueta: 'Arrastrar', arrastrar: true },
  ]);

  it('dos teclas en un botón: modo T con acción larga y umbral por defecto', () => {
    const cmds = armarComandos({ asignaciones: [{ requisito: k1, codigo: 'BR', largo: k2 }] });
    expect(cmds).toEqual(['CFG:BR:K:T:0:k:-:-:l:0:0:1000']);
  });

  it('umbral elegido, acotado a 100..5000', () => {
    const a = (umbral) => armarComandos({ asignaciones: [{ requisito: k1, codigo: 'BR', largo: k2, umbral }] })[0];
    expect(a(750)).toMatch(/:750$/);
    expect(a(10)).toMatch(/:100$/);
    expect(a(99999)).toMatch(/:5000$/);
    expect(a(0)).toMatch(/:1000$/);
  });

  it('mouse corto y mouse largo', () => {
    const cmds = armarComandos({ asignaciones: [{ requisito: m1, codigo: 'BA', largo: m2, umbral: 500 }] });
    expect(cmds).toEqual(['CFG:BA:M:T:0:1:-:-:2:0:0:500']);
  });

  it('con teclas especiales y modificadores en la larga', () => {
    const [a, b] = req([
      { id: 'a', etiqueta: 'A', tecla: ' ' },
      { id: 'b', etiqueta: 'B', tecla: 'arrowleft', mods: ['ctrl'] },
    ]);
    const [c] = armarComandos({ asignaciones: [{ requisito: a, codigo: 'BN', largo: b }] });
    expect(c).toContain(':211:C:');
    expect(c.startsWith('CFG:BN:K:T:0: :')).toBe(true);
  });

  it('tipos distintos no se combinan: la larga se ignora y queda un botón común', () => {
    expect(puedeCombinar(k1, m1)).toBe(false);
    const cmds = armarComandos({ asignaciones: [{ requisito: k1, codigo: 'BR', largo: m1 }] });
    expect(cmds).toEqual(['CFG:BR:K:P:0:k:-:-']);
  });

  it('puedeCombinar: teclas sí; mouse sí salvo doble clic como larga; arrastrar y cursor nunca', () => {
    expect(puedeCombinar(k1, k2)).toBe(true);
    expect(puedeCombinar(m1, m2)).toBe(true);
    expect(puedeCombinar(m1, dc)).toBe(false);
    expect(puedeCombinar(dc, m1)).toBe(true);
    expect(puedeCombinar(ar, m1)).toBe(false);
    expect(puedeCombinar(m1, ar)).toBe(false);
    expect(puedeCombinar(null, k1)).toBe(false);
  });

  it('candidatasParaLarga: solo botones sin larga y del mismo tipo', () => {
    const asig = [
      { requisito: k1, codigo: 'BR' },
      { requisito: m1, codigo: 'BA' },
      { requisito: k2, codigo: 'BN', largo: k1 },
    ];
    const [otra] = req([{ id: 'x', etiqueta: 'X', tecla: 'x' }]);
    expect(candidatasParaLarga(asig, otra).map((a) => a.codigo)).toEqual(['BR']);
  });

  it('capacidadEventos: el doble solo con Tap-Hold', () => {
    expect(capacidadEventos(2, false)).toBe(2);
    expect(capacidadEventos(2, true)).toBe(4);
  });

  it('umbralEfectivo y describirCombinado', () => {
    expect(umbralEfectivo(undefined)).toBe(TH_DEFAULT_MS);
    expect(umbralEfectivo('')).toBe(TH_DEFAULT_MS);
    expect(umbralEfectivo(20)).toBe(100);
    expect(describirCombinado(k1, k2, 800)).toBe(
      'toque: Avanzar (tecla K) · pulsación larga de 800 ms: Seleccionar (tecla L)',
    );
  });

  it('sin larga todo queda igual que antes (compatibilidad)', () => {
    const a = armarComandos({ asignaciones: [{ requisito: k1, codigo: 'BR' }] });
    const b = armarComandos({ asignaciones: [{ requisito: k1, codigo: 'BR', largo: null, umbral: 700 }] });
    expect(b).toEqual(a);
    expect(a).toEqual(['CFG:BR:K:P:0:k:-:-']);
  });

  it('lo que se arma pasa la lista blanca del núcleo', () => {
    const cmds = armarComandos({
      asignaciones: [
        { requisito: k1, codigo: 'BR', largo: k2, umbral: 1500 },
        { requisito: m1, codigo: 'BA', largo: m2 },
        { requisito: dc, codigo: 'BN', largo: m1, umbral: 300 },
      ],
    });
    expect(cmds.length).toBe(3);
    for (const c of cmds) expect(esComandoDeConfiguracion(c)).toBe(true);
  });
});

describe('quién admite combinar (app entera o acción por acción)', () => {
  const [k1, k2, k3, m1, ar, cu] = req([
    { id: 'k1', etiqueta: 'K1', tecla: 'a', combinable: true },
    { id: 'k2', etiqueta: 'K2', tecla: 'b', combinable: true },
    { id: 'k3', etiqueta: 'K3', tecla: 'c' },
    { id: 'm1', etiqueta: 'M1', mouse: 'clic', combinable: true },
    { id: 'ar', etiqueta: 'Arrastrar', arrastrar: true },
    { id: 'cu', etiqueta: 'Cursor', cursor: true },
  ]);

  it('admiteCombinar: la app lo pide para todas, o la acción lo declara', () => {
    expect(admiteCombinar(k1)).toBe(true);
    expect(admiteCombinar(k3)).toBe(false);
    expect(admiteCombinar(k3, true)).toBe(true);
    expect(admiteCombinar(m1)).toBe(true);
  });

  it('arrastrar y cursor nunca se combinan, ni aunque la app lo pida', () => {
    expect(admiteCombinar(ar, true)).toBe(false);
    expect(admiteCombinar(cu, true)).toBe(false);
    expect(admiteCombinar(null, true)).toBe(false);
  });

  it('cuantasEntran: sin Tap-Hold es uno por botón', () => {
    expect(cuantasEntran([k1, k2, k3], 2, false, true)).toBe(2);
    expect(cuantasEntran([k1, k2, k3], 2, false)).toBe(2);
  });

  it('cuantasEntran: con la app combinando todo, el doble de botones', () => {
    const cuatro = [k1, k2, k3, m1];
    expect(cuantasEntran(cuatro, 2, true, true)).toBe(4);
    expect(cuantasEntran(cuatro, 1, true, true)).toBe(2);
  });

  it('cuantasEntran: solo comparten las acciones combinables; las demás ocupan botón propio', () => {
    // k1 y k2 comparten un botón; k3 (no combinable) necesita otro.
    expect(cuantasEntran([k1, k2, k3], 2, true)).toBe(3);
    // Con un solo botón entran únicamente las dos combinables.
    expect(cuantasEntran([k1, k2, k3], 1, true)).toBe(2);
    // Una sola combinable no tiene con quién compartir.
    expect(cuantasEntran([k1, k3], 1, true)).toBe(1);
  });

  it('cuantasEntran: arrastrar ocupa un botón propio aunque la app combine todo', () => {
    expect(cuantasEntran([ar, k1, k2], 2, true, true)).toBe(3);
    expect(cuantasEntran([ar, k1, k2], 1, true, true)).toBe(1);
  });

  it('la regla de a pares: las dos acciones tienen que admitirlo', () => {
    const asig = [
      { requisito: k3, codigo: 'BR' },
      { requisito: k1, codigo: 'BA' },
    ];
    const util = (a, entrada) =>
      candidatasParaLarga(asig, entrada).filter((c) => admiteCombinar(c.requisito) && admiteCombinar(entrada));
    expect(util(asig, k2).map((a) => a.codigo)).toEqual(['BA']); // k3 no admite
    expect(util(asig, k3)).toEqual([]); // k3 como larga tampoco
  });
});
