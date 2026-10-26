/* Pantalla de inicio: los módulos disponibles y los que vienen. */
(function (root) {
  'use strict';

  var h = EpeDom.h;
  var t = EpeI18n.t;
  root.EpePantallas = root.EpePantallas || {};

  function abanico(valores) {
    return h('div', { class: 'abanico' + (valores.length === 2 ? ' duo' : ''), 'aria-hidden': 'true' }, valores.map(function (v, i) {
      return h('div', { class: 'abanico-hoja a' + i }, EpeIconos.dinero(v));
    }));
  }

  // Cuatro íconos de medios de pago para la tarjeta de "¿Cómo pago?".
  function medios() {
    return h('div', { class: 'iconos-medios', 'aria-hidden': 'true' }, ['efectivo', 'debito', 'qr', 'transferencia'].map(function (m) {
      return h('span', { class: 'icono-medio' }, EpeIconos.medio(m));
    }));
  }

  // Cuatro pasos de la compra para la tarjeta de "Ir al súper".
  function pasosSuper() {
    return h('div', { class: 'iconos-medios', 'aria-hidden': 'true' }, ['lista', 'changuito', 'caja', 'pagar'].map(function (k) {
      return h('span', { class: 'icono-medio' }, EpeIconos.paso(k));
    }));
  }

  // Tres reglas para la tarjeta de "Cuidarme al pagar".
  function reglasCuidarme() {
    return h('div', { class: 'iconos-medios iconos-3', 'aria-hidden': 'true' }, ['clave', 'pausa', 'nombre'].map(function (k) {
      return h('span', { class: 'icono-medio' }, EpeIconos.regla(k));
    }));
  }

  function tarjeta(app, id, valores, extra) {
    var titulo = t('home.' + id + '.titulo');
    var desc = t('home.' + id + '.desc');
    return h('button', {
      class: 'tarjeta', type: 'button', 'data-scan': '', 'data-voz': titulo + '. ' + desc,
      onclick: function () { app.ir('config', { modulo: id }); }
    }, [
      h('div', { class: 'tarjeta-arte' }, [valores ? abanico(valores) : null, extra || null]),
      h('h2', { class: 'tarjeta-titulo', texto: titulo }),
      h('p', { class: 'tarjeta-desc', texto: desc }),
      h('span', { class: 'tarjeta-accion' }, [h('span', { texto: t('home.practicar') }), EpeComp.iconoTrazo('M9 6l6 6-6 6')])
    ]);
  }

  root.EpePantallas.inicio = function (app, opciones) {
    var tarjetas = [
      tarjeta(app, 'reconocer', [100, 500, 1000]),
      tarjeta(app, 'pagar', [500, 200], h('div', { class: 'arte-producto' }, EpeIconos.producto('pan'))),
      tarjeta(app, 'medios', null, medios()),
      tarjeta(app, 'super', null, pasosSuper()),
      tarjeta(app, 'cuidarme', null, reglasCuidarme())
    ];

    app.pantalla.appendChild(h('section', { class: 'inicio' }, [
      h('div', { class: 'tarjetas' }, tarjetas),
      h('p', { class: 'nota', texto: t('home.nota') })
    ]));

    // Sin barrido: elegir el módulo se hace tocando. El barrido corre solo dentro de los ejercicios.
  };
})(window);
