/**
 * atribucion.js
 * Respaldo de marca de dis+capacidad en la Plataforma EpE. Un solo lugar
 * para el nombre, el link y el logo: cada página solo deja un
 * <div data-atribucion="pie"> o <div data-atribucion="by"> y este script
 * lo rellena. Estilos en css/components/atribucion.css.
 *
 * Script clásico (sin type="module") a propósito, igual que theme.js: así
 * la página también funciona abierta directo con file://. La raíz del sitio
 * se deduce de la URL de este mismo script, para que el logo y el link a
 * "Acerca de" resuelvan bien desde cualquier carpeta.
 */
(function () {
  "use strict";

  var NOMBRE = "dis+capacidad";
  var URL_SITIO = "https://www.dismascapacidad.com.ar";

  var script = document.currentScript;
  if (!script || !script.src) return;
  var RAIZ = script.src.replace(/js\/core\/atribucion\.js(\?.*)?$/, "");

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function logo() {
    var img = el("img", "epe-logo-chip epe-atribucion-logo");
    img.src = RAIZ + "assets/img/logo-dismascapacidad.png";
    img.alt = NOMBRE;
    img.width = 105;
    img.height = 16;
    img.decoding = "async";
    return img;
  }

  /** "Un desarrollo de [logo] · Acerca de" — con links. */
  function pie() {
    var cont = el("footer", "epe-atribucion epe-atribucion-pie");
    cont.appendChild(el("span", null, "Un desarrollo de"));

    var sitio = el("a");
    sitio.href = URL_SITIO;
    sitio.target = "_blank";
    sitio.rel = "noopener";
    sitio.appendChild(logo());
    cont.appendChild(sitio);

    var acerca = el("a", "epe-atribucion-enlace", "Acerca de");
    acerca.href = RAIZ + "acerca/index.html";
    cont.appendChild(acerca);
    return cont;
  }

  /** "by [logo]" — sin links (en los modales de las apps no suma paradas de teclado). */
  function by() {
    var cont = el("div", "epe-atribucion epe-atribucion-by");
    cont.appendChild(el("span", null, "by"));
    cont.appendChild(logo());
    return cont;
  }

  var VARIANTES = { pie: pie, by: by };

  function render(raiz) {
    var slots = (raiz || document).querySelectorAll("[data-atribucion]");
    for (var i = 0; i < slots.length; i++) {
      var fabrica = VARIANTES[slots[i].getAttribute("data-atribucion")];
      if (!fabrica) continue;
      slots[i].replaceWith(fabrica());
    }
  }

  window.EpeAtribucion = { render: render };
  render(document);
})();
