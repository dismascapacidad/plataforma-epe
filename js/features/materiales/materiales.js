/**
 * materiales.js
 * Página "Material de consulta": una card por material de
 * EpeCatalogoMateriales (js/data/catalogo-materiales.js). Los materiales que
 * pertenecen a un curso no tienen card propia: el curso es UNA card y, al
 * abrirla, un panel lista sus PDF organizados por módulo (bloque). El material
 * suelto (sin curso) sigue siendo una card cada uno. Las cards muestran la
 * captura si tienen `imagen`; si no, un ícono.
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
  var cursos = [];
  var sesionActiva = null; // null hasta saber el estado; después true/false.

  function init() {
    grid = document.querySelector("[data-materiales-grid]");
    vacio = document.querySelector("[data-materiales-vacio]");
    if (!grid || !vacio) return;

    Promise.all([EpeCatalogoMateriales.getAll(), EpeCatalogoMateriales.getCursos()])
      .then(function (resultados) {
        materiales = resultados[0];
        cursos = resultados[1];
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

    // Una card por curso (con sus PDF adentro) y, después, el material suelto.
    cursos.forEach(function (curso) {
      var delCurso = EpeCatalogoMateriales.materialesDeCurso(curso.id, materiales);
      if (delCurso.length > 0) grid.appendChild(construirCardCurso(curso, delCurso));
    });
    EpeCatalogoMateriales.sinCurso(materiales).forEach(function (m) {
      grid.appendChild(construirCard(m));
    });
  }

  function el(tag, clase) {
    var nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    return nodo;
  }

  // Zona de imagen de una card: la captura (`ruta`, si hay) o el ícono sobre
  // un tinte — también si la captura no carga. `icono` es una clave de ICONOS.
  function construirMedia(ruta, alt, icono, bloqueado) {
    var media = el("span", "epe-app-card-media" + (bloqueado ? " epe-material-bloqueado" : ""));

    function ponerPlaceholder() {
      // Saca la imagen (y un placeholder previo) pero deja la pill, si ya está.
      Array.prototype.slice.call(media.children).forEach(function (hijo) {
        if (!hijo.classList.contains("epe-app-card-pill")) media.removeChild(hijo);
      });
      media.classList.add("epe-app-card-media-vacia");
      var ph = el("span", "epe-app-card-placeholder");
      ph.setAttribute("aria-hidden", "true");
      ph.innerHTML = ICONOS[icono]; // SVG constante de material-visor.js
      media.appendChild(ph);
    }

    if (ruta) {
      var img = el("img");
      img.src = "../" + ruta;
      img.alt = alt;
      img.width = 640;
      img.height = 480;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", ponerPlaceholder);
      media.appendChild(img);
    } else {
      ponerPlaceholder();
    }
    return media;
  }

  // ── Card de un curso: al abrirla se ve el contenido, organizado por módulo ──
  function construirCardCurso(curso, delCurso) {
    var item = el("button", "epe-app-card");
    item.type = "button";

    item.appendChild(
      construirMedia(
        EpeCatalogoMateriales.rutaImagen(curso),
        "Portada de «" + curso.titulo + "»",
        "curso",
        false
      )
    );

    var body = el("span", "epe-app-card-body");
    var categoria = el("span", "epe-app-card-categoria");
    categoria.textContent = "Curso · " + delCurso.length + (delCurso.length === 1 ? " documento" : " documentos");
    body.appendChild(categoria);

    var titulo = el("span", "epe-app-card-title");
    titulo.textContent = curso.titulo;
    body.appendChild(titulo);

    if (curso.descripcion) {
      var desc = el("span", "epe-app-card-desc");
      desc.textContent = curso.descripcion;
      body.appendChild(desc);
    }

    var accion = el("span", "epe-material-accion");
    accion.textContent = "Ver contenido";
    body.appendChild(accion);
    item.appendChild(body);

    item.addEventListener("click", function () {
      abrirCurso(curso, delCurso);
    });
    return item;
  }

  // Panel del curso: un encabezado por módulo y una fila por material.
  function abrirCurso(curso, delCurso) {
    var contenido = el("div", "epe-material-modal");
    EpeCatalogoMateriales.agruparPorModulo(delCurso).forEach(function (g) {
      var grupo = el("div", "epe-curso-grupo");
      if (g.modulo) {
        var h4 = el("h4", "epe-curso-grupo-titulo");
        h4.textContent = g.modulo.titulo;
        grupo.appendChild(h4);
      }
      g.materiales.forEach(function (m) {
        grupo.appendChild(construirFila(m));
      });
      contenido.appendChild(grupo);
    });
    EpeModal.open({ titulo: curso.titulo, contenido: contenido });
  }

  // Una fila del panel: PDF con acceso → link directo a Drive (pestaña nueva);
  // video, sin archivo o bloqueado → botón que abre el modal que corresponda.
  function construirFila(m) {
    var bloqueado = m.acceso === "logueado" && !sesionActiva;
    var urls = EpeCatalogoMateriales.urlsDe(m);
    var directo = m.tipo === "pdf" && !bloqueado && !!urls;

    var fila = el(directo ? "a" : "button", "epe-material-fila");
    if (directo) {
      fila.href = urls.ver;
      fila.target = "_blank";
      fila.rel = "noopener noreferrer";
    } else {
      fila.type = "button";
    }

    var icono = el("span", "epe-material-fila-icono");
    icono.setAttribute("aria-hidden", "true");
    icono.innerHTML = ICONOS[m.tipo === "video" ? "video" : "pdf"];
    fila.appendChild(icono);

    var texto = el("span", "epe-material-fila-texto");
    var nombre = el("strong");
    nombre.textContent = m.titulo;
    texto.appendChild(nombre);
    var sub = el("span", "epe-material-fila-sub");
    sub.textContent = (m.tipo === "video" ? "Video" : "PDF") + (m.categoria ? " · " + m.categoria : "");
    texto.appendChild(sub);
    fila.appendChild(texto);

    var fin = el("span", "epe-material-fila-fin");
    if (bloqueado) {
      var candado = el("span", "epe-material-fila-candado");
      candado.setAttribute("aria-hidden", "true");
      candado.innerHTML = ICONOS.candado;
      fin.appendChild(candado);
      fin.appendChild(document.createTextNode("Requiere cuenta"));
    } else {
      fin.textContent = m.tipo === "video" ? "Ver video" : "Abrir PDF";
      if (directo) {
        var aviso = el("span", "epe-sr-only");
        aviso.textContent = " (se abre en una pestaña nueva)";
        fin.appendChild(aviso);
      }
    }
    fila.appendChild(fin);

    if (!directo) {
      fila.addEventListener("click", function () {
        if (bloqueado) abrirAvisoAcceso(m);
        else EpeMaterialVisor.abrir(m);
      });
    }
    return fila;
  }

  // ── Card de un material suelto (sin curso) ──
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

    var media = construirMedia(
      EpeCatalogoMateriales.rutaImagen(m),
      "Primera página de «" + m.titulo + "»",
      m.tipo === "video" ? "video" : "pdf",
      bloqueado
    );

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
