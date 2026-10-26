/* Resumen al terminar. Los resultados se muestran en pantalla y no se guardan en ningún lado. */
(function (root) {
  'use strict';

  var h = EpeDom.h;
  var t = EpeI18n.t;
  root.EpePantallas = root.EpePantallas || {};

  function dato(etiqueta, valor) {
    return h('div', { class: 'dato' }, [h('p', { class: 'dato-valor', texto: valor }), h('p', { class: 'dato-etiqueta', texto: etiqueta })]);
  }

  root.EpePantallas.resumen = function (app, datos) {
    var r = datos.resumen;
    var segundos = (r.msPromedio / 1000).toFixed(1).replace('.', ',');
    var apri = t('res.de', { a: r.aPrimera, b: r.total });

    var otra = h('button', { class: 'btn btn-primario', type: 'button', 'data-scan': '', 'data-voz': t('res.otra'), onclick: function () { app.ir(datos.modulo); }, texto: t('res.otra') });
    var config = h('button', { class: 'btn btn-secundario', type: 'button', 'data-scan': '', 'data-voz': t('res.config'), onclick: function () { app.ir('config', { modulo: datos.modulo }); }, texto: t('res.config') });
    var inicio = h('button', { class: 'btn btn-secundario', type: 'button', 'data-scan': '', 'data-voz': t('res.inicio'), onclick: function () { app.ir('inicio'); }, texto: t('res.inicio') });

    app.pantalla.appendChild(h('section', { class: 'resumen' }, [
      h('div', { class: 'resumen-tarjeta' }, [
        h('h2', { class: 'resumen-titulo', texto: t('res.titulo') }),
        h('div', { class: 'datos' }, [
          dato(t('res.apri'), apri),
          dato(t('res.errores'), String(r.errores)),
          dato(t('res.ayudas'), String(r.ayudas)),
          dato(t('res.tiempo'), t('res.segundos', { s: segundos }))
        ]),
        h('div', { class: 'resumen-botones' }, [otra, config, inicio])
      ])
    ]));

    EpeVoz.decir(t('res.titulo') + ' ' + t('res.apri') + ': ' + apri);
    app.escanear(function () { return [otra, config, inicio]; });
  };
})(window);
