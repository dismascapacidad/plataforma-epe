/**
 * grilla.js
 * Celdas del tablero y cálculo de la grilla adaptada al espacio disponible.
 *
 * Por qué se calcula: con un puntero de cabeza no se puede hacer scroll, así
 * que todas las celdas tienen que caber en pantalla. En vez de fijar un
 * tamaño, se busca la cantidad de columnas que da la celda más grande
 * posible, y se avisa al profesional si igual queda por debajo del mínimo
 * que configuró (el temblor de la cabeza obliga a celdas grandes).
 *
 * Módulo puro: no toca el DOM.
 */

/** Tipos de celda: 'letra' agrega su texto; el resto son acciones. */
export const ACCIONES = {
  ESPACIO: 'espacio',
  BORRAR: 'borrar',
  LIMPIAR: 'limpiar',
  HABLAR: 'hablar',
};

const LETRAS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
const FILAS_QWERTY = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];

/** Disposiciones disponibles del tablero. */
export const LAYOUTS = ['abc', 'qwerty'];
export const NOMBRES_LAYOUT = { abc: 'ABC (alfabético)', qwerty: 'QWERTY' };

const letra = (l) => ({
  id: `l-${l}`,
  tipo: 'letra',
  valor: l.toLowerCase(),
  etiqueta: l,
});
const CELDAS_ACCION = {
  espacio: { id: 'a-espacio', tipo: 'accion', valor: ACCIONES.ESPACIO, etiqueta: 'espacio' },
  borrar: { id: 'a-borrar', tipo: 'accion', valor: ACCIONES.BORRAR, etiqueta: 'borrar' },
  limpiar: { id: 'a-limpiar', tipo: 'accion', valor: ACCIONES.LIMPIAR, etiqueta: 'limpiar' },
  hablar: { id: 'a-hablar', tipo: 'accion', valor: ACCIONES.HABLAR, etiqueta: 'HABLAR' },
};

/**
 * Celdas del tablero, en orden de lectura. Sin acentos a propósito: con
 * cabeza cada selección cuesta, y el acento lo puede sumar una predicción de
 * palabras más adelante (fase 2). HABLAR es una celda más, porque el usuario
 * tiene que poder disparar la voz con el mismo método que escribe.
 *
 * Las dos disposiciones tienen exactamente las mismas 31 celdas (mismos ids):
 * solo cambia el orden y la forma.
 */
export function celdasTablero(layout = 'abc') {
  const a = CELDAS_ACCION;
  if (layout === 'qwerty') {
    return [
      ...FILAS_QWERTY.join('').split('').map(letra),
      a.borrar,
      a.limpiar,
      a.espacio,
      a.hablar,
    ];
  }
  return [...LETRAS.map(letra), a.espacio, a.borrar, a.limpiar, a.hablar];
}

/** Tamaños de la zona de descanso, en celdas (columnas x filas de hueco). */
export const TAMANOS_DESCANSO = ['chica', 'mediana'];
const HUECO = { chica: { cols: 1, filas: 1 }, mediana: { cols: 2, filas: 2 } };
const HUECO_QWERTY_COLS = { chica: 2, mediana: 4 };

/**
 * Forma fija del tablero para las disposiciones que la tienen. QWERTY imita
 * las filas de un teclado (10/10/7 letras) y cierra con una fila de ESPACIO y
 * HABLAR anchos; `spans` dice cuántas columnas ocupa cada celda que no ocupa
 * una sola. La disposición ABC no tiene forma fija: se calcula según el
 * espacio (ver calcularGrilla).
 * @returns {{cols:number, filas:number, spans:Record<string, number>}|null}
 */
export function plantillaTablero(layout) {
  if (layout !== 'qwerty') return null;
  return {
    cols: 10,
    filas: 4,
    spans: { 'a-borrar': 1, 'a-limpiar': 2, 'a-espacio': 6, 'a-hablar': 4 },
  };
}

