// @ts-check
/**
 * Punto de entrada del núcleo del dispositivo. Todo lo que el resto de la
 * plataforma necesita de acá se importa desde este archivo:
 *
 *   import { crearConexionUsb, resumirConfiguracion } from '.../dispositivo/index.js';
 *
 * Sin DOM: la interfaz (el widget "Configurar dispositivo") se arma aparte.
 */

import { Conexion } from './conexion.js';
import { TransporteUsb } from './transporte-usb.js';
import { TransporteBle } from './transporte-ble.js';

export { Conexion, ErrorDeConexion, ESTADOS } from './conexion.js';
export { TransporteUsb, FILTROS_USB_CONOCIDOS, elegirApiSerial } from './transporte-usb.js';
export { TransporteBle } from './transporte-ble.js';
export { ErrorDeTransporte } from './errores.js';
export { PRODUCTOS, productoPorModelo, todasLasEntradas, entradasAsignables } from './productos.js';
export {
  leerVersion,
  compararVersiones,
  estaDesactualizado,
  ULTIMAS_VERSIONES,
} from './firmware.js';
export {
  clonarCfg,
  compararConfiguraciones,
  comandosDeRestauracion,
  snapshotATexto,
  snapshotDeTexto,
  nombreDeTecla,
  describirBoton,
  resumirConfiguracion,
  snapshotACsvDelConfigurador,
  entradasFaltantes,
} from './configuracion.js';
export {
  BTN_CODES,
  buildButtonCfg,
  buildArrowCommands,
  cfgToCommands,
  resolvePreset,
  esComandoDeConfiguracion,
  supportsTapHold,
  isExtendedBtnLine,
  describeDeviceError,
  normalizeThreshold,
  TH_DEFAULT_MS,
  TH_MIN_MS,
  TH_MAX_MS,
} from './protocolo.js';

/**
 * Conexión USB lista para usar. Los transportes se crean recién acá para que
 * importar el núcleo no toque ninguna API del navegador.
 * @param {ConstructorParameters<typeof Conexion>[1]} [opciones]
 * @param {ConstructorParameters<typeof TransporteUsb>[0]} [opcionesUsb]
 */
export function crearConexionUsb(opciones, opcionesUsb) {
  const transporte = new TransporteUsb(opcionesUsb);
  return { conexion: new Conexion(transporte, opciones), transporte };
}

/**
 * Conexión Bluetooth LE lista para usar.
 * @param {ConstructorParameters<typeof Conexion>[1]} [opciones]
 * @param {ConstructorParameters<typeof TransporteBle>[0]} [opcionesBle]
 */
export function crearConexionBle(opciones, opcionesBle) {
  const transporte = new TransporteBle(opcionesBle);
  return { conexion: new Conexion(transporte, opciones), transporte };
}
