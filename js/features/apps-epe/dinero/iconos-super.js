/* Dibujos en SVG de los pasos de una compra en el súper. Se suman a EpeIconos. Nada se descarga de afuera. */
(function (root) {
  'use strict';

  var s = EpeDom.s;
  var trazo = { fill: 'none', stroke: '#14302d', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

  function changuito(conCosa) {
    var g = [
      s('path', Object.assign({ d: 'M4 10h8l6 30h30l5-22H15' }, trazo)),
      s('path', { d: 'M15 18h38l-4.5 20H20z', fill: '#cfe9e5' }),
      s('circle', { cx: 24, cy: 50, r: 4, fill: '#14302d' }),
      s('circle', { cx: 44, cy: 50, r: 4, fill: '#14302d' })
    ];
    if (conCosa) {
      g.push(s('rect', { x: 26, y: 5, width: 16, height: 16, rx: 3, fill: '#e0852b', stroke: '#14302d', 'stroke-width': 2.5 }));
      g.push(s('path', Object.assign({ d: 'M34 25v6M30 28l4 4 4-4' }, trazo, { stroke: '#127b72' })));
    }
    return g;
  }

  var PASOS = {
    // Mirar la lista: hoja con renglones.
    lista: function () {
      return [
        s('rect', { x: 12, y: 6, width: 40, height: 52, rx: 5, fill: '#ffffff', stroke: '#14302d', 'stroke-width': 3 }),
        s('rect', { x: 24, y: 2, width: 16, height: 8, rx: 3, fill: '#127b72' }),
        s('path', Object.assign({ d: 'M19 22h4M19 32h4M19 42h4' }, trazo, { stroke: '#127b72' })),
        s('path', Object.assign({ d: 'M28 22h16M28 32h16M28 42h12' }, trazo, { stroke: '#9aa3ad' }))
      ];
    },
    changuito: function () { return changuito(false); },
    // Buscar el pasillo: cartel indicador.
    pasillo: function () {
      return [
        s('rect', { x: 30, y: 6, width: 5, height: 52, rx: 2, fill: '#6b7380' }),
        s('path', { d: 'M8 12h30l8 7-8 7H8z', fill: '#127b72', stroke: '#14302d', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
        s('path', { d: 'M56 32H27l-8 7 8 7h29z', fill: '#e0852b', stroke: '#14302d', 'stroke-width': 2.5, 'stroke-linejoin': 'round' })
      ];
    },
    // Buscar el producto en la góndola: estantes con cajas y una resaltada.
    producto: function () {
      return [
        s('rect', { x: 5, y: 8, width: 54, height: 48, rx: 3, fill: '#f4ead8', stroke: '#14302d', 'stroke-width': 3 }),
        s('path', Object.assign({ d: 'M5 32h54' }, trazo)),
        s('rect', { x: 10, y: 17, width: 12, height: 15, rx: 2, fill: '#9aa3ad' }),
        s('rect', { x: 26, y: 13, width: 14, height: 19, rx: 2, fill: '#e0852b', stroke: '#14302d', 'stroke-width': 2.5 }),
        s('rect', { x: 44, y: 18, width: 11, height: 14, rx: 2, fill: '#9aa3ad' }),
        s('rect', { x: 10, y: 40, width: 16, height: 16, rx: 2, fill: '#9aa3ad' }),
        s('rect', { x: 32, y: 43, width: 20, height: 13, rx: 2, fill: '#9aa3ad' })
      ];
    },
    poner: function () { return changuito(true); },
    // Tachar de la lista: hoja con una tilde.
    tachar: function () {
      return [
        s('rect', { x: 12, y: 6, width: 40, height: 52, rx: 5, fill: '#ffffff', stroke: '#14302d', 'stroke-width': 3 }),
        s('path', Object.assign({ d: 'M19 21l3 3 5-6' }, trazo, { stroke: '#1f8a4c', 'stroke-width': 3.5 })),
        s('path', Object.assign({ d: 'M31 22h14' }, trazo, { stroke: '#9aa3ad' })),
        s('path', Object.assign({ d: 'M28 22h18' }, trazo, { stroke: '#c2362f', 'stroke-width': 2 })),
        s('path', Object.assign({ d: 'M19 34h4M19 44h4M29 34h14M29 44h10' }, trazo, { stroke: '#9aa3ad' }))
      ];
    },
    // Ir a la caja: caja registradora.
    caja: function () {
      return [
        s('rect', { x: 8, y: 36, width: 48, height: 20, rx: 4, fill: '#2b2f3a' }),
        s('rect', { x: 14, y: 12, width: 28, height: 20, rx: 3, fill: '#cfe9e5', stroke: '#14302d', 'stroke-width': 3 }),
        s('rect', { x: 19, y: 17, width: 18, height: 5, rx: 2, fill: '#127b72' }),
        s('path', { d: 'M42 24l14 12H42z', fill: '#8b93a1' }),
        s('rect', { x: 14, y: 42, width: 10, height: 8, rx: 2, fill: '#8b93a1' }),
        s('rect', { x: 28, y: 42, width: 10, height: 8, rx: 2, fill: '#8b93a1' }),
        s('rect', { x: 42, y: 42, width: 8, height: 8, rx: 2, fill: '#e0852b' })
      ];
    },
    // Cinta transportadora con productos.
    cinta: function () {
      return [
        s('rect', { x: 4, y: 40, width: 56, height: 10, rx: 5, fill: '#4a5260' }),
        s('circle', { cx: 12, cy: 45, r: 3, fill: '#9aa3ad' }),
        s('circle', { cx: 52, cy: 45, r: 3, fill: '#9aa3ad' }),
        s('rect', { x: 10, y: 24, width: 14, height: 16, rx: 2, fill: '#e0852b', stroke: '#14302d', 'stroke-width': 2.5 }),
        s('rect', { x: 28, y: 18, width: 12, height: 22, rx: 3, fill: '#127b72', stroke: '#14302d', 'stroke-width': 2.5 }),
        s('rect', { x: 44, y: 28, width: 12, height: 12, rx: 2, fill: '#e2c15b', stroke: '#14302d', 'stroke-width': 2.5 })
      ];
    },
    // Pagar: billetes y tarjeta.
    pagar: function () {
      return [
        s('rect', { x: 4, y: 12, width: 38, height: 22, rx: 4, fill: '#2f8f4e', stroke: 'rgba(0,0,0,.3)', 'stroke-width': 1.5 }),
        s('circle', { cx: 23, cy: 23, r: 6, fill: 'none', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 2 }),
        s('rect', { x: 22, y: 30, width: 38, height: 24, rx: 5, fill: '#2f6fb0', stroke: '#14302d', 'stroke-width': 2 }),
        s('rect', { x: 22, y: 36, width: 38, height: 6, fill: '#16385c' }),
        s('rect', { x: 28, y: 46, width: 12, height: 4, rx: 2, fill: '#e2c15b' })
      ];
    },
    // Salir: bolsa con ticket.
    salir: function () {
      return [
        s('path', Object.assign({ d: 'M22 20c0-8 4-13 10-13s10 5 10 13' }, trazo)),
        s('path', { d: 'M12 20h40l-3 38H15z', fill: '#e0852b', stroke: '#14302d', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
        s('path', { d: 'M40 30h14v22l-3-2-4 2-4-2-3 2z', fill: '#ffffff', stroke: '#9aa3ad', 'stroke-width': 1.5 })
      ];
    }
  };

  function paso(clave) {
    var svg = s('svg', { viewBox: '0 0 64 64', class: 'icono-objeto icono-paso', 'aria-hidden': 'true', focusable: 'false' });
    (PASOS[clave] || PASOS.lista)().forEach(function (n) { svg.appendChild(n); });
    return svg;
  }

  root.EpeIconos = root.EpeIconos || {};
  root.EpeIconos.paso = paso;
})(window);
