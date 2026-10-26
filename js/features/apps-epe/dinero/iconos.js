/* Dibujos en SVG: billetes y monedas ilustrativos, y los productos. Nada se descarga de afuera. */
(function (root) {
  'use strict';

  var s = EpeDom.s;
  var Datos = EpeDineroDatos;
  var contador = 0;

  function buscar(lista, valor) {
    for (var i = 0; i < lista.length; i++) if (lista[i].valor === valor) return lista[i];
    return null;
  }

  function degradado(id, c1, c2) {
    return s('defs', null, s('linearGradient', { id: id, x1: '0', y1: '0', x2: '1', y2: '1' }, [
      s('stop', { offset: '0', 'stop-color': c2 }),
      s('stop', { offset: '1', 'stop-color': c1 })
    ]));
  }

  function tamanoNumero(texto) {
    if (texto.length >= 6) return 27;
    if (texto.length === 5) return 31;
    if (texto.length === 4) return 35;
    return 40;
  }

  // Imágenes de los billetes en vigencia (BCRA). Si una falta o no carga, se usa el dibujo.
  // Hay billetes de $100 de dos diseños en circulación: se van alternando.
  var IMAGENES = { 50: ['../assets/img/dinero/billetes/50.webp'], 100: ['../assets/img/dinero/billetes/100.webp', '../assets/img/dinero/billetes/100b.webp'],
    200: ['../assets/img/dinero/billetes/200.webp'], 500: ['../assets/img/dinero/billetes/500.webp'], 1000: ['../assets/img/dinero/billetes/1000.webp'],
    2000: ['../assets/img/dinero/billetes/2000.webp'], 10000: ['../assets/img/dinero/billetes/10000.webp'], 20000: ['../assets/img/dinero/billetes/20000.webp'] };
  var turno = {};

  function billete(valor) {
    var dibujo = billeteDibujado(valor);
    if (!IMAGENES[valor]) return dibujo;
    var fotos = IMAGENES[valor];
    turno[valor] = ((turno[valor] || 0) + 1) % fotos.length;
    var svg = s('svg', {
      viewBox: '0 0 220 93', role: 'img', class: 'billete billete-foto',
      'aria-label': EpeI18n.t('a11y.billete', { valor: EpeI18n.dinero(valor) }), focusable: 'false'
    });
    var img = s('image', { href: fotos[turno[valor]], x: 0, y: 0, width: 220, height: 93, preserveAspectRatio: 'xMidYMid slice' });
    img.addEventListener('error', function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('viewBox', '0 0 220 110');
      svg.setAttribute('class', 'billete');
      while (dibujo.firstChild) svg.appendChild(dibujo.firstChild);
    });
    svg.appendChild(img);
    return svg;
  }

  function billeteDibujado(valor) {
    var d = buscar(Datos.BILLETES, valor);
    var id = 'bg' + (++contador);
    var etiqueta = EpeI18n.dinero(valor);
    var svg = s('svg', {
      viewBox: '0 0 220 110', role: 'img', class: 'billete',
      'aria-label': EpeI18n.t('a11y.billete', { valor: etiqueta }), focusable: 'false'
    });
    svg.appendChild(degradado(id, d.fondo, d.fondo2));
    svg.appendChild(s('rect', { x: 2, y: 2, width: 216, height: 106, rx: 10, fill: 'url(#' + id + ')', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 2 }));
    svg.appendChild(s('rect', { x: 10, y: 10, width: 200, height: 90, rx: 6, fill: 'none', stroke: d.texto, 'stroke-opacity': '.55', 'stroke-width': 1.5 }));
    svg.appendChild(s('path', { d: 'M10 78 Q 60 48 110 78 T 210 78', fill: 'none', stroke: d.texto, 'stroke-opacity': '.22', 'stroke-width': 2 }));
    svg.appendChild(s('path', { d: 'M10 88 Q 60 58 110 88 T 210 88', fill: 'none', stroke: d.texto, 'stroke-opacity': '.16', 'stroke-width': 2 }));
    svg.appendChild(s('ellipse', { cx: 110, cy: 52, rx: 52, ry: 33, fill: 'rgba(255,255,255,.16)', stroke: d.texto, 'stroke-opacity': '.5', 'stroke-width': 1.5 }));
    var corto = etiqueta.replace('$', '');
    var base = { fill: d.texto, 'font-family': 'DM Sans, system-ui, sans-serif', 'font-weight': 800 };
    svg.appendChild(s('text', Object.assign({ x: 110, y: 52 + tamanoNumero(corto) * 0.36, 'text-anchor': 'middle', 'font-size': tamanoNumero(corto) }, base), corto));
    svg.appendChild(s('text', Object.assign({ x: 20, y: 30, 'font-size': 14 }, base), corto));
    svg.appendChild(s('text', Object.assign({ x: 200, y: 30, 'text-anchor': 'end', 'font-size': 14 }, base), corto));
    svg.appendChild(s('text', Object.assign({ x: 110, y: 96, 'text-anchor': 'middle', 'font-size': 8, 'letter-spacing': 2, 'fill-opacity': '.85' }, base, { 'font-weight': 700 }), EpeI18n.t('a11y.billete.texto')));
    return svg;
  }

  function moneda(valor) {
    var d = buscar(Datos.MONEDAS, valor);
    var id = 'mg' + (++contador);
    var r = d.diametro / 2;
    var svg = s('svg', {
      viewBox: '0 0 100 100', role: 'img', class: 'moneda',
      'aria-label': EpeI18n.t('a11y.moneda', { valor: EpeI18n.dinero(valor) }), focusable: 'false'
    });
    svg.appendChild(degradado(id, d.fondo, d.fondo2));
    svg.appendChild(s('circle', { cx: 50, cy: 50, r: r, fill: 'url(#' + id + ')', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 2 }));
    svg.appendChild(s('circle', { cx: 50, cy: 50, r: r - 5, fill: 'none', stroke: d.texto, 'stroke-opacity': '.45', 'stroke-width': 1.5 }));
    var n = String(valor);
    svg.appendChild(s('text', {
      x: 50, y: 50 + (n.length > 1 ? 9 : 11), 'text-anchor': 'middle', 'font-size': n.length > 1 ? 26 : 32,
      fill: d.texto, 'font-family': 'DM Sans, system-ui, sans-serif', 'font-weight': 800
    }, n));
    return svg;
  }

  function dinero(valor) {
    return buscar(Datos.MONEDAS, valor) && !buscar(Datos.BILLETES, valor) ? moneda(valor) : billete(valor);
  }

  var DIBUJOS = {
    fruta: function () {
      return [
        s('circle', { cx: 32, cy: 38, r: 19, fill: '#d9483b' }),
        s('circle', { cx: 26, cy: 32, r: 5, fill: '#ffffff', 'fill-opacity': '.28' }),
        s('path', { d: 'M32 20 Q 32 12 36 8', fill: 'none', stroke: '#5a3b1e', 'stroke-width': 3, 'stroke-linecap': 'round' }),
        s('path', { d: 'M34 16 Q 44 8 50 14 Q 42 20 34 16 Z', fill: '#3f9a43' })
      ];
    },
    pan: function () {
      return [
        s('ellipse', { cx: 32, cy: 38, rx: 25, ry: 15, fill: '#d49a4f' }),
        s('path', { d: 'M18 32 L24 44 M30 29 L36 46 M42 31 L47 44', stroke: '#a8702d', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' })
      ];
    },
    galleta: function () {
      return [
        s('circle', { cx: 32, cy: 34, r: 21, fill: '#c98d4e' }),
        s('circle', { cx: 24, cy: 28, r: 3.2, fill: '#5a3418' }),
        s('circle', { cx: 38, cy: 26, r: 3.2, fill: '#5a3418' }),
        s('circle', { cx: 30, cy: 40, r: 3.2, fill: '#5a3418' }),
        s('circle', { cx: 42, cy: 40, r: 3.2, fill: '#5a3418' })
      ];
    },
    botella: function () {
      return [
        s('rect', { x: 27, y: 6, width: 10, height: 7, rx: 2, fill: '#2b2f3a' }),
        s('rect', { x: 28, y: 12, width: 8, height: 12, fill: '#4aa3d8' }),
        s('rect', { x: 21, y: 22, width: 22, height: 34, rx: 6, fill: '#4aa3d8' }),
        s('rect', { x: 21, y: 32, width: 22, height: 14, fill: '#ffffff', 'fill-opacity': '.85' })
      ];
    },
    carton: function () {
      return [
        s('rect', { x: 18, y: 22, width: 28, height: 34, fill: '#f4f4f1', stroke: '#9aa3ad', 'stroke-width': 1.5 }),
        s('polygon', { points: '18,22 32,8 46,22', fill: '#3b82c4' }),
        s('rect', { x: 18, y: 34, width: 28, height: 10, fill: '#3b82c4' })
      ];
    },
    bolsa: function () {
      return [
        s('rect', { x: 16, y: 18, width: 32, height: 38, rx: 3, fill: '#e2b95e' }),
        s('rect', { x: 16, y: 12, width: 32, height: 9, rx: 2, fill: '#c79b3c' }),
        s('circle', { cx: 32, cy: 38, r: 9, fill: '#ffffff', 'fill-opacity': '.8' })
      ];
    },
    carne: function () {
      return [
        s('ellipse', { cx: 30, cy: 36, rx: 23, ry: 16, fill: '#c0504d' }),
        s('ellipse', { cx: 28, cy: 34, rx: 11, ry: 7, fill: '#e08c88' }),
        s('rect', { x: 46, y: 28, width: 12, height: 5, rx: 2.5, fill: '#f1ead9' }),
        s('circle', { cx: 58, cy: 27, r: 4, fill: '#f1ead9' }),
        s('circle', { cx: 58, cy: 34, r: 4, fill: '#f1ead9' })
      ];
    },
    queso: function () {
      return [
        s('path', { d: 'M8 46 L56 46 L56 30 L8 20 Z', fill: '#f2c94c' }),
        s('path', { d: 'M8 46 L56 46 L56 50 L8 50 Z', fill: '#d9a62a' }),
        s('circle', { cx: 24, cy: 38, r: 3.5, fill: '#d9a62a' }),
        s('circle', { cx: 40, cy: 40, r: 3, fill: '#d9a62a' }),
        s('circle', { cx: 46, cy: 34, r: 2.5, fill: '#d9a62a' })
      ];
    }
  };

  function producto(clave) {
    var svg = s('svg', { viewBox: '0 0 64 64', class: 'icono-producto', 'aria-hidden': 'true', focusable: 'false' });
    (DIBUJOS[clave] || DIBUJOS.bolsa)().forEach(function (n) { svg.appendChild(n); });
    return svg;
  }

  // Objetos de los medios de pago: tarjeta, celular, posnet, QR de práctica, etc. Todo dibujado acá, sin imágenes de afuera.
  // El QR es un dibujo decorativo (no se puede escanear) y ninguna marca real aparece en estos dibujos.
  // Cuadrícula de 17x17: tres marcas en las esquinas y relleno fijo. Es un dibujo, no un código real.
  function celdaQr(x, y) {
    var n = 17;
    function marca(ox, oy) {
      var dx = x - ox, dy = y - oy;
      if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
      var borde = dx === 0 || dy === 0 || dx === 6 || dy === 6;
      var centro = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      return borde || centro;
    }
    var m = marca(0, 0); if (m !== null) return m;
    m = marca(n - 7, 0); if (m !== null) return m;
    m = marca(0, n - 7); if (m !== null) return m;
    if ((x === 7 && y < 8) || (y === 7 && x < 8) || (x === n - 8 && y < 8) || (y === n - 8 && x < 8)) return false;
    return ((x * 7 + y * 13 + x * y * 3) % 5) < 2;
  }

  function dibujoQr() {
    var n = 17;
    var g = [s('rect', { x: 2, y: 2, width: 60, height: 60, rx: 4, fill: '#ffffff' })];
    var celda = 52 / n;
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (celdaQr(x, y)) g.push(s('rect', { x: 6 + x * celda, y: 6 + y * celda, width: celda + 0.2, height: celda + 0.2, fill: '#1b1f2a' }));
      }
    }
    return g;
  }

  var OBJETOS = {
    tarjeta: function () {
      return [
        s('rect', { x: 4, y: 14, width: 56, height: 36, rx: 6, fill: '#2f6fb0' }),
        s('rect', { x: 4, y: 21, width: 56, height: 8, fill: '#16385c' }),
        s('rect', { x: 10, y: 35, width: 12, height: 9, rx: 2, fill: '#e2c15b' }),
        s('rect', { x: 28, y: 38, width: 24, height: 3, rx: 1.5, fill: '#ffffff', 'fill-opacity': '.7' })
      ];
    },
    celular: function () {
      return [
        s('rect', { x: 18, y: 3, width: 28, height: 58, rx: 6, fill: '#2b2f3a' }),
        s('rect', { x: 21, y: 9, width: 22, height: 44, rx: 2, fill: '#dff1ee' }),
        s('rect', { x: 24, y: 14, width: 16, height: 5, rx: 2, fill: '#127b72' }),
        s('rect', { x: 24, y: 23, width: 16, height: 4, rx: 2, fill: '#127b72', 'fill-opacity': '.5' }),
        s('rect', { x: 24, y: 30, width: 16, height: 4, rx: 2, fill: '#127b72', 'fill-opacity': '.5' }),
        s('circle', { cx: 32, cy: 57, r: 1.6, fill: '#8b93a1' })
      ];
    },
    posnet: function () {
      var teclas = [];
      for (var fila = 0; fila < 3; fila++) for (var col = 0; col < 3; col++) teclas.push(s('rect', { x: 18 + col * 10, y: 38 + fila * 7, width: 7, height: 5, rx: 1.5, fill: '#8b93a1' }));
      return [
        s('rect', { x: 12, y: 4, width: 40, height: 56, rx: 6, fill: '#2b2f3a' }),
        s('rect', { x: 17, y: 9, width: 30, height: 18, rx: 2, fill: '#cfe9e5' }),
        s('rect', { x: 20, y: 13, width: 18, height: 3, rx: 1.5, fill: '#127b72' }),
        s('rect', { x: 20, y: 19, width: 12, height: 3, rx: 1.5, fill: '#127b72', 'fill-opacity': '.5' })
      ].concat(teclas);
    },
    qr: dibujoQr,
    transferir: function () {
      return [
        s('circle', { cx: 14, cy: 32, r: 9, fill: '#127b72' }),
        s('circle', { cx: 50, cy: 32, r: 9, fill: '#127b72' }),
        s('path', { d: 'M26 26h14M36 21l5 5-5 5', fill: 'none', stroke: '#e0852b', 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        s('path', { d: 'M38 40H24M28 35l-5 5 5 5', fill: 'none', stroke: '#e0852b', 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      ];
    },
    billetes: function () {
      return [
        s('rect', { x: 8, y: 30, width: 44, height: 22, rx: 4, fill: '#2f8f4e', stroke: 'rgba(0,0,0,.3)', 'stroke-width': 1.5 }),
        s('rect', { x: 12, y: 22, width: 44, height: 22, rx: 4, fill: '#e2a73b', stroke: 'rgba(0,0,0,.3)', 'stroke-width': 1.5 }),
        s('circle', { cx: 34, cy: 33, r: 6, fill: 'none', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 2 })
      ];
    },
    vendedor: function () {
      return [
        s('circle', { cx: 32, cy: 20, r: 11, fill: '#e8b98f' }),
        s('path', { d: 'M20 17q2-11 12-11t12 11q-6-4-12-4t-12 4z', fill: '#4a3424' }),
        s('path', { d: 'M10 58q0-20 22-20t22 20z', fill: '#127b72' }),
        s('rect', { x: 24, y: 46, width: 16, height: 12, rx: 2, fill: '#ffffff', 'fill-opacity': '.85' })
      ];
    },
    ticket: function () {
      return [
        s('path', { d: 'M16 6h32v52l-5-4-5 4-6-4-6 4-5-4-5 4z', fill: '#ffffff', stroke: '#9aa3ad', 'stroke-width': 2 }),
        s('rect', { x: 22, y: 15, width: 20, height: 3, rx: 1.5, fill: '#9aa3ad' }),
        s('rect', { x: 22, y: 23, width: 20, height: 3, rx: 1.5, fill: '#9aa3ad' }),
        s('rect', { x: 22, y: 31, width: 12, height: 3, rx: 1.5, fill: '#9aa3ad' }),
        s('rect', { x: 22, y: 40, width: 20, height: 4, rx: 2, fill: '#127b72' })
      ];
    },
    comercio: function () {
      return [
        s('path', { d: 'M6 24 12 8h40l6 16z', fill: '#e0852b' }),
        s('path', { d: 'M6 24h52v4a8.7 8.7 0 0 1-17.3 0 8.7 8.7 0 0 1-17.4 0A8.7 8.7 0 0 1 6 28z', fill: '#c96d17' }),
        s('rect', { x: 10, y: 34, width: 44, height: 24, fill: '#f4ead8' }),
        s('rect', { x: 26, y: 40, width: 12, height: 18, fill: '#6e4b2a' })
      ];
    }
  };

  // Ícono para cada medio de pago.
  var MEDIO_OBJETO = { efectivo: 'billetes', debito: 'tarjeta', qr: 'qr', transferencia: 'transferir' };

  function objeto(clave) {
    var svg = s('svg', { viewBox: '0 0 64 64', class: 'icono-objeto', 'aria-hidden': 'true', focusable: 'false' });
    (OBJETOS[clave] || OBJETOS.billetes)().forEach(function (n) { svg.appendChild(n); });
    return svg;
  }

  function medio(clave) { return objeto(MEDIO_OBJETO[clave] || clave); }

  root.EpeIconos = { billete: billete, moneda: moneda, dinero: dinero, producto: producto, objeto: objeto, medio: medio };
})(window);
