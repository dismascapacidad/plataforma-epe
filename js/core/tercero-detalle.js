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
 * Si el recurso declara `teclas` (es compatible con dispositivos
 * dis+capacidad) y la página cargó js/features/configurar-dispositivo/externo.js
 * (window.EpeDispositivoExterno), el modal ofrece configurar el dispositivo
 * antes de abrirlo. Sin ese script, el modal funciona como siempre.
 *
 * Depende de EpeModal (js/core/modal.js) para el modal en sí, y de las
 * clases .epe-tercero-detalle-* de css/components/tercero-detalle.css.
 *
 * Script clásico (ver theme.js). Namespace: EpeTerceroDetalle.
 */

var EpeTerceroDetalle = (function () {
  // Solo https: (nada de javascript:, data:, http:). Devuelve la URL o null.
  function urlSegura(url) {
    try {
      var u = new URL(url);
      return u.protocol === "https:" && u.hostname ? u.href : null;
    } catch (e) {
      return null;
    }
  }

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

    var externo = window.EpeDispositivoExterno;
    var compatible = !!(externo && externo.soporta(app));
    var url = urlSegura(app.url);

    if (compatible) {
      contenido.appendChild(bloqueCompatible(app));
    }

    if (url) {
      var aviso = document.createElement("p");
      aviso.className = "epe-tercero-detalle-salida";
      aviso.textContent =
        "Es un sitio de terceros: al abrirlo salís de la plataforma (" +
        new URL(url).hostname +
        ") y se rige por sus propias condiciones.";
      contenido.appendChild(aviso);
    }

    var footer = document.createElement("div");
    footer.className = "epe-tercero-detalle-acciones";

    if (compatible && url) {
      var configurar = document.createElement("button");
      configurar.type = "button";
      configurar.className = "epe-btn-acc epe-btn-sm";
      configurar.textContent = "Configurar mi dispositivo y abrir";
      configurar.addEventListener("click", function () {
        externo.configurarYAbrir(app).then(function (r) {
          // Si cancelaron antes de tocar el dispositivo, se vuelve al detalle.
          if (r && !r.ok && r.motivo === "cancelado") abrir(app, opciones);
        });
      });
      footer.appendChild(configurar);
    }

    if (url) {
      var abrirExterno = document.createElement("button");
      abrirExterno.type = "button";
      abrirExterno.className = "epe-btn-ghost epe-btn-sm";
      abrirExterno.textContent = compatible ? "Abrir sin configurar" : "Abrir página externa";
      abrirExterno.addEventListener("click", function () {
        window.open(url, "_blank", "noopener,noreferrer");
      });
      footer.appendChild(abrirExterno);
    }

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

  // Cuadro "Compatible con dis+capacidad": qué teclas usa el recurso y qué va a pasar.
  function bloqueCompatible(app) {
    var wrap = document.createElement("div");
    wrap.className = "epe-tercero-detalle-compat";
    var h4 = document.createElement("h4");
    h4.textContent = "Compatible con dispositivos dis+capacidad";
    var p = document.createElement("p");
    var nombres = app.teclas
      .map(function (t) {
        return t && typeof t.etiqueta === "string" ? t.etiqueta : "";
      })
      .filter(Boolean)
      .join(", ");
    p.textContent =
      "Este recurso necesita: " +
      nombres +
      ". Antes de abrirlo, la plataforma deja tu dispositivo listo para usarlo: solo te pregunta con qué " +
      "botón querés hacer cada cosa. Como es un recurso externo, para restaurar el dispositivo hay que " +
      "volver a esta pestaña de la plataforma y presionar «Restaurar».";
    wrap.appendChild(h4);
    wrap.appendChild(p);
    return wrap;
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
