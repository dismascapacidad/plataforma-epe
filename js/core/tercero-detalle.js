/**
 * tercero-detalle.js
 * Modal de detalle de una app de terceros: descripción, indicaciones de
 * uso, configuración de dispositivo necesaria, y el botón que abre el
 * recurso externo en pestaña nueva. Un solo lugar porque lo usa tanto la
 * página pública de Apps y recursos de terceros (`apps-terceros/`, sin
 * sesión) como el picker de actividades del espacio personal
 * (`js/features/perfil/casos.js`, agregando ahí un botón extra para
 * vincular la app a un caso).
 *
 * Depende de EpeModal (js/core/modal.js) para el modal en sí, y de las
 * clases .epe-tercero-detalle-* de css/components/tercero-detalle.css.
 *
 * Script clásico (ver theme.js). Namespace: EpeTerceroDetalle.
 */

var EpeTerceroDetalle = (function () {
  // opciones.accionExtra: { etiqueta, onClick } — botón adicional en el
  // footer (hoy lo usa casos.js para "Vincular a este caso"). Se omite
  // cuando no hace falta, como en la página pública de solo consulta.
  function abrir(app, opciones) {
    var accionExtra = opciones && opciones.accionExtra;

    var contenido = document.createElement("div");
    contenido.className = "epe-tercero-detalle";

    if (app.descripcion) {
      var desc = document.createElement("p");
      desc.className = "epe-tercero-detalle-desc";
      desc.textContent = app.descripcion;
      contenido.appendChild(desc);
    }

    if (app.instrucciones) {
      contenido.appendChild(bloque("Cómo se usa", app.instrucciones));
    }

    if (app.configuracion) {
      contenido.appendChild(bloque("Configuración de dispositivo necesaria", app.configuracion));
    }

    var footer = document.createElement("div");
    footer.className = "epe-tercero-detalle-acciones";

    var abrirExterno = document.createElement("button");
    abrirExterno.type = "button";
    abrirExterno.className = "epe-btn-ghost epe-btn-sm";
    abrirExterno.textContent = "Abrir página externa";
    abrirExterno.addEventListener("click", function () {
      window.open(app.url, "_blank", "noopener");
    });
    footer.appendChild(abrirExterno);

    if (accionExtra) {
      var extraBtn = document.createElement("button");
      extraBtn.type = "button";
      extraBtn.className = "epe-btn-acc epe-btn-sm";
      extraBtn.textContent = accionExtra.etiqueta;
      extraBtn.addEventListener("click", accionExtra.onClick);
      footer.appendChild(extraBtn);
    }

    contenido.appendChild(footer);

    EpeModal.open({
      titulo: app.nombre,
      contenido: contenido,
    });
  }

  function bloque(titulo, texto) {
    var wrap = document.createElement("div");
    wrap.className = "epe-tercero-detalle-bloque";
    var h4 = document.createElement("h4");
    h4.textContent = titulo;
    var p = document.createElement("p");
    p.textContent = texto;
    wrap.appendChild(h4);
    wrap.appendChild(p);
    return wrap;
  }

  return { abrir: abrir };
})();
