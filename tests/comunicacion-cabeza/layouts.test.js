import {
  celdasTablero,
  plantillaTablero,
  medirTablero,
  LAYOUTS,
} from '../../js/features/apps-epe/comunicacion-cabeza/grilla.js';

const ids = (layout) => celdasTablero(layout).map((c) => c.id);

describe('layouts del tablero', () => {
  it('ABC es el orden alfabético, con Ñ después de N', () => {
    const letras = celdasTablero('abc')
      .filter((c) => c.tipo === 'letra')
      .map((c) => c.etiqueta)
      .join('');
    expect(letras).toBe('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ');
  });

  it('QWERTY sigue las filas de un teclado español', () => {
    const letras = celdasTablero('qwerty')
      .filter((c) => c.tipo === 'letra')
      .map((c) => c.etiqueta)
      .join('');
    expect(letras).toBe('QWERTYUIOPASDFGHJKLÑZXCVBNM');
  });

  it('las dos disposiciones tienen las mismas 31 celdas (mismos ids)', () => {
    expect(ids('abc')).toHaveLength(31);
    expect(ids('qwerty')).toHaveLength(31);
    expect([...ids('abc')].sort()).toEqual([...ids('qwerty')].sort());
    LAYOUTS.forEach((l) => expect(new Set(ids(l)).size).toBe(31));
  });

  it('una disposición desconocida cae en ABC', () => {
    expect(ids('otra')).toEqual(ids('abc'));
  });

  it('la plantilla QWERTY ocupa exactamente cols x filas', () => {
    const p = plantillaTablero('qwerty');
    const total = celdasTablero('qwerty').reduce((n, c) => n + (p.spans[c.id] ?? 1), 0);
    expect(total).toBe(p.cols * p.filas);
  });

  it('las filas de QWERTY cierran justo (10, 10, 10, 10 columnas)', () => {
    const p = plantillaTablero('qwerty');
    let col = 0;
    const cierres = [];
    celdasTablero('qwerty').forEach((c) => {
      col += p.spans[c.id] ?? 1;
      if (col === p.cols) {
        cierres.push(c.id);
        col = 0;
      }
      expect(col).toBeLessThan(p.cols);
    });
    expect(cierres).toHaveLength(p.filas);
    expect(cierres.at(-1)).toBe('a-hablar');
  });

  it('ABC no tiene plantilla fija', () => expect(plantillaTablero('abc')).toBeNull());
});

describe('medirTablero', () => {
  it('QWERTY: 10 columnas x 4 filas y aviso de mínimo', () => {
    const grande = medirTablero({ layout: 'qwerty', ancho: 1240, alto: 560, celdaMin: 100 });
    expect(grande.cols).toBe(10);
    expect(grande.filas).toBe(4);
    expect(grande.cumpleMinimo).toBe(true);
    const chico = medirTablero({ layout: 'qwerty', ancho: 1240, alto: 560, celdaMin: 120 });
    expect(chico.cumpleMinimo).toBe(false); // ~116 px de ancho
  });

  it('ABC usa la grilla adaptativa', () => {
    const g = medirTablero({ layout: 'abc', ancho: 1240, alto: 500, celdaMin: 80 });
    expect(g.cols * g.filas).toBeGreaterThanOrEqual(31);
    expect(g.spans).toEqual({});
  });

  it('espacio nulo no rompe', () => {
    expect(medirTablero({ layout: 'qwerty', ancho: 0, alto: 0 }).cumpleMinimo).toBe(false);
  });
});

describe('zona de descanso (dwell)', () => {
  const base = { ancho: 1200, alto: 560, celdaMin: 60, gap: 8 };
  const ocupadas = (info) => {
    const set = new Set();
    for (const p of Object.values(info.posiciones)) {
      for (let c = p.col; c < p.col + p.cols; c += 1) set.add(`${c},${p.fila}`);
    }
    return set;
  };

  it('sin descanso no hay hueco ni posiciones explícitas', () => {
    const info = medirTablero({ ...base, layout: 'abc' });
    expect(info.hueco).toBeNull();
    expect(info.posiciones).toBeNull();
  });

  it('ABC: el hueco queda al centro, rodeado de celdas, y no pisa ninguna', () => {
    ['chica', 'mediana'].forEach((tam) => {
      const info = medirTablero({ ...base, layout: 'abc', descanso: tam });
      const h = info.hueco;
      expect(h.cols).toBe(tam === 'chica' ? 1 : 2);
      expect(h.filas).toBe(h.cols);
      expect(h.col).toBeGreaterThan(1);
      expect(h.fila).toBeGreaterThan(1);
      expect(h.col + h.cols - 1).toBeLessThan(info.cols);
      expect(h.fila + h.filas - 1).toBeLessThan(info.filas);
      const pos = info.posiciones;
      expect(Object.keys(pos)).toHaveLength(31);
      const usadas = ocupadas(info);
      expect(usadas.size).toBe(31);
      for (let c = h.col; c < h.col + h.cols; c += 1) {
        for (let f = h.fila; f < h.fila + h.filas; f += 1)
          expect(usadas.has(`${c},${f}`)).toBe(false);
      }
      Object.values(pos).forEach((p) => {
        expect(p.col + p.cols - 1).toBeLessThanOrEqual(info.cols);
        expect(p.fila).toBeLessThanOrEqual(info.filas);
      });
    });
  });

  it('ABC: mantiene el orden alfabético de lectura', () => {
    const info = medirTablero({ ...base, layout: 'abc', descanso: 'mediana' });
    const orden = Object.entries(info.posiciones)
      .sort(([, a], [, b]) => a.fila - b.fila || a.col - b.col)
      .map(([id]) => id);
    expect(orden).toEqual(ids('abc'));
  });

  it('QWERTY: suma una fila y deja la franja de descanso entre la 2.ª y la 3.ª de letras', () => {
    const sin = medirTablero({ ...base, layout: 'qwerty' });
    const info = medirTablero({ ...base, layout: 'qwerty', descanso: 'mediana' });
    expect(info.filas).toBe(sin.filas + 1);
    expect(info.hueco).toEqual({ col: 4, fila: 3, cols: 4, filas: 1 });
    const usadas = ocupadas(info);
    expect(usadas.size).toBe(10 + 10 + 7 + 1 + 2 + 6 + 4);
    // Nada en la fila 3: es la franja.
    for (let c = 1; c <= 10; c += 1) expect(usadas.has(`${c},3`)).toBe(false);
    expect(info.posiciones['l-Q'].fila).toBe(1);
    expect(info.posiciones['l-A'].fila).toBe(2);
    expect(info.posiciones['l-Z'].fila).toBe(4);
    expect(info.posiciones['a-espacio'].fila).toBe(5);
    expect(info.posiciones['a-hablar'].fila).toBe(5);
  });

  it('QWERTY chica: franja de 2 columnas, centrada', () => {
    const info = medirTablero({ ...base, layout: 'qwerty', descanso: 'chica' });
    expect(info.hueco).toEqual({ col: 5, fila: 3, cols: 2, filas: 1 });
  });

  it('el hueco achica las celdas respecto del tablero sin descanso', () => {
    const sin = medirTablero({ ...base, layout: 'abc' });
    const con = medirTablero({ ...base, layout: 'abc', descanso: 'mediana' });
    expect(Math.min(con.celdaAncho, con.celdaAlto)).toBeLessThanOrEqual(
      Math.min(sin.celdaAncho, sin.celdaAlto),
    );
  });
});
