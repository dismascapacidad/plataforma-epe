// @ts-check
/**
 * Textos de la conexión por Bluetooth que dependen del sistema.
 *
 * El dispositivo se usa de dos maneras que NO pueden convivir: para configurarlo,
 * la página lo abre como puerto serie (UART por Bluetooth LE); para jugar, el
 * sistema lo conecta como teclado o mouse (HID). Mientras la página lo tiene
 * abierto, el sistema no puede usarlo. Por eso, al terminar de configurar por
 * Bluetooth la página lo suelta y le explica a la persona cómo conectarlo desde
 * el sistema; y para restaurar, la página tiene que volver a abrirlo.
 *
 * Qué hay que hacer en cada sistema (lo que se comprobó con el hardware):
 *  - Windows (y el resto de las computadoras): alcanza con que la página lo suelte;
 *    después se conecta desde la configuración de Bluetooth.
 *  - Android: hay que ir a Ajustes › Bluetooth, olvidar el dispositivo y volver a conectarlo.
 *
 * Módulo puro: no toca el DOM.
 */

/** Código del error con el que `restaurar()` avisa que la conexión se soltó a propósito para jugar. */
export const CODIGO_SOLTADO_PARA_JUGAR = 'soltado-para-jugar';

/**
 * @param {string} [userAgent]
 * @returns {'android' | 'otro'}
 */
export function sistemaDe(userAgent) {
  return /android/i.test(userAgent || '') ? 'android' : 'otro';
}

/** @param {string} [nombre] */
function quien(nombre) {
  const n = (nombre || '').trim();
  return n ? `«${n}»` : 'el dispositivo';
}

/**
 * Pasos para conectar el dispositivo desde el sistema y poder jugar.
 * @param {'android' | 'otro'} sistema
 * @param {string} [nombre] Nombre con el que el dispositivo aparece en Bluetooth.
 * @returns {string[]}
 */
export function pasosParaJugar(sistema, nombre) {
  if (sistema === 'android') {
    return [
      `Abrí Ajustes › Bluetooth, tocá ${quien(nombre)} y elegí «Olvidar».`,
      'Después volvé a emparejarlo y conectarlo desde esa misma pantalla.',
    ];
  }
  return [`Abrí la configuración de Bluetooth de tu sistema y conectá ${quien(nombre)}.`];
}

/**
 * Pasos para soltar el dispositivo del sistema antes de que la página lo vuelva
 * a abrir (para restaurarlo).
 * @param {'android' | 'otro'} sistema
 * @param {string} [nombre]
 * @returns {string[]}
 */
export function pasosParaRestaurar(sistema, nombre) {
  if (sistema === 'android') {
    return [
      `Abrí Ajustes › Bluetooth, tocá ${quien(nombre)} y elegí «Olvidar».`,
      'Después volvé acá y tocá «Elegir dispositivo».',
    ];
  }
  return [
    `Si ${quien(nombre)} está conectado como teclado o mouse en el Bluetooth del sistema, desconectalo (o quitalo).`,
    'Después tocá «Elegir dispositivo» y seleccionalo en la lista.',
  ];
}
