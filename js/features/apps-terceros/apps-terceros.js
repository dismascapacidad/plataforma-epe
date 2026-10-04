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

    EpeCatalogo.getAll()
      .then(function (todas) {
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

  // Capturas de cada recurso, por id del catálogo (columna `id` de
  // catalogo_actividades). Viven en assets/img/terceros/ (archivos propios del
  // repo, nunca una URL que venga de la base): así no hace falta migrar la
  // tabla y ningún sitio externo recibe la IP de quien mira la página.
  // Mientras un recurso no tenga captura se muestra un placeholder con su
  // ícono. Ejemplo:
  //   "uuid-del-recurso": "../assets/img/terceros/cboard.webp",
  // Las capturas de sitios ajenos llevan atribución en el detalle del recurso.
  var IMAGENES = {};

  function construirItem(app) {
    var item = document.createElement("button");
    item.type = "button";
    item.className = "epe-app-card";

    // ── Captura (o placeholder) ──
    var media = document.createElement("span");
    media.className = "epe-app-card-media";

    function ponerPlaceholder() {
      media.innerHTML = "";
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

    var src = IMAGENES[app.id];
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

    item.appendChild(media);
    item.appendChild(body);

    item.addEventListener("click", function () {
      EpeTerceroDetalle.abrir(app, {});
    });

    return item;
  }

  return { init: init };
})();
