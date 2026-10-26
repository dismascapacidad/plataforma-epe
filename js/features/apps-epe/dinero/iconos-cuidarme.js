/* Dibujos en SVG de "Cuidarme al pagar": una viñeta por situación y un ícono por regla. Se suman a EpeIconos. */
(function (root) {
  'use strict';

  var s = EpeDom.s;
  var linea = { fill: 'none', stroke: '#14302d', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

  function svg(hijos, clase) {
    var el = s('svg', { viewBox: '0 0 64 64', class: 'icono-objeto ' + (clase || ''), 'aria-hidden': 'true', focusable: 'false' });
    hijos.forEach(function (n) { el.appendChild(n); });
    return el;
  }

  // Copia los dibujos de un objeto ya existente (QR, posnet) para dibujar algo encima.
  function base(clave) {
    var o = EpeIconos.objeto(clave);
    return Array.prototype.slice.call(o.childNodes).map(function (n) { return n.cloneNode(true); });
  }

  var ESCENAS = {
    // Una persona desconocida que habla.
    persona: function () {
      return [
        s('circle', { cx: 26, cy: 22, r: 11, fill: '#d9b08c' }),
        s('path', { d: 'M15 20q2-12 11-12t11 12q-5-4-11-4t-11 4z', fill: '#5a3d2b' }),
        s('path', { d: 'M6 58q0-20 20-20t20 20z', fill: '#7a6bb8' }),
        s('path', { d: 'M40 12h18a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H50l-6 6v-6h-4a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3z', fill: '#ffffff', stroke: '#14302d', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
        s('path', Object.assign({ d: 'M42 19h14M42 24h9' }, linea, { 'stroke-width': 2.5, stroke: '#9aa3ad' }))
      ];
    },
    // Llamada telefónica.
    llamada: function () {
      return [
        s('path', { d: 'M14 10q-6 2-5 10 4 20 24 33 7 3 11-3l-8-9-6 3q-8-5-12-14l5-5z', fill: '#2b2f3a', stroke: '#14302d', 'stroke-width': 2, 'stroke-linejoin': 'round' }),
        s('path', Object.assign({ d: 'M42 14q9 3 10 12M42 6q15 4 17 22' }, linea, { stroke: '#e0852b' }))
      ];
    },
    // El nombre que muestra la app no es el del comercio.
    nombre: function () {
      return [
        s('rect', { x: 6, y: 12, width: 52, height: 40, rx: 6, fill: '#ffffff', stroke: '#14302d', 'stroke-width': 3 }),
        s('circle', { cx: 20, cy: 28, r: 6, fill: '#9aa3ad' }),
        s('path', { d: 'M10 46q0-9 10-9t10 9z', fill: '#9aa3ad' }),
        s('path', Object.assign({ d: 'M34 25h18M34 33h12' }, linea, { stroke: '#127b72' })),
        s('circle', { cx: 50, cy: 46, r: 8, fill: '#e0852b' }),
        s('path', Object.assign({ d: 'M50 42v5M50 50v.5' }, linea, { stroke: '#ffffff', 'stroke-width': 3 }))
      ];
    },
    // Mensaje con enlace.
    mensaje: function () {
      return [
        s('rect', { x: 18, y: 3, width: 28, height: 58, rx: 6, fill: '#2b2f3a' }),
        s('rect', { x: 21, y: 9, width: 22, height: 44, rx: 2, fill: '#dff1ee' }),
        s('rect', { x: 24, y: 13, width: 16, height: 14, rx: 3, fill: '#ffffff', stroke: '#127b72', 'stroke-width': 1.5 }),
        s('path', Object.assign({ d: 'M27 18h10M27 22h6' }, linea, { 'stroke-width': 1.8, stroke: '#9aa3ad' })),
        s('rect', { x: 24, y: 31, width: 16, height: 7, rx: 3.5, fill: '#e0852b' }),
        s('path', Object.assign({ d: 'M28 34.5h8' }, linea, { 'stroke-width': 1.8, stroke: '#ffffff' })),
        s('circle', { cx: 32, cy: 57, r: 1.6, fill: '#8b93a1' })
      ];
    },
    // QR con otro QR pegado encima (una esquina despegada).
    qrpegado: function () {
      return base('qr').concat([
        s('rect', { x: 30, y: 28, width: 28, height: 28, rx: 2, fill: '#ffffff', stroke: '#e0852b', 'stroke-width': 3 }),
        s('rect', { x: 35, y: 33, width: 7, height: 7, fill: '#1b1f2a' }),
        s('rect', { x: 46, y: 33, width: 7, height: 7, fill: '#1b1f2a' }),
        s('rect', { x: 35, y: 44, width: 7, height: 7, fill: '#1b1f2a' }),
        s('path', { d: 'M58 48l-10 10 0-10z', fill: '#cfd5db', stroke: '#e0852b', 'stroke-width': 2, 'stroke-linejoin': 'round' })
      ]);
    },
    // Posnet con una mano ajena que se acerca.
    posnet: function () {
      return base('posnet').concat([
        s('path', { d: 'M46 58q-1-10 3-16l3-9q1-3 3-2t1 4l-1 5 4-1q3 0 3 3l-1 9q-1 6-5 7z', fill: '#d9b08c', stroke: '#14302d', 'stroke-width': 2, 'stroke-linejoin': 'round', transform: 'translate(-8 -6) scale(.9)' })
      ]);
    },
    // Comprobante que pide devolver plata.
    comprobante: function () {
      return [
        s('path', { d: 'M14 4h36v54l-6-4-6 4-6-4-6 4-6-4-6 4z', fill: '#ffffff', stroke: '#9aa3ad', 'stroke-width': 2 }),
        s('rect', { x: 20, y: 12, width: 24, height: 3, rx: 1.5, fill: '#9aa3ad' }),
        s('rect', { x: 20, y: 20, width: 16, height: 3, rx: 1.5, fill: '#9aa3ad' }),
        s('text', { x: 32, y: 42, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, fill: '#127b72', 'font-family': 'DM Sans, system-ui, sans-serif' }, '$ ?'),
        s('circle', { cx: 50, cy: 50, r: 9, fill: '#e0852b' }),
        s('path', Object.assign({ d: 'M50 45v6M50 54v.5' }, linea, { stroke: '#ffffff', 'stroke-width': 3 }))
      ];
    },
    // Premio inesperado.
    premio: function () {
      return [
        s('rect', { x: 10, y: 26, width: 44, height: 30, rx: 4, fill: '#c2362f', stroke: '#14302d', 'stroke-width': 2.5 }),
        s('rect', { x: 6, y: 18, width: 52, height: 12, rx: 3, fill: '#e0852b', stroke: '#14302d', 'stroke-width': 2.5 }),
        s('rect', { x: 28, y: 18, width: 8, height: 38, fill: '#ffe08a' }),
        s('path', Object.assign({ d: 'M32 18q-12-14-18-6t18 6q12-14 18-6t-18 6z' }, linea, { fill: '#ffe08a' }))
      ];
    }
  };

  var REGLAS = {
    // Llave: la clave es mía.
    clave: function () {
      return [
        s('circle', { cx: 22, cy: 32, r: 13, fill: '#e2c15b', stroke: '#14302d', 'stroke-width': 3 }),
        s('circle', { cx: 22, cy: 32, r: 4.5, fill: '#ffffff', stroke: '#14302d', 'stroke-width': 2 }),
        s('path', Object.assign({ d: 'M35 32h22M50 32v9M43 32v7' }, linea, { 'stroke-width': 4 }))
      ];
    },
    // Pausa.
    pausa: function () {
      return [
        s('circle', { cx: 32, cy: 32, r: 25, fill: '#cfe9e5', stroke: '#14302d', 'stroke-width': 3 }),
        s('rect', { x: 21, y: 20, width: 8, height: 24, rx: 2.5, fill: '#127b72' }),
        s('rect', { x: 35, y: 20, width: 8, height: 24, rx: 2.5, fill: '#127b72' })
      ];
    },
    // Nombre verificado.
    nombre: function () {
      return [
        s('rect', { x: 6, y: 14, width: 52, height: 36, rx: 6, fill: '#ffffff', stroke: '#14302d', 'stroke-width': 3 }),
        s('circle', { cx: 20, cy: 29, r: 5.5, fill: '#9aa3ad' }),
        s('path', { d: 'M11 43q0-8 9-8t9 8z', fill: '#9aa3ad' }),
        s('path', Object.assign({ d: 'M34 27h16M34 35h10' }, linea, { stroke: '#9aa3ad', 'stroke-width': 2.5 })),
        s('circle', { cx: 50, cy: 46, r: 9, fill: '#1f8a4c' }),
        s('path', Object.assign({ d: 'M45.5 46l3.3 3.3 5.7-6.3' }, linea, { stroke: '#ffffff', 'stroke-width': 3 }))
      ];
    }
  };

  function escena(clave) { return svg((ESCENAS[clave] || ESCENAS.persona)(), 'icono-escena'); }
  function regla(clave) { return svg((REGLAS[clave] || REGLAS.clave)(), 'icono-regla'); }

  root.EpeIconos = root.EpeIconos || {};
  root.EpeIconos.escena = escena;
  root.EpeIconos.regla = regla;
})(window);
