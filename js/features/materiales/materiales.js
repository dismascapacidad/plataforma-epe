/**
 * materiales.js
 * Página "Material de consulta": una card por material de
 * EpeCatalogoMateriales (js/data/catalogo-materiales.js).
 *
 * - Material "publico": se abre siempre.
 * - Material "logueado": la card se ve siempre (con candado) para que se sepa
 *   que existe, pero abrirla sin sesión muestra el aviso de ingresar. Es un
 *   incentivo, no seguridad (ver el catálogo).
 * - PDF con acceso: la card es un link directo al archivo de Drive, en
 *   pestaña nueva (un solo toque; con switch de acceso importa).
 * - Video con acceso: la card abre un modal con el reproductor de YouTube
 *   (youtube-nocookie.com). El reproductor se carga recién al abrir el modal
 *   y se quita al cerrarlo, así el audio no sigue sonando.
 * - Sin archivo asignado (material de ejemplo): el modal lo avisa.
 *
 * Todo texto del catálogo se inserta con textContent. Los únicos innerHTML son
 * los íconos SVG de abajo, que son constantes de este archivo.
 *
 * Depende de: EpeCatalogoMateriales, EpeSesionUi, EpeModal. Script clásico
 * (ver theme.js). Namespace: EpeMaterialesPagina.
 */

var EpeMaterialesPagina = (function () {
  var ICONOS = {
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>',
    video:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5v5l4.5-2.5z" /></svg>',
    candado:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>',
  };

  var RUTA_LOGIN = "../espacio-personal/login.html";

  var grid = null;
  var vacio = null;
  var materiales = [];
  var sesionActiva = null; // null hasta saber el estado; después true/false.

  function init() {
    grid = document.querySelector("[data-materiales-grid]");
    vacio = document.querySelector("[data-materiales-vacio]");
    if (!grid || !vacio) return;

    EpeCatalogoMateriales.getAll()
      .then(function (lista) {
        materiales = lista;
        return EpeSesionUi.init({ onCambio: alCambiarSesion });
      })
      .then(alCambiarSesion)
      .catch(function () {
        grid.innerHTML = "";
        vacio.hidden = false;
        vacio.textContent = "No se pudo cargar el material. Recargá la página.";
      });
  }

  // Redibuja solo si el estado de sesión cambió de verdad (Supabase avisa
  // también al renovar el token, y eso no tiene que reconstruir las cards).
  function alCambiarSesion(session) {
    var nueva = !!session;
    if (nueva === sesionActiva) return;
    sesionActiva = nueva;
    dibujar();
  }

  function dibujar() {
    grid.innerHTML = "";
    vacio.hidden = materiales.length > 0;
    vacio.textContent = "Todavía no hay material cargado en esta sección.";
    materiales.forEach(function (m) {
      grid.appendChild(construirCard(m));
    });
  }

  function el(tag, clase) {
    var nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    return nodo;
  }

  function construirCard(m) {
    var bloqueado = m.acceso === "logueado" && !sesionActiva;
    var urls = EpeCatalogoMateriales.urlsDe(m);
    var directo = m.tipo === "pdf" && !bloqueado && !!urls;

    var item = el(directo ? "a" : "button", "epe-app-card");
    if (directo) {
      item.href = urls.ver;
      item.target = "_blank";
      item.rel = "noopener noreferrer";
    } else {
      item.type = "button";
    }

    // ── Imagen: ícono del tipo sobre un tinte, con candado si está bloqueado ──
    var media = el("span", "epe-app-card-media epe-app-card-media-vacia" + (bloqueado ? " epe-material-bloqueado" : ""));
    var ph = el("span", "epe-app-card-placeholder");
    ph.setAttribute("aria-hidden", "true");
    ph.innerHTML = ICONOS[m.tipo === "video" ? "video" : "pdf"];
    media.appendChild(ph);

    if (bloqueado) {
      var pill = el("span", "epe-app-card-pill epe-material-pill-candado");
      var icono = el("span", "epe-material-pill-icono");
      icono.setAttribute("aria-hidden", "true");
      icono.innerHTML = ICONOS.candado;
      pill.appendChild(icono);
      pill.appendChild(document.createTextNode("Requiere cuenta"));
      media.appendChild(pill);
    }

    // ── Texto ──
    var body = el("span", "epe-app-card-body");

    var categoria = el("span", "epe-app-card-categoria");
    categoria.textContent = (m.tipo === "video" ? "Video" : "PDF") + (m.categoria ? " · " + m.categoria : "");
    body.appendChild(categoria);

    var titulo = el("span", "epe-app-card-title");
    titulo.textContent = m.titulo;
    body.appendChild(titulo);

    var desc = el("span", "epe-app-card-desc");
    desc.textContent = m.descripcion;
    body.appendChild(desc);

    var accion = el("span", "epe-material-accion");
    accion.textContent = bloqueado ? "Ingresá para ver" : m.tipo === "video" ? "Ver video" : "Abrir PDF";
    if (directo) {
      var aviso = el("span", "epe-sr-only");
      aviso.textContent = " (se abre en una pestaña nueva)";
      accion.appendChild(aviso);
    }
    body.appendChild(accion);

    item.appendChild(media);
    item.appendChild(body);

    if (!directo) {
      item.addEventListener("click", function () {
        if (bloqueado) abrirAvisoAcceso(m);
        else if (!urls) abrirSinArchivo(m);
        else abrirVideo(m, urls);
      });
    }

    return item;
  }

  // ── Modales ──

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

  function abrirAvisoAcceso(m) {
    var contenido = el("div", "epe-material-modal");
    contenido.appendChild(
      parrafo(
        "epe-material-modal-texto",
        "Para ver «" + m.titulo + "» ingresá con tu cuenta. Con la misma cuenta accedés a tu espacio personal."
      )
    );
    var acciones = el("div", "epe-material-modal-acciones");
    acciones.appendChild(enlace("epe-btn-acc epe-btn-sm", "Ingresar", RUTA_LOGIN + "?volver=materiales"));
    acciones.appendChild(enlace("epe-btn-ghost epe-btn-sm", "Crear cuenta", RUTA_LOGIN + "?modo=signup&volver=materiales"));
    contenido.appendChild(acciones);
    EpeModal.open({ titulo: "Este material es para usuarios con cuenta", contenido: contenido });
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

  return { init: init };
})();
