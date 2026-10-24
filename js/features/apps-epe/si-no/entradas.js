/**
 * entradas.js
 * Lógica pura que une las casillas con el motor de acceso (EpeAcceso /
 * EpeEntrada) y con el widget "Configurar dispositivo". Sin DOM.
 */

/** Tecla de fábrica de cada casilla (la misma convención que Vincular imagen-botón). */
export const TECLAS_POR_DEFECTO = ['a', 'b', 'c'];

/** Teclas del pulsador en el modo cabeza + pulsador (igual que la app de seguimiento de cabeza). */
export const TECLAS_PULSADOR_CABEZA = ['k', ' '];

/**
 * Acciones que se le pasan al panel de acceso: una por casilla activa.
 * @param {{id:string, indice:number, texto:string}[]} celdas
 */
export function accionesPanel(celdas) {
  return celdas.map((c) => ({
    id: c.id,
    etiqueta: c.texto || `Casilla ${c.indice + 1}`,
    tecla: TECLAS_POR_DEFECTO[c.indice],
  }));
}

/**
 * El panel de acceso descarta lo que tenía guardado si le falta la tecla de
 * alguna acción actual (por ejemplo, al activar la tercera casilla). Para no
 * perder las teclas ya elegidas, antes de crear el panel se completa lo
 * guardado con una tecla libre para cada acción nueva.
 * Devuelve el objeto a guardar, o null si no había nada utilizable (el panel
 * arranca con sus valores de fábrica).
 */
export function completarTeclasGuardadas(guardado, acciones) {
  if (!guardado || typeof guardado !== 'object') return null;
  if (!guardado.teclas || typeof guardado.teclas !== 'object') return null;
  const teclas = { ...guardado.teclas };
  const usadas = new Set(
    [...Object.values(teclas), guardado.avanzar, guardado.seleccionar].filter(
      (t) => typeof t === 'string',
    ),
  );
  for (const a of acciones) {
    if (typeof teclas[a.id] === 'string') continue;
    let tecla = a.tecla;
    if (usadas.has(tecla)) {
      tecla = TECLAS_POR_DEFECTO.find((t) => !usadas.has(t)) ?? tecla;
    }
    teclas[a.id] = tecla;
    usadas.add(tecla);
  }
  return { ...guardado, teclas };
}

/**
 * Entradas que el widget de dispositivo tiene que programar en el modo cabeza.
 * @param {{seleccion:string, teclaRecentrar:string|null}} cabeza
 */
export function entradasCabeza(cabeza) {
  const lista = [];
  if (cabeza.seleccion === 'pulsador') {
    lista.push({ id: 'k', etiqueta: 'Elegir la casilla bajo el puntero', tecla: 'k' });
  }
  if (cabeza.teclaRecentrar) {
    lista.push({
      id: 'recentrar',
      etiqueta: 'Recentrar el puntero al centro',
      tecla: cabeza.teclaRecentrar,
    });
  }
  return lista;
}

/**
 * Casillas en pantalla: en dwell con zona de descanso se reserva una franja
 * que no es una casilla (el puntero puede reposar sin elegir nada).
 */
export function conFranjaDescanso(config) {
  return (
    config.acceso === 'cabeza' && config.cabeza.seleccion === 'dwell' && config.cabeza.descanso
  );
}

/**
 * Reparto de las casillas en el tablero: lado a lado (2 o 3 columnas) en
 * pantallas apaisadas; apiladas en las verticales y angostas, así cada una
 * conserva un tamaño grande.
 * @returns {{columnas:number, filas:number}}
 */
export function distribucion(cantidad, ancho, alto) {
  const apaisada = ancho >= alto * 0.9;
  if (apaisada) return { columnas: cantidad, filas: 1 };
  return { columnas: 1, filas: cantidad };
}

/**
 * Reparto de las casillas (y del descanso) en la grilla del tablero. Las
 * posiciones son líneas de CSS grid, desde 1.
 *
 * Sin descanso: casillas en fila (pantalla apaisada) o en columna (vertical).
 *
 * Con descanso (cabeza + permanencia):
 * - 2 casillas apaisadas: el descanso es una franja VERTICAL entre las dos,
 *   de alto completo, que mide el 30 % del ancho de una casilla.
 * - 3 casillas apaisadas: las laterales ocupan todo el alto; la del medio mide
 *   el 70 % de ese alto y el descanso el 30 % restante, debajo de ella.
 * - En pantallas verticales las casillas se apilan y el descanso queda en una
 *   franja horizontal entre ellas (con 3: debajo de la del medio).
 *
 * @param {number} cantidad 2 o 3
 * @param {number} ancho
 * @param {number} alto
 * @param {boolean} conDescanso
 * @returns {{columnas:string, filas:string,
 *   celdas:{col:number, fila:number, filas:number}[],
 *   descanso:{col:number, fila:number, vertical:boolean}|null}}
 */
export function reparto(cantidad, ancho, alto, conDescanso) {
  const apaisada = distribucion(cantidad, ancho, alto).columnas > 1;
  const f = (n) => `minmax(0, ${n}fr)`;
  const celda = (col, fila, filas = 1) => ({ col, fila, filas });

  if (!conDescanso) {
    return apaisada
      ? {
          columnas: Array(cantidad).fill(f(1)).join(' '),
          filas: f(1),
          celdas: Array.from({ length: cantidad }, (_, i) => celda(i + 1, 1)),
          descanso: null,
        }
      : {
          columnas: f(1),
          filas: Array(cantidad).fill(f(1)).join(' '),
          celdas: Array.from({ length: cantidad }, (_, i) => celda(1, i + 1)),
          descanso: null,
        };
  }

  if (apaisada) {
    if (cantidad === 2) {
      return {
        columnas: `${f(1)} ${f(0.3)} ${f(1)}`,
        filas: f(1),
        celdas: [celda(1, 1), celda(3, 1)],
        descanso: { col: 2, fila: 1, vertical: true },
      };
    }
    return {
      columnas: `${f(1)} ${f(1)} ${f(1)}`,
      filas: `${f(7)} ${f(3)}`,
      celdas: [celda(1, 1, 2), celda(2, 1), celda(3, 1, 2)],
      descanso: { col: 2, fila: 2, vertical: false },
    };
  }

  if (cantidad === 2) {
    return {
      columnas: f(1),
      filas: `${f(1)} ${f(0.3)} ${f(1)}`,
      celdas: [celda(1, 1), celda(1, 3)],
      descanso: { col: 1, fila: 2, vertical: false },
    };
  }
  return {
    columnas: f(1),
    filas: `${f(1)} ${f(1)} ${f(0.3)} ${f(1)}`,
    celdas: [celda(1, 1), celda(1, 2), celda(1, 4)],
    descanso: { col: 1, fila: 3, vertical: false },
  };
}
