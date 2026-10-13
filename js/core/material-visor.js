/**
 * material-visor.js
 * Cómo se abre un material de consulta, en un solo lugar para que lo usen la
 * página pública (materiales/) y las colecciones del espacio personal:
 *
 * - PDF con archivo: se abre en Drive, en pestaña nueva.
 * - Video con archivo: modal con el reproductor de YouTube
 *   (youtube-nocookie.com). El reproductor se carga al abrir el modal y se
 *   quita al cerrarlo, así el audio no sigue sonando.
 * - Material sin archivo todavía (ejemplo): el modal lo avisa.
 * - Material propio de una colección: un link a SU Drive o Google Docs.
 *   urlDriveValida() decide si un link es aceptable; es la misma regla que
 *   aplica la base de datos (supabase/024_material_de_consulta.sql) y que
 *   hay que mantener igual en los dos lugares.
 *
 * Todo texto se inserta con textContent. Los únicos innerHTML son los SVG de
 * ICONOS, que son constantes de este archivo.
 *
 * Depende de EpeModal y EpeCatalogoMateriales. Script clásico (ver theme.js).
 * Namespace: EpeMaterialVisor.
 */

var EpeMaterialVisor = (function () {
  var ICONOS = {
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>',
    video:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5v5l4.5-2.5z" /></svg>',
    candado:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>',
    enlace:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></svg>',
  };

  var HOSTS_DRIVE = ["drive.google.com", "docs.google.com"];
  var MAX_URL = 500;

  /**
   * Devuelve el link normalizado si es https hacia Google Drive o Google
   * Docs (sin usuario, contraseña ni puerto) y no pasa de 500 caracteres;
   * si no, null. La regla de la base es:
   *   ^https://(drive|docs)\.google\.com/[^[:space:]]*$  y largo <= 500
   */
  function urlDriveValida(texto) {
    if (typeof texto !== "string") return null;
    var t = texto.trim();
    if (!t || t.length > MAX_URL) return null;
    var u;
    try {
      u = new URL(t);
    } catch (e) {
      return null;
    }
    if (u.protocol !== "https:" || HOSTS_DRIVE.indexOf(u.hostname) === -1) return null;
    if (u.username || u.password || u.port) return null;
    return u.href.length <= MAX_URL ? u.href : null;
  }

  function el(tag, clase) {
    var nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    return nodo;
  }

  function parrafo(clase, texto) {
    var p = el("p", clase);
    p.textContent = texto;
    return p;
  }

  function enlace(clase, texto, href) {
    var a = el("a", clase);
    a.textContent = texto;
    a.href = href;
    return a;
  }

  function abrirSinArchivo(m) {
    var contenido = el("div", "epe-material-modal");
    contenido.appendChild(
      parrafo(
        "epe-material-modal-texto",
        m.ejemplo
          ? "Este es un material de ejemplo: todavía no tiene " + (m.tipo === "video" ? "un video" : "un archivo") + " asignado."
          : "Este material todavía no está disponible."
      )
    );
    EpeModal.open({ titulo: m.titulo, contenido: contenido });
  }

  function abrirVideo(m, urls) {
    var contenido = el("div", "epe-material-modal");

    var marco = el("div", "epe-material-video");
    var iframe = document.createElement("iframe");
    iframe.src = urls.embed;
    iframe.title = m.titulo;
    iframe.allow = "encrypted-media; picture-in-picture; fullscreen";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;
    marco.appendChild(iframe);
    contenido.appendChild(marco);

    contenido.appendChild(parrafo("epe-material-modal-texto", m.descripcion));
    contenido.appendChild(
      parrafo(
        "epe-material-modal-aviso",
        "El video se reproduce desde YouTube (Google), que puede registrar tu dirección IP."
      )
    );

    var acciones = el("div", "epe-material-modal-acciones");
    var ver = enlace("epe-btn-ghost epe-btn-sm", "Ver en YouTube", urls.ver);
    ver.target = "_blank";
    ver.rel = "noopener noreferrer";
    acciones.appendChild(ver);
    contenido.appendChild(acciones);

    EpeModal.open({
      titulo: m.titulo,
      contenido: contenido,
      // EpeModal solo oculta el modal al cerrarlo: sin esto el video seguiría sonando.
      onClose: function () {
        iframe.src = "about:blank";
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      },
    });
  }

  // Abre un material del catálogo según su tipo (para quien ya tiene acceso).
  function abrir(m) {
    var urls = EpeCatalogoMateriales.urlsDe(m);
    if (!urls) {
      abrirSinArchivo(m);
      return;
    }
    if (m.tipo === "video") abrirVideo(m, urls);
    else window.open(urls.ver, "_blank", "noopener,noreferrer");
  }

  // Abre el link propio de una colección. Devuelve false si el link no pasa
  // la validación (por ejemplo, si alguien lo cambió a mano en la base).
  function abrirPropio(url) {
    var seguro = urlDriveValida(url);
    if (!seguro) return false;
    window.open(seguro, "_blank", "noopener,noreferrer");
    return true;
  }

  return {
    ICONOS: ICONOS,
    urlDriveValida: urlDriveValida,
    abrir: abrir,
    abrirVideo: abrirVideo,
    abrirSinArchivo: abrirSinArchivo,
    abrirPropio: abrirPropio,
  };
})();
