/**
 * apps-terceros.js
 * Página pública "Apps y recursos de terceros": lista todo lo que hay en
 * EpeCatalogo con tipo "tercero" (ver js/data/catalogo-actividades.js) y
 * abre el modal de detalle compartido (indicaciones + configuración +
 * abrir externo) al tocar una card — acá SIN botón de "vincular a un
 * caso", eso solo existe dentro del picker del espacio personal (ver
 * js/features/perfil/casos.js).
 *
 * Script clásico (ver theme.js). Namespace: EpeAppsTerceros.
 */

var EpeAppsTerceros = (function () {
  function init() {
    var grid = document.querySelector("[data-tienda-grid]");
    var vacio = document.querySelector("[data-tienda-vacio]");
    if (!grid) return;

    var apps = EpeCatalogo.getAll().filter(function (app) {
      return app.tipo === "tercero";
    });

    grid.innerHTML = "";
    vacio.hidden = apps.length > 0;

    apps.forEach(function (app) {
      grid.appendChild(construirItem(app));
    });
  }

  function construirItem(app) {
    var item = document.createElement("button");
    item.type = "button";
    item.className = "epe-catalogo-item";

    var icono = document.createElement("span");
    icono.className = "epe-catalogo-item-icono";
    icono.innerHTML = app.icono;
    icono.setAttribute("aria-hidden", "true");

    var nombre = document.createElement("strong");
    nombre.textContent = app.nombre;

    var categoria = document.createElement("span");
    categoria.className = "epe-catalogo-item-categoria";
    categoria.textContent = app.categoria;

    var desc = document.createElement("p");
    desc.textContent = app.descripcion;

    var autor = document.createElement("span");
    autor.className = "epe-catalogo-item-autor";
    autor.textContent = "De terceros: " + app.autor;

    item.appendChild(icono);
    item.appendChild(nombre);
    item.appendChild(categoria);
    item.appendChild(desc);
    item.appendChild(autor);

    item.addEventListener("click", function () {
      EpeTerceroDetalle.abrir(app, {});
    });

    return item;
  }

  return { init: init };
})();
