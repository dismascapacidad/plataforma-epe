/* Utilidades de DOM. Todo el texto entra por textContent: nunca innerHTML con datos de la persona. */
(function (root) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function aplicar(el, attrs) {
    if (!attrs) return el;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'texto') el.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    });
    return el;
  }

  function agregar(el, hijos) {
    if (hijos === null || hijos === undefined) return el;
    (Array.isArray(hijos) ? hijos : [hijos]).forEach(function (h) {
      if (h === null || h === undefined || h === false) return;
      el.appendChild(typeof h === 'string' || typeof h === 'number' ? document.createTextNode(String(h)) : h);
    });
    return el;
  }

  function h(tag, attrs, hijos) {
    return agregar(aplicar(document.createElement(tag), attrs), hijos);
  }

  function s(tag, attrs, hijos) {
    return agregar(aplicar(document.createElementNS(SVG_NS, tag), attrs), hijos);
  }

  function vaciar(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  root.EpeDom = { h: h, s: s, vaciar: vaciar };
})(window);
