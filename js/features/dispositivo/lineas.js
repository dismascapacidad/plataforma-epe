// @ts-check
/**
 * Utilidades de bajo nivel para hablar por un canal de bytes (USB o BLE):
 * armar líneas de texto a partir de los trozos que llegan, y partir un
 * mensaje en paquetes del tamaño que admite el canal. Puras, con tests.
 */

/**
 * Junta trozos de texto que llegan cortados en cualquier lugar y avisa por
 * cada línea completa (terminada en `\n`). Ignora `\r` y líneas vacías.
 */
export class EnsambladorDeLineas {
  /** @param {(linea: string) => void} alLinea */
  constructor(alLinea) {
    this.alLinea = alLinea;
    this.pendiente = '';
    this.decodificador = new TextDecoder();
  }

  /**
   * @param {string | Uint8Array | ArrayBuffer | DataView} datos
   */
  empujar(datos) {
    let texto;
    if (typeof datos === 'string') {
      texto = datos;
    } else {
      const bytes =
        datos instanceof DataView
          ? new Uint8Array(datos.buffer, datos.byteOffset, datos.byteLength)
          : new Uint8Array(datos);
      texto = this.decodificador.decode(bytes, { stream: true });
    }
    this.pendiente += texto;
    const partes = this.pendiente.split('\n');
    this.pendiente = /** @type {string} */ (partes.pop());
    for (const parte of partes) {
      const linea = parte.replace(/\r$/, '').trim();
      if (linea) this.alLinea(linea);
    }
  }

  /** Descarta lo que haya quedado a medias (al reconectar). */
  reiniciar() {
    this.pendiente = '';
    this.decodificador = new TextDecoder();
  }
}

/**
 * Parte un mensaje en paquetes de a lo sumo `tamano` bytes (BLE: 20, el MTU
 * mínimo, igual que el configurador actual).
 * @param {Uint8Array} bytes
 * @param {number} [tamano=20]
 * @returns {Uint8Array[]}
 */
export function partirEnPaquetes(bytes, tamano = 20) {
  if (!(tamano > 0)) throw new Error('El tamaño de paquete debe ser mayor que 0.');
  /** @type {Uint8Array[]} */
  const paquetes = [];
  for (let i = 0; i < bytes.length; i += tamano) paquetes.push(bytes.slice(i, i + tamano));
  return paquetes;
}
