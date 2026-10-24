/**
 * selector-imagen.js
 * Elegir la imagen de un botón/casilla: desde un archivo del dispositivo o
 * desde un pictograma de ARASAAC. Módulo ES compartido por las Apps EpE que
 * guardan imágenes en el navegador (hoy: Si-No con pulsadores).
 *
 * Decisiones de seguridad y de espacio:
 * - Solo se aceptan PNG, JPEG y WebP (nunca SVG: puede llevar scripts).
 * - Toda imagen se reduce a MAX_LADO px y se guarda como data URL: así la app
 *   funciona sin conexión, no depende de ARASAAC al usarla y entra en el
 *   límite de localStorage.
 * - Lo que se escribe en el buscador se envía a ARASAAC (servicio externo):
 *   el panel lo avisa y pide no escribir datos de pacientes.
 * - El texto de atribución de ARASAAC (ATRIBUCION_CORTA) se muestra siempre
 *   en el buscador: es condición de la autorización de uso.
 *
 * Vincular imagen-botón tiene su propia copia del buscador (script clásico);
 * unificar ambos queda para cuando esa app pase a módulos.
 */

export const MAX_LADO = 400;
export const MAX_BYTES_ARCHIVO = 10 * 1024 * 1024;
export const TIPOS_ARCHIVO_OK = ['image/png', 'image/jpeg', 'image/webp'];
/** Un data URL más largo que esto no se guarda (ver MAX_CHARS_IMAGEN en si-no/config.js). */
const MAX_CHARS = 600_000;

/** Tamaño de la imagen reducida, sin deformarla ni agrandarla. */
export function ladoReducido(ancho, alto, max = MAX_LADO) {
  const mayor = Math.max(ancho, alto);
  if (!(mayor > 0)) return { ancho: 1, alto: 1 };
  if (mayor <= max) return { ancho, alto };
  const k = max / mayor;
  return { ancho: Math.max(1, Math.round(ancho * k)), alto: Math.max(1, Math.round(alto * k)) };
}

/** ¿El navegador puede cargar este archivo como imagen guardable? */
export function archivoAceptable(file) {
  if (!file || typeof file !== 'object')
    return { ok: false, motivo: 'No se eligió ningún archivo.' };
  if (!TIPOS_ARCHIVO_OK.includes(file.type)) {
    return { ok: false, motivo: 'Solo se aceptan imágenes PNG, JPEG o WebP.' };
  }
  if (file.size > MAX_BYTES_ARCHIVO) {
    return { ok: false, motivo: 'La imagen pesa demasiado (máximo 10 MB).' };
  }
  return { ok: true };
}

function cargarImagen(src) {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => rechazar(new Error('imagen_ilegible'));
    img.src = src;
  });
}

/**
 * Reduce una imagen (data URL) a MAX_LADO px. Conserva la transparencia de los
 * PNG/WebP (los pictogramas la usan). Lanza Error si no se puede leer o si,
 * aun reducida, es demasiado pesada para guardarla.
 */
export async function reducirImagen(src, max = MAX_LADO) {
  const img = await cargarImagen(src);
  const { ancho, alto } = ladoReducido(img.naturalWidth, img.naturalHeight, max);
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_no_disponible');
  const esJpeg = src.startsWith('data:image/jpeg');
  if (esJpeg) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, ancho, alto);
  }
  ctx.drawImage(img, 0, 0, ancho, alto);
  let salida = esJpeg ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png');
  if (salida.length > MAX_CHARS) salida = canvas.toDataURL('image/webp', 0.85);
  if (salida.length > MAX_CHARS) salida = canvas.toDataURL('image/jpeg', 0.8);
  if (salida.length > MAX_CHARS) throw new Error('imagen_muy_pesada');
  return salida;
}

function leerComoDataUrl(file) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error('archivo_ilegible'));
    lector.readAsDataURL(file);
  });
}

/** Archivo del dispositivo → data URL reducido. Lanza Error con un mensaje para mostrar. */
export async function imagenDesdeArchivo(file) {
  const v = archivoAceptable(file);
  if (!v.ok) throw new Error(v.motivo);
  try {
    return await reducirImagen(await leerComoDataUrl(file));
  } catch (e) {
    if (e instanceof Error && e.message === 'imagen_muy_pesada') {
      throw new Error('La imagen sigue pesando demasiado aun reducida. Probá con otra.', {
        cause: e,
      });
    }
    throw new Error('No se pudo leer la imagen. Probá con otra.', { cause: e });
  }
}

/**
 * Panel de búsqueda de pictogramas de ARASAAC (usa el modal genérico EpeModal).
 * @param {any} A módulo arasaac.js ya cargado
 * @param {{alElegir:(dataUrl:string, palabra:string)=>void}} op
 */
