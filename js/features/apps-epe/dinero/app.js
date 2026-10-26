/* Coordina las pantallas, las opciones y el acceso (tocar o barrido) de la práctica con dinero. */
(function (root) {
  'use strict';

  var h = EpeDom.h;
  var t = EpeI18n.t;

  // Cómo se responde (tocar, barrido, teclas, velocidad) lo guarda el panel de acceso de la plataforma, no esta configuración.
  var CONFIG_BASE = { nivel: 1, cantidad: 8, voz: true, interaccion: 'gestos' };

  function configGuardada() {
    var g = EpeAlmacen.leer('config', {});
    var c = Object.assign({}, CONFIG_BASE);
    if (g && typeof g === 'object') {
      if ([1, 2, 3].indexOf(g.nivel) !== -1) c.nivel = g.nivel;
      if ([5, 8, 10].indexOf(g.cantidad) !== -1) c.cantidad = g.cantidad;
      if (typeof g.voz === 'boolean') c.voz = g.voz;
      if (['guiado', 'gestos'].indexOf(g.interaccion) !== -1) c.interaccion = g.interaccion;
    }
    return c;
  }

  var App = {
    config: configGuardada(),
    accesoCfg: null, // lo que eligió la persona en el panel de acceso; null = tocar
    alEscape: null, // una ventana abierta puede atender Esc antes de volver al inicio
    restaurar: null, // devuelve el dispositivo a como estaba, si se lo configuró desde acá
    raiz: null,
    pantalla: null,
    vista: 'inicio',
    temporizadores: [],

    guardarConfig: function () { EpeAlmacen.guardar('config', this.config); },

    espera: function (fn, ms) {
      var id = setTimeout(fn, ms);
      this.temporizadores.push(id);
      return id;
    },

    limpiar: function () {
      this.temporizadores.forEach(clearTimeout);
      this.temporizadores = [];
      EpeDineroAcceso.desactivar();
      EpeVoz.parar();
      // Las ventanas de opciones viven en <body> (ver pantalla-config.js).
      this.alEscape = null;
      Array.prototype.slice.call(document.querySelectorAll('body > .modal-fondo')).forEach(function (m) { m.remove(); });
    },

    // Prepara el barrido para la pantalla actual. fn devuelve los elementos en orden.
    escanear: function (fn) {
      EpeDineroAcceso.configurar(this.accesoCfg);
      EpeDineroAcceso.activar(fn);
    },

    ir: function (nombre, datos) {
      this.limpiar();
      EpeVoz.activar(this.config.voz);
      EpeDom.vaciar(this.pantalla);
      this.vista = nombre;
      this.raiz.setAttribute('data-vista', nombre);
      EpePantallas[nombre](this, datos || {});
    },

    // Antes de salir a Apps EpE se ofrece devolver el dispositivo a como estaba.
    salir: function () {
      var app = this;
      function irAApps() { window.location.href = 'index.html'; }
      if (!(root.EpeConfigurarDispositivo && app.restaurar)) { irAApps(); return; }
      root.EpeConfigurarDispositivo.confirmarSalida(app.restaurar).then(function (r) {
        if (!r.salir) return;
        if (r.restaurado) app.restaurar = null;
        irAApps();
      });
    },

    iniciar: function (raiz) {
      var app = this;
      EpeVoz.activar(app.config.voz);

      app.pantalla = h('main', { class: 'pantalla', id: 'pantalla' });
      app.raiz = raiz;
      raiz.appendChild(h('header', { class: 'cabecera' }, [
        h('div', { class: 'cabecera-texto' }, [
          h('a', { class: 'epe-app-back', href: 'index.html', 'data-chrome': '', onclick: function (e) { e.preventDefault(); app.salir(); }, texto: t('app.volver') }),
          h('h1', { texto: t('app.titulo') }),
          h('p', { class: 'cabecera-sub', texto: t('app.sub') })
        ]),
        EpeComp.botonTema()
      ]));
      raiz.appendChild(app.pantalla);
      raiz.appendChild(EpeComp.pieAtribucion());

      // Esc vuelve atrás: en el celular y la tablet están los botones Salir y Volver.
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (app.alEscape && app.alEscape()) return;
        if (app.vista !== 'inicio') app.ir('inicio');
      });

      app.ir('inicio');
    }
  };

  root.EpeApp = App;
})(window);
