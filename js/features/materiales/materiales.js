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
 * - Video con acceso, o material sin archivo (ejemplo): la card abre el modal
 *   correspondiente (ver js/core/material-visor.js, que comparte con las
 *   colecciones del espacio personal).
 *
 * Todo texto del catálogo se inserta con textContent. El único innerHTML son
 * los íconos SVG de EpeMaterialVisor.ICONOS, que son constantes.
 *
 * Depende de: EpeCatalogoMateriales, EpeSesionUi, EpeModal, EpeMaterialVisor.
 * Script clásico (ver theme.js). Namespace: EpeMaterialesPagina.
 */

var EpeMaterialesPagina = (function () {
  var ICONOS = EpeMaterialVisor.ICONOS;

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
        else EpeMaterialVisor.abrir(m);
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

  return { init: init };
})();