export function abrirBuscadorArasaac(A, { alElegir }) {
  const modal = /** @type {any} */ (window).EpeModal;
  if (!A?.ARASAAC_HABILITADO || !modal) return;
  let todos = [];
  let pagina = 0;
  let pedido = 0; // descarta respuestas viejas si se busca de nuevo

  const el = (tag, clase, texto) => {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  };

  const cont = el('div', 'epe-sel-ara');

  const form = el('form', 'epe-sel-ara-form');
  const input = /** @type {HTMLInputElement} */ (el('input', 'epe-sel-input'));
  input.type = 'search';
  input.maxLength = A.LARGO_MAX_BUSQUEDA;
  input.placeholder = 'Ej.: sí, no, feliz, agua';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Buscar pictograma');
  const btnBuscar = /** @type {HTMLButtonElement} */ (
    el('button', 'epe-btn-acc epe-btn-sm', 'Buscar')
  );
  btnBuscar.type = 'submit';
  form.append(input, btnBuscar);

  const aviso = el(
    'p',
    'epe-sel-ara-aviso',
    'Lo que escribas se envía a ARASAAC (un servicio externo). Escribí solo la palabra del ' +
      'pictograma, sin nombres de personas ni datos de pacientes.',
  );
  const estado = el('p', 'epe-sel-ara-estado');
  estado.setAttribute('role', 'status');
  estado.setAttribute('aria-live', 'polite');
  const grilla = el('div', 'epe-sel-ara-grilla');

  const nav = el('div', 'epe-sel-ara-nav');
  nav.hidden = true;
  const btnAnt = /** @type {HTMLButtonElement} */ (
    el('button', 'epe-btn-ghost epe-btn-sm', '← Anteriores')
  );
  btnAnt.type = 'button';
  const btnSig = /** @type {HTMLButtonElement} */ (
    el('button', 'epe-btn-ghost epe-btn-sm', 'Más resultados →')
  );
  btnSig.type = 'button';
  nav.append(btnAnt, btnSig);

  const atrib = el('p', 'epe-sel-ara-atrib', A.ATRIBUCION_CORTA);
  cont.append(form, aviso, estado, grilla, nav, atrib);

  function mostrarPagina() {
    grilla.innerHTML = '';
    const desde = pagina * A.RESULTADOS_POR_PAGINA;
    todos.slice(desde, desde + A.RESULTADOS_POR_PAGINA).forEach((r) => {
      const b = /** @type {HTMLButtonElement} */ (el('button', 'epe-sel-ara-item'));
      b.type = 'button';
      b.setAttribute('aria-label', `Usar pictograma: ${r.palabra || 'sin nombre'}`);
      const img = /** @type {HTMLImageElement} */ (el('img'));
      img.src = r.url;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      b.append(img, el('span', null, r.palabra));
      b.addEventListener('click', () => elegir(r));
      grilla.appendChild(b);
    });
    const paginas = Math.ceil(todos.length / A.RESULTADOS_POR_PAGINA);
    nav.hidden = paginas <= 1;
    btnAnt.disabled = pagina === 0;
    btnSig.disabled = pagina >= paginas - 1;
    estado.textContent = `${todos.length} ${todos.length === 1 ? 'resultado' : 'resultados'}. Elegí uno.`;
  }

  btnAnt.addEventListener('click', () => {
    if (pagina > 0) {
      pagina--;
      mostrarPagina();
    }
  });
  btnSig.addEventListener('click', () => {
    pagina++;
    mostrarPagina();
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const termino = A.normalizarTermino(input.value);
    if (!termino) {
      estado.textContent = 'Escribí una palabra para buscar.';
      return;
    }
    const mio = ++pedido;
    estado.textContent = 'Buscando…';
    grilla.innerHTML = '';
    nav.hidden = true;
    A.buscar(termino)
      .then((lista) => {
        if (mio !== pedido) return;
        todos = lista;
        pagina = 0;
        if (!lista.length) {
          estado.textContent = `No encontramos pictogramas para “${termino}”. Probá con otra palabra.`;
          return;
        }
        mostrarPagina();
      })
      .catch(() => {
        if (mio !== pedido) return;
        estado.textContent =
          'No se pudo buscar (¿hay conexión?). Podés usar una imagen de tu dispositivo.';
      });
  });

  async function elegir(r) {
    pedido++; // cancela cualquier búsqueda pendiente
    grilla.querySelectorAll('button').forEach((b) => {
      /** @type {HTMLButtonElement} */ (b).disabled = true;
    });
    estado.textContent = 'Descargando pictograma…';
    try {
      const crudo = await A.descargarImagen(r.id, { resolucion: 500 });
      const imagen = await reducirImagen(crudo);
      modal.close();
      alElegir(imagen, r.palabra || '');
    } catch {
      estado.textContent =
        'No se pudo descargar ese pictograma. Probá con otro o con una imagen de tu dispositivo.';
      if (todos.length) mostrarPagina();
    }
  }

  modal.open({ titulo: 'Pictogramas de ARASAAC', contenido: cont });
  window.setTimeout(() => input.focus(), 0);
}
