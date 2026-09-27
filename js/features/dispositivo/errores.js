// @ts-check
/**
 * Error de los transportes (USB/BLE) con un `codigo` estable para que la
 * interfaz pueda mostrar el mensaje o la ayuda que corresponde sin depender
 * de textos de error del navegador.
 *
 * Códigos:
 *  - `no-disponible`     el navegador no ofrece esa tecnología (iOS, Firefox, Safari…).
 *  - `cancelado`         el usuario cerró el selector sin elegir (no es un fallo).
 *  - `permiso-bloqueado` una política del navegador o de la página lo impide.
 *  - `puerto-ocupado`    el puerto no se pudo abrir (otra app o pestaña lo tiene).
 *  - `hid-windows`       BLE: el dispositivo está emparejado como mouse en el sistema
 *                        y el navegador no puede acceder a su GATT.
 *  - `sin-uart`          BLE: el dispositivo elegido no tiene el servicio de comandos.
 *  - `sin-conexion`      BLE: no se pudo establecer o se perdió el enlace.
 *  - `error`             cualquier otro.
 */
export class ErrorDeTransporte extends Error {
  /**
   * @param {string} codigo
   * @param {string} mensaje
   * @param {unknown} [causa]
   */
  constructor(codigo, mensaje, causa) {
    super(mensaje);
    this.name = 'ErrorDeTransporte';
    this.codigo = codigo;
    this.causa = causa;
  }
}