/** @typedef {{col:number, fila:number, cols:number, filas:number}} Hueco */
/** @typedef {Record<string, {col:number, fila:number, cols:number}>} Posiciones */

/**
 * Coloca las celdas en orden de lectura, saltando el hueco (zona de descanso)
 * y las filas que se dejan vacías. Posiciones 1-based, como grid-line de CSS.
 * @returns {Posiciones}
 */
function colocar(celdas, cols, spans, hueco, filaVacia = 0) {
  /** @type {Posiciones} */
  const pos = {};
  let col = 1;
  let fila = 1;
  const tapa = (c, f, n) =>
    hueco &&
    f >= hueco.fila &&
    f < hueco.fila + hueco.filas &&
    c + n - 1 >= hueco.col &&
    c < hueco.col + hueco.cols;
  for (const c of celdas) {
    const n = spans[c.id] ?? 1;
    for (;;) {
      if (col + n - 1 > cols) {
        col = 1;
        fila += 1;
      }
      if (fila === filaVacia) {
        fila += 1;
        col = 1;
        continue;
      }
      if (tapa(col, fila, n)) {
        col = hueco.col + hueco.cols;
        continue;
      }
      break;
    }
    pos[c.id] = { col, fila, cols: n };
    col += n;
  }
  return pos;
}

/**
 * ABC con un hueco centrado de hc x hr celdas (zona de descanso del modo
 * dwell): busca la grilla que deja la celda más grande, con al menos una celda
 * alrededor del hueco por cada lado.
 */
function calcularGrillaConHueco({ ancho, alto, cantidad, celdaMin, gap, hc, hr }) {
  let mejor = null;
  for (let cols = hc + 2; cols <= cantidad + hc; cols += 1) {
    const filas = Math.max(hr + 2, Math.ceil((cantidad + hc * hr) / cols));
    if (cols * filas - hc * hr < cantidad) continue;
    const celdaAncho = Math.floor((ancho - gap * (cols - 1)) / cols);
    const celdaAlto = Math.floor((alto - gap * (filas - 1)) / filas);
    if (celdaAncho <= 0 || celdaAlto <= 0) continue;
    const lado = Math.min(celdaAncho, celdaAlto);
    const puntaje = lado - Math.abs(celdaAncho - celdaAlto) * 0.0001;
    if (!mejor || puntaje > mejor.puntaje) {
      mejor = { cols, filas, celdaAncho, celdaAlto, lado, puntaje };
    }
  }
  if (!mejor) return null;
  const { cols, filas } = mejor;
  return {
    cols,
    filas,
    celdaAncho: mejor.celdaAncho,
    celdaAlto: mejor.celdaAlto,
    cumpleMinimo: mejor.lado >= celdaMin,
    hueco: {
      col: Math.floor((cols - hc) / 2) + 1,
      fila: Math.floor((filas - hr) / 2) + 1,
      cols: hc,
      filas: hr,
    },
  };
}

/**
 * Tamaño de celda de la disposición elegida en `ancho` x `alto` px.
 * Con `descanso` ('chica' | 'mediana') deja un hueco central donde el puntero
 * puede quedarse sin elegir nada (modo dwell); `hueco` y `posiciones` dicen
 * dónde va cada cosa. Sin `descanso`, `hueco` es null y `posiciones` es null
 * (las celdas fluyen solas).
 * @returns {{cols:number, filas:number, celdaAncho:number, celdaAlto:number,
 *   cumpleMinimo:boolean, spans:Record<string, number>, hueco:Hueco|null,
 *   posiciones:Posiciones|null}}
 */
