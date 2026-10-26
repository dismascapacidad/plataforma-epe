/* Módulo 2: pagar con billetes. Se arrastra (o se toca) cada billete al mostrador hasta completar el precio.
   Sin tiempo límite. "Ayuda" marca el próximo billete; "Pagar" confirma: si falta avisa, si sobra se paga igual y se muestra el vuelto. */
(function (root) {
  'use strict';

  var h = EpeDom.h;
  var t = EpeI18n.t;
  var L = EpeDineroLogica;
  root.EpePantallas = root.EpePantallas || {};

  root.EpePantallas.pagar = function (app) {
    var cfg = app.config;
    var rondas = L.generarPagar(cfg.nivel, cfg.cantidad);
    var resultados = [];
    var i = 0;
    var contenedor = h('section', { class: 'ej ej-pagar' });
    app.pantalla.appendChild(contenedor);

    function mostrar() {
      var r = rondas[i];
      var precio = r.producto.precio;
      var colocados = [];
      var ronda = { errores: 0, ayudas: 0, t0: Date.now(), cerrada: false };
      EpeDom.vaciar(contenedor);

      var aviso = h('p', { class: 'aviso', role: 'status', 'aria-live': 'polite' });
      function decirAviso(tipo, texto) {
        aviso.className = 'aviso ' + tipo;
        aviso.textContent = texto;
        EpeVoz.decir(texto);
      }

      var billetesEl = h('div', { class: 'mostrador-billetes' });
      var soltarEl = h('p', { class: 'soltar', texto: t('pay.soltar') });
      var totalEl = h('p', { class: 'mostrador-total' });
      var relleno = h('span');
      var medidor = h('div', { class: 'medidor', 'aria-hidden': 'true' }, relleno);
      var vueltoEl = h('div', { class: 'vuelto', hidden: true });
      var zona = h('div', { class: 'mostrador', role: 'group', 'aria-label': t('pay.mostrador') }, [
        h('h3', { class: 'zona-titulo', texto: t('pay.mostrador') }),
        billetesEl, soltarEl, medidor, totalEl, vueltoEl
      ]);

      var pilas = {};
      var sacar = h('button', { class: 'btn btn-secundario', type: 'button', 'data-scan': '', 'data-voz': t('pay.sacar'), onclick: function () { quitar(colocados.length - 1); }, texto: t('pay.sacar') });
      var ayuda = h('button', { class: 'btn btn-secundario', type: 'button', 'data-scan': '', 'data-voz': t('pay.ayuda'), onclick: pedirAyuda, texto: t('pay.ayuda') });
      var pagarBtn = h('button', { class: 'btn btn-primario', type: 'button', 'data-scan': '', 'data-voz': t('pay.pagar'), onclick: pagar, texto: t('pay.pagar') });

      function quitarPistas() {
        var marcadas = contenedor.querySelectorAll('.pista');
        for (var k = 0; k < marcadas.length; k++) marcadas[k].classList.remove('pista');
      }

      function actualizar() {
        var total = L.sumar(colocados);
        EpeDom.vaciar(billetesEl);
        colocados.forEach(function (v, idx) {
          var b = h('button', {
            class: 'billete-puesto', type: 'button', 'data-chrome': '',
            'aria-label': t('pay.sacar.billete', { valor: EpeI18n.dinero(v) }),
            onclick: function () { quitar(idx); }
          }, EpeIconos.dinero(v));
          billetesEl.appendChild(b);
        });
        soltarEl.hidden = colocados.length > 0;
        totalEl.textContent = colocados.length ? t('pay.total', { total: EpeI18n.dinero(total), precio: EpeI18n.dinero(precio) }) : t('pay.vacio');
        relleno.style.width = Math.min(100, Math.round(total / precio * 100)) + '%';
        medidor.className = 'medidor' + (total > precio ? ' sobra' : total === precio ? ' justo' : '');
        sacar.disabled = colocados.length === 0;
      }

      function agregar(valor) {
        if (ronda.cerrada) return;
        if (colocados.length >= L.MAX_BILLETES_MOSTRADOR) { decirAviso('info', t('pay.maximo')); return; }
        colocados.push(valor);
        quitarPistas();
        aviso.className = 'aviso';
        aviso.textContent = '';
        EpeVoz.decir(EpeI18n.dineroHablado(valor));
        actualizar();
      }

      function quitar(idx) {
        if (ronda.cerrada || idx < 0 || idx >= colocados.length) return;
        colocados.splice(idx, 1);
        quitarPistas();
        actualizar();
      }

      function pedirAyuda() {
        if (ronda.cerrada) return;
        ronda.ayudas++;
        quitarPistas();
        var a = L.siguienteAyuda(precio, colocados, r.bandeja);
        if (a.accion === 'agregar') {
          if (pilas[a.valor]) pilas[a.valor].classList.add('pista');
          decirAviso('info', t('pay.ayuda.agregar', { valor: EpeI18n.dinero(a.valor) }));
        } else {
          pagarBtn.classList.add('pista');
          var total = L.sumar(colocados);
          decirAviso('info', total > precio ? t('pay.ayuda.listo.vuelto') : t('pay.ayuda.listo'));
        }
      }

      function mostrarVuelto(billetes, monto) {
        EpeDom.vaciar(vueltoEl);
        vueltoEl.appendChild(h('p', { class: 'vuelto-titulo' }, [
          h('span', { texto: t('pay.vuelto.titulo') + ' ' }),
          h('strong', { texto: EpeI18n.dinero(monto) })
        ]));
        vueltoEl.appendChild(h('div', { class: 'vuelto-billetes', 'aria-hidden': 'true' },
          billetes.map(function (v) { return h('span', { class: 'billete-puesto vuelto-billete' }, EpeIconos.dinero(v)); })));
        vueltoEl.hidden = false;
        var texto = t('pay.vuelto', { vuelto: EpeI18n.dinero(monto) });
        decirAviso('ok', texto);
        EpeVoz.decir(t('pay.vuelto.voz', { vuelto: EpeI18n.dineroHablado(monto) }));
      }

      function pagar() {
        if (ronda.cerrada) return;
        var ev = L.evaluarPago(L.sumar(colocados), precio);
        quitarPistas();
        if (ev.estado === 'justo') {
          ronda.cerrada = true;
          zona.classList.add('acierto');
          decirAviso('ok', t('pay.justo'));
          resultados.push({ errores: ronda.errores, ayudas: ronda.ayudas, ms: Date.now() - ronda.t0 });
          app.espera(siguiente, 1800);
        } else if (ev.estado === 'vuelto') {
          // Pagar de más es válido: se cobra y se devuelve la diferencia.
          ronda.cerrada = true;
          zona.classList.add('acierto', 'con-vuelto');
          mostrarVuelto(L.calcularVuelto(L.sumar(colocados), precio), ev.diferencia);
          resultados.push({ errores: ronda.errores, ayudas: ronda.ayudas, ms: Date.now() - ronda.t0 });
          app.espera(siguiente, 5500);
        } else if (ev.estado === 'vacio') {
          decirAviso('info', t('pay.vacio'));
        } else {
          ronda.errores++;
          decirAviso('error', t('pay.falta', { dif: EpeI18n.dinero(ev.diferencia) }));
        }
      }

      var pilasEls = r.bandeja.map(function (v) {
        var b = h('button', {
          class: 'pila', type: 'button', 'data-scan': '', 'data-valor': v, 'data-voz': EpeI18n.dineroHablado(v),
          'aria-label': t('a11y.pila', { valor: EpeI18n.dinero(v) })
        }, EpeIconos.dinero(v));
        EpeArrastre.vincular(b, { valor: v, zona: function () { return zona; }, alSoltar: agregar, alTocar: agregar });
        pilas[v] = b;
        return b;
      });

      var item = h('div', { class: 'producto' }, [
        h('div', { class: 'producto-arte' }, EpeIconos.producto(r.producto.icono)),
        h('div', { class: 'producto-texto' }, [
          h('h2', { class: 'consigna', texto: t('pay.consigna', { item: r.producto.nombre }) }),
          h('p', { class: 'precio' }, [h('span', { class: 'precio-etiqueta', texto: t('pay.precio') }), h('strong', { texto: EpeI18n.dinero(precio) })])
        ])
      ]);

      contenedor.appendChild(EpeComp.barraEjercicio(app, i, rondas.length, function () {
        EpeVoz.decir(t('pay.voz', { item: r.producto.nombre, precio: EpeI18n.dineroHablado(precio) }));
      }));
      contenedor.appendChild(item);
      contenedor.appendChild(zona);
      contenedor.appendChild(h('div', { class: 'billetera' }, [
        h('h3', { class: 'zona-titulo', texto: t('pay.billetera') }),
        h('div', { class: 'pilas n-' + pilasEls.length }, pilasEls)
      ]));
      contenedor.appendChild(h('div', { class: 'acciones' }, [aviso, h('div', { class: 'acciones-botones' }, [sacar, ayuda, pagarBtn])]));

      actualizar();
      EpeVoz.decir(t('pay.voz', { item: r.producto.nombre, precio: EpeI18n.dineroHablado(precio) }));
      app.escanear(function () { return pilasEls.concat([sacar, ayuda, pagarBtn]); });
    }

    function siguiente() {
      i++;
      if (i >= rondas.length) app.ir('resumen', { modulo: 'pagar', resumen: L.resumen(resultados) });
      else mostrar();
    }

    mostrar();
  };
})(window);
