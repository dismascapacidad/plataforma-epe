/**
 * ajuste-modal.js
 * Regla de la plataforma: un modal no tiene scroll. Cada modal (overlay +
 * primer hijo) toma su alto natural, sin tope ni scroll interno; si ese alto
 * no entra en la pantalla, se reduce la escala (transform: scale) lo justo
 * para que entre entero, centrado. Se recalcula al redimensionar, al
 * mostrarse/ocultarse y cuando cambia su contenido (por ejemplo al elegir
 * otro modo de acceso y cambiar la lista de teclas).
 *
 * Último recurso: si hiciera falta achicar por debajo de ESCALA_MIN (pantallas
 * diminutas o con zoom del navegador muy alto), el texto dejaría de ser
 * legible y se vuelve al comportamiento del CSS (scroll interno del modal):
 * mejor scroll que texto ilegible, y que no anule el zoom que pidió la persona.
 *
 * Script clásico (ver theme.js). Sin configuración: detecta solos los
 * elementos cuya clase termina en "-overlay", incluidos los que se agregan
 * después (EpeModal crea el suyo al abrirse por primera vez).
 */
(function () {
  "use strict";

  var MARGEN = 12; // px libres arriba y abajo de la pantalla
  var ESCALA_MIN = 0.78;
  var entradas = [];

  function esOverlay(el) {
    if (!el.classList) return false;
    for (var i = 0; i < el.classList.length; i++) {
      if (/-overlay$/.test(el.classList[i])) return true;
    }
    return false;
  }

  function soltar(e) {
    // Vuelve al comportamiento del CSS (scroll interno), ver ESCALA_MIN.
    e.modal.style.maxHeight = "";
    e.modal.style.overflow = "";
    e.modal.style.transform = "";
    if (e.cuerpo) {
      e.cuerpo.style.overflow = "";
      e.cuerpo.style.flex = "";
    }
  }

  function ajustar(e) {
    var m = e.modal;
    m.style.transform = "";
    if (e.overlay.hidden || getComputedStyle(e.overlay).display === "none") return;

    // Alto natural: sin tope de alto y sin scroll interno.
    m.style.maxHeight = "none";
    m.style.overflow = "visible";
    if (e.cuerpo) {
      e.cuerpo.style.overflow = "visible";
      e.cuerpo.style.flex = "none";
    }

    var alto = m.offsetHeight;
    var disponible = window.innerHeight - 2 * MARGEN;
    if (alto <= disponible) return;

    var k = disponible / alto;
    if (k < ESCALA_MIN) {
      soltar(e);
      return;
    }
    m.style.transformOrigin = "center center";
    m.style.transform = "scale(" + k.toFixed(4) + ")";
  }

  function programar(e) {
    if (e.pendiente) return;
    e.pendiente = true;
    requestAnimationFrame(function () {
      e.pendiente = false;
      ajustar(e);
    });
  }

  function registrar(overlay) {
    for (var i = 0; i < entradas.length; i++) if (entradas[i].overlay === overlay) return;
    var modal = overlay.firstElementChild;
    if (!modal) return;
    var e = {
      overlay: overlay,
      modal: modal,
      cuerpo: modal.querySelector(".epe-modal-body"),
      pendiente: false,
    };
    entradas.push(e);

    new MutationObserver(function () { programar(e); }).observe(overlay, {
      attributes: true,
      attributeFilter: ["hidden", "class", "style"],
    });
    new MutationObserver(function () { programar(e); }).observe(modal, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden", "class"],
    });
    if (window.ResizeObserver) new ResizeObserver(function () { programar(e); }).observe(modal);
    programar(e);
  }

  function escanear(raiz) {
    if (raiz.nodeType !== 1) return;
    if (esOverlay(raiz)) registrar(raiz);
    var hijos = raiz.querySelectorAll ? raiz.querySelectorAll('[class*="-overlay"]') : [];
    for (var i = 0; i < hijos.length; i++) if (esOverlay(hijos[i])) registrar(hijos[i]);
  }

  escanear(document.body);
  new MutationObserver(function (lista) {
    for (var i = 0; i < lista.length; i++) {
      for (var j = 0; j < lista[i].addedNodes.length; j++) escanear(lista[i].addedNodes[j]);
    }
  }).observe(document.body, { childList: true });

  window.addEventListener("resize", function () {
    for (var i = 0; i < entradas.length; i++) programar(entradas[i]);
  });
  window.EpeAjusteModal = { ajustar: function () { entradas.forEach(programar); } };
})();
