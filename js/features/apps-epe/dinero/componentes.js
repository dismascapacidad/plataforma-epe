/* Piezas de interfaz compartidas por las pantallas de la práctica con dinero. */
(function (root) {
  'use strict';

  var h = EpeDom.h;
  var t = EpeI18n.t;

  function iconoTrazo(d) {
    var svg = EpeDom.s('svg', { viewBox: '0 0 24 24', class: 'icono', 'aria-hidden': 'true', focusable: 'false', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    svg.appendChild(EpeDom.s('path', { d: d }));
    return svg;
  }

  // Botón de claro/oscuro: el mismo de toda la plataforma (EpeTheme guarda la elección).
  function botonTema() {
    function icono(clase, trazos) {
      var svg = EpeDom.s('svg', { viewBox: '0 0 24 24', class: clase, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });
      trazos.forEach(function (tr) { svg.appendChild(tr); });
      return svg;
    }
    var s = EpeDom.s;
    var btn = h('button', { class: 'epe-theme-toggle', type: 'button', 'data-chrome': '', 'aria-pressed': 'false', 'aria-label': t('tema.alternar') }, [
      icono('icon-sun', [s('circle', { cx: 12, cy: 12, r: 4 }), s('path', { d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' })]),
      icono('icon-moon', [s('path', { d: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' })])
    ]);
    EpeTheme.initThemeToggle(btn);
    return btn;
  }

  // Grupo de opciones tipo "chips": una sola elegida.
  function grupo(etiqueta, opciones, actual, alElegir) {
    var botones = [];
    var cuerpo = h('div', { class: 'chips', role: 'group', 'aria-label': etiqueta });
    opciones.forEach(function (op) {
      var b = h('button', { class: 'chip', type: 'button', 'data-chrome': '', 'aria-pressed': String(op.valor === actual), texto: op.texto });
      b.addEventListener('click', function () {
        botones.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        alElegir(op.valor);
      });
      botones.push(b);
      cuerpo.appendChild(b);
    });
    var fila = h('div', { class: 'fila' }, [h('p', { class: 'fila-titulo', texto: etiqueta }), cuerpo]);
    return fila;
  }

  function barraEjercicio(app, indice, total, alEscuchar) {
    var puntos = h('div', { class: 'puntos', 'aria-hidden': 'true' });
    for (var k = 0; k < total; k++) {
      puntos.appendChild(h('span', { class: 'punto' + (k < indice ? ' hecho' : (k === indice ? ' actual' : '')) }));
    }
    return h('header', { class: 'ej-barra' }, [
      h('button', { class: 'btn btn-fantasma', type: 'button', 'data-chrome': '', onclick: function () { app.ir('inicio'); } }, [iconoTrazo('M15 18l-6-6 6-6'), h('span', { texto: t('btn.salir') })]),
      h('div', { class: 'progreso' }, [h('p', { class: 'progreso-texto', texto: t('ej.progreso', { n: indice + 1, total: total }) }), puntos]),
      h('button', { class: 'btn btn-fantasma', type: 'button', 'data-chrome': '', onclick: alEscuchar }, [iconoTrazo('M11 5 6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13'), h('span', { texto: t('btn.escuchar') })])
    ]);
  }

  // "by dis+capacidad": lo arma la plataforma (atribucion.js), igual que en las demás apps.
  function marca(clase) {
    var caja = h('div', { class: 'marca ' + (clase || '') }, h('div', { 'data-atribucion': 'by' }));
    root.EpeAtribucion.render(caja);
    return caja;
  }

  // "Un desarrollo de dis+capacidad · Acerca de": lo arma la plataforma.
  function pieAtribucion() {
    var caja = h('div', { class: 'pie' }, h('div', { 'data-atribucion': 'pie' }));
    root.EpeAtribucion.render(caja);
    return caja;
  }

  root.EpeComp = { botonTema: botonTema, grupo: grupo, barraEjercicio: barraEjercicio, marca: marca, pieAtribucion: pieAtribucion, iconoTrazo: iconoTrazo };
})(window);
