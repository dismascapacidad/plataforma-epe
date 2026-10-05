/**
 * apps-terceros.js
 * Página pública "Apps y recursos de terceros": lista todo lo que hay en
 * EpeCatalogo con tipo "tercero" (ver js/data/catalogo-actividades.js) y
 * abre el modal de detalle compartido (indicaciones + configuración +
 * abrir externo) al tocar una card — acá SIN botón de "vincular a un
 * caso", eso solo existe dentro del picker del espacio personal (ver
 * js/features/perfil/casos.js).
 *
 * EpeCatalogo.getAll() ahora trae los datos de Supabase (lectura pública,
 * sin necesitar login — ver supabase/002_patches.sql) y devuelve una
 * Promise.
 *
 * Script clásico (ver theme.js). Namespace: EpeAppsTerceros.
 */

var EpeAppsTerceros = (function () {
  function init() {
    var grid = document.querySelector("[data-tienda-grid]");
    var vacio = document.querySelector("[data-tienda-vacio]");
    if (!grid) return;

    // El módulo que compatibiliza recursos con dispositivos dis+capacidad es
    // ES (import dinámico, ruta relativa a ESTE archivo): se espera acá, antes
    // de dibujar las cards, para que la pill de compatibilidad no dependa de
    // quién termina primero. Si no carga, la página funciona igual sin esa parte.
    var modulo = import("../configurar-dispositivo/externo.js").catch(function () {
      return null;
    });

    // Si la última vez el dispositivo quedó configurado para un recurso externo
    // y no se restauró (pestaña cerrada o recargada), se ofrece restaurarlo.
    modulo.then(function (m) {
      if (m && window.EpeDispositivoExterno) window.EpeDispositivoExterno.revisarPendiente();
    });

    Promise.all([EpeCatalogo.getAll(), modulo])
      .then(function (res) {
        var todas = res[0];
        var apps = todas.filter(function (app) {
          return app.tipo === "tercero";
        });

        grid.innerHTML = "";
        vacio.hidden = apps.length > 0;
        vacio.textContent = "Todavía no hay recursos cargados en esta sección.";

        apps.forEach(function (app) {
          grid.appendChild(construirItem(app));
        });
      })
      .catch(function () {
        grid.innerHTML = "";
        vacio.hidden = false;
        vacio.textContent = "No se pudieron cargar los recursos. Recargá la página.";
      });
  }

  // Capturas de cada recurso, por URL del recurso (columna `url` de
  // catalogo_actividades). Viven en assets/img/terceros/ (archivos propios del
  // repo, nunca una URL que venga de la base): así no hace falta migrar la
  // tabla y ningún sitio externo recibe la IP de quien mira la página.
  // (se usa la URL porque el id lo genera la base al cargar la fila). Mientras
  // no haya captura se muestra un placeholder con su
  // ícono. Ejemplo:
  //   "https://apps.makeymakey.com/play/#counter": "../assets/img/terceros/counter-makey.webp",
  // Las capturas de sitios ajenos llevan atribución en el detalle del recurso.
  var IMAGENES = {
    "https://apps.makeymakey.com/play/#counter": "../assets/img/terceros/counter-makey.webp",
    "https://arcade.makeymakey.com/play/#bouncey%20face": "../assets/img/terceros/bouncey-face-makey.webp",
    "https://apps.makeymakey.com/play/#timer": "../assets/img/terceros/timer-makey.webp",
    "https://apps.makeymakey.com/bongos/": "../assets/img/terceros/bongos-makey.webp",
    "https://elbuhoboo.com/juegos-educativos/animalitos/": "../assets/img/terceros/buho-animalitos.webp",
    "https://elbuhoboo.com/juegos-educativos/formitas/": "../assets/img/terceros/buho-formitas.webp",
    "https://elbuhoboo.com/juegos-educativos/completar-panda/": "../assets/img/terceros/buho-completar.webp",
  };

  // Clave tolerante: sin protocolo, sin "www." y sin "/" final, en minúsculas,
  // para que una diferencia menor al cargar la URL en la base no pierda la captura.
  function claveUrl(u) {
    return String(u || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+(?=#|$)/, "");
  }

  function imagenDe(app) {
    var k = claveUrl(app.url);
    for (var u in IMAGENES) {
      if (claveUrl(u) === k) return IMAGENES[u];
    }
    return null;
  }

  function construirItem(app) {
    var item = document.createElement("button");
    item.type = "button";
    item.className = "epe-app-card";

    // ── Captura (o placeholder) ──
    var media = document.createElement("span");
    media.className = "epe-app-card-media";

    function ponerPlaceholder() {
      // Saca la imagen (y un placeholder previo) pero deja la pill, si ya está.
      Array.prototype.slice.call(media.children).forEach(function (hijo) {
        if (!hijo.classList.contains("epe-app-card-pill")) media.removeChild(hijo);
      });
      media.classList.add("epe-app-card-media-vacia");
      var ph = document.createElement("span");
      ph.className = "epe-app-card-placeholder";
      ph.setAttribute("aria-hidden", "true");
      // app.icono sale del mapa fijo ICONOS de catalogo-actividades.js (SVG
      // escritos a mano en el repo); la base solo guarda la clave. Por eso
      // este innerHTML no contiene texto de usuario.
      ph.innerHTML = app.icono;
      media.appendChild(ph);
    }

    var src = imagenDe(app);
    if (src) {
      var img = document.createElement("img");
      img.src = src;
      img.alt = "Captura de " + app.nombre;
      img.width = 640;
      img.height = 480;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", ponerPlaceholder);
      media.appendChild(img);
    } else {
      ponerPlaceholder();
    }

    // ── Texto ── (todo con textContent: la base puede tener cualquier cosa)
    var body = document.createElement("span");
    body.className = "epe-app-card-body";

    if (app.categoria) {
      var categoria = document.createElement("span");
      categoria.className = "epe-app-card-categoria";
      categoria.textContent = app.categoria;
      body.appendChild(categoria);
    }

    var titulo = document.createElement("span");
    titulo.className = "epe-app-card-title";
    titulo.textContent = app.nombre;
    body.appendChild(titulo);

    var desc = document.createElement("span");
    desc.className = "epe-app-card-desc";
    desc.textContent = app.descripcion;
    body.appendChild(desc);

    var autor = document.createElement("span");
    autor.className = "epe-app-card-autor";
    autor.textContent = "De terceros: " + app.autor;
    body.appendChild(autor);

    // Pill de compatibilidad: solo los recursos que declaran `teclas` (ver
    // catalogo-actividades.js) y que externo.js acepta como válidos.
    var externo = window.EpeDispositivoExterno;
    if (app.teclas && externo && externo.soporta(app)) {
      var pill = document.createElement("span");
      pill.className = "epe-app-card-pill";
      pill.title = "Compatible con dispositivos de acceso dis+capacidad";
      var pillIcono = document.createElement("span");
      pillIcono.className = "epe-app-card-pill-icon";
      pillIcono.setAttribute("aria-hidden", "true");
      pill.appendChild(pillIcono);
      pill.appendChild(document.createTextNode("Compatible dis+capacidad"));
      media.appendChild(pill);
    }

    item.appendChild(media);
    item.appendChild(body);

    item.addEventListener("click", function () {
      EpeTerceroDetalle.abrir(app, {});
    });

    return item;
  }

  return { init: init };
})();