export function medirTablero({
  layout = 'abc',
  ancho,
  alto,
  celdaMin = 120,
  gap = 8,
  descanso = null,
}) {
  const celdas = celdasTablero(layout);
  const plantilla = plantillaTablero(layout);
  const tam = descanso && HUECO[descanso] ? descanso : null;
  if (!plantilla) {
    if (tam) {
      const { cols: hc, filas: hr } = HUECO[tam];
      const g = calcularGrillaConHueco({
        ancho,
        alto,
        cantidad: celdas.length,
        celdaMin,
        gap,
        hc,
        hr,
      });
      if (g) {
        const { hueco, ...resto } = g;
        return {
          ...resto,
          spans: {},
          hueco,
          posiciones: colocar(celdas, g.cols, {}, hueco),
        };
      }
    }
    const g = calcularGrilla({ ancho, alto, cantidad: celdas.length, celdaMin, gap });
    return { ...g, spans: {}, hueco: null, posiciones: null };
  }
  const { cols, spans } = plantilla;
  const filas = tam ? plantilla.filas + 1 : plantilla.filas;
  const celdaAncho = Math.floor((ancho - gap * (cols - 1)) / cols);
  const celdaAlto = Math.floor((alto - gap * (filas - 1)) / filas);
  const valido = celdaAncho > 0 && celdaAlto > 0;
  // Franja de descanso entre la 2.ª y la 3.ª fila de letras, centrada.
  const anchoHueco = tam ? HUECO_QWERTY_COLS[tam] : 0;
  const hueco = tam
    ? { col: Math.floor((cols - anchoHueco) / 2) + 1, fila: 3, cols: anchoHueco, filas: 1 }
    : null;
  return {
    cols,
    filas,
    celdaAncho: valido ? celdaAncho : 0,
    celdaAlto: valido ? celdaAlto : 0,
    cumpleMinimo: valido && Math.min(celdaAncho, celdaAlto) >= celdaMin,
    spans,
    hueco,
    posiciones: tam ? colocar(celdas, cols, spans, null, 3) : null,
  };
}

/**
 * Elige columnas/filas para `cantidad` celdas dentro de `ancho` x `alto`
 * (px), con separación `gap`. Maximiza el lado de la celda (cuadrada o
 * casi: se permite que sea más ancha que alta, nunca al revés de forma
 * extrema).
 *
 * @returns {{cols:number, filas:number, celdaAncho:number, celdaAlto:number,
 *   cumpleMinimo:boolean}}
 */
export function calcularGrilla({ ancho, alto, cantidad, celdaMin = 120, gap = 8 }) {
  if (!(ancho > 0) || !(alto > 0) || !(cantidad > 0)) {
    return {
      cols: 1,
      filas: Math.max(1, cantidad || 1),
      celdaAncho: 0,
      celdaAlto: 0,
      cumpleMinimo: false,
    };
  }
  let mejor = null;
  for (let cols = 1; cols <= cantidad; cols += 1) {
    const filas = Math.ceil(cantidad / cols);
    const celdaAncho = Math.floor((ancho - gap * (cols - 1)) / cols);
    const celdaAlto = Math.floor((alto - gap * (filas - 1)) / filas);
    if (celdaAncho <= 0 || celdaAlto <= 0) continue;
    const lado = Math.min(celdaAncho, celdaAlto);
    // Desempate: menos filas vacías y forma más cercana a la cuadrada.
    const vacias = cols * filas - cantidad;
    const puntaje = lado - vacias * 0.001 - Math.abs(celdaAncho - celdaAlto) * 0.0001;
    if (!mejor || puntaje > mejor.puntaje) {
      mejor = { cols, filas, celdaAncho, celdaAlto, lado, puntaje };
    }
  }
  if (!mejor) {
    return { cols: 1, filas: cantidad, celdaAncho: 0, celdaAlto: 0, cumpleMinimo: false };
  }
  return {
    cols: mejor.cols,
    filas: mejor.filas,
    celdaAncho: mejor.celdaAncho,
    celdaAlto: mejor.celdaAlto,
    cumpleMinimo: mejor.lado >= celdaMin,
  };
}
