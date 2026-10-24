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
