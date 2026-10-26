/* Módulo 5: Cuidarme al pagar. Situaciones de práctica para decidir "¿qué hacés?" y cuidar la clave y la plata.
   Cada situación muestra un dibujo y el texto completo; se elige entre 3 opciones (una segura, una dudosa y una insegura).
   Todo se puede leer: la voz es opcional y solo repite lo que ya está escrito.
   Sin tiempo límite. Si se equivoca se explica por qué y se puede volver a intentar; en los niveles 1 y 2, a los 2 errores se marca lo seguro.
   Al acertar se muestra la regla que se aprendió y se sigue cuando la persona quiere.
   Todo es de práctica: personas, comercios y mensajes son inventados y no se guarda ningún dato. */
(function (root) {
  'use strict';

  var h = EpeDom.h;
  var t = EpeI18n.t;
  var L = EpeDineroLogica;
  root.EpePantallas = root.EpePantallas || {};

  root.EpePantallas.cuidarme = function (app) {
    var cfg = app.config;
    var rondas = EpeCuidarme.generarCuidarme(cfg.nivel, cfg.cantidad);
    var resultados = [];
    var i = 0;
    var contenedor = h('section', { class: 'ej ej-cuidarme nivel-' + cfg.nivel });
    app.pantalla.appendChild(contenedor);

    function mostrar() {
      var r = rondas[i];
      var id = r.escena.id;
      var ronda = { errores: 0, ayudas: 0, t0: Date.now(), cerrada: false, erroresPaso: 0 };
      var voz = '';
      EpeDom.vaciar(contenedor);

      var quien = t('cu.' + id + '.quien');
      var dice = t('cu.' + id + '.dice');
      var instruccion = h('h2', { class: 'instruccion', texto: t('cu.consigna') });
      var hint = h('p', { class: 'sp-hint', texto: t('cu.hint') });
      var aviso = h('p', { class: 'aviso cu-aviso', role: 'status', 'aria-live': 'polite' });
      var acciones = h('div', { class: 'cu-acciones' });

      var escena = h('div', { class: 'cu-escena', role: 'group', 'aria-label': t('cu.situacion') }, [
        h('div', { class: 'cu-dibujo', 'aria-hidden': 'true' }, EpeIconos.escena(r.escena.icono)),
        h('div', { class: 'cu-texto' }, [
          h('p', { class: 'cu-quien', texto: quien }),
          h('p', { class: 'cu-dice', texto: dice })
        ])
      ]);

      voz = t('cu.voz.escena', { quien: quien, dice: dice }) + ' ' + t('cu.consigna');
      EpeVoz.decir(voz);

      function escaneables() { return Array.prototype.slice.call(contenedor.querySelectorAll('[data-scan]')); }

      function decirAviso(tipo, titulo, exp) {
        aviso.className = 'aviso cu-aviso ' + tipo;
        EpeDom.vaciar(aviso);
        aviso.appendChild(h('span', { class: 'cu-aviso-cuerpo' }, [h('strong', { class: 'cu-aviso-titulo', texto: titulo + ' ' }), document.createTextNode(exp)]));
        EpeVoz.decir(titulo + ' ' + exp);
      }

      function tarjetaOpcion(tipo, k) {
        var texto = t('cu.' + id + '.' + tipo);
        var b = h('button', {
          class: 'cu-op', type: 'button', 'data-scan': '', 'data-tipo': tipo,
          'data-voz': t('cu.voz.opcion', { texto: texto }), 'aria-label': texto
        }, [
          h('span', { class: 'cu-op-num', 'aria-hidden': 'true', texto: String(k + 1) }),
          h('span', { class: 'cu-op-txt', texto: texto })
        ]);
        if (tipo === 'bien') b.setAttribute('data-correcta', '');
        b.addEventListener('click', function () {
          if (ronda.cerrada || b.getAttribute('aria-disabled') === 'true') return;
          if (tipo === 'bien') { acertar(b); return; }
          equivocarse(tipo, b);
        });
        return b;
      }

      function equivocarse(tipo, b) {
        ronda.errores++;
        ronda.erroresPaso++;
        b.classList.add('descartada');
        b.setAttribute('aria-disabled', 'true');
        decirAviso('error', t('cu.' + tipo + '.titulo'), t('cu.' + id + '.' + tipo + '.exp'));
        if (r.conPista && ronda.erroresPaso >= 2) {
          ronda.ayudas = 1;
          var c = acciones.querySelector('[data-correcta]');
          if (c) c.classList.add('pista');
        }
        EpeDineroAcceso.reiniciar();
      }

      // Acierto: se muestra la regla y se sigue cuando la persona quiere (sin tiempo).
      function acertar(b) {
        ronda.cerrada = true;
        resultados.push({ errores: ronda.errores, ayudas: ronda.ayudas, ms: Date.now() - ronda.t0 });
        b.classList.add('acierto');
        decirAviso('ok', t('cu.bien.titulo'), t('cu.' + id + '.bien.exp'));
        var regla = r.escena.regla;
        var ultima = i + 1 >= rondas.length;
        EpeDom.vaciar(acciones);
        acciones.classList.add('con-regla');
        acciones.appendChild(h('div', { class: 'cu-regla', role: 'group', 'aria-label': t('cu.regla') }, [
          h('span', { class: 'cu-regla-ico', 'aria-hidden': 'true' }, EpeIconos.regla(regla)),
          h('div', { class: 'cu-regla-txt' }, [
            h('p', { class: 'cu-regla-rotulo', texto: t('cu.regla') }),
            h('p', { class: 'cu-regla-nombre', texto: t('cu.regla.' + regla) }),
            h('p', { class: 'cu-regla-sub', texto: t('cu.regla.' + regla + '.sub') })
          ])
        ]));
        var seguir = h('button', {
          class: 'btn btn-primario cu-seguir', type: 'button', 'data-scan': '',
          'data-voz': t('cu.seguir'), texto: t('cu.seguir'),
          onclick: function () { siguiente(); }
        });
        acciones.appendChild(seguir);
        hint.textContent = '';
        EpeVoz.decir(t('cu.regla.' + regla) + ' ' + t('cu.regla.' + regla + '.sub'));
        EpeDineroAcceso.reiniciar();
        if (!ultima) seguir.focus({ preventScroll: true });
      }

      r.opciones.forEach(function (tipo, k) { acciones.appendChild(tarjetaOpcion(tipo, k)); });

      contenedor.appendChild(EpeComp.barraEjercicio(app, i, rondas.length, function () { EpeVoz.decir(voz); }));
      contenedor.appendChild(escena);
      contenedor.appendChild(h('div', { class: 'instruccion-caja' }, [instruccion, hint]));
      contenedor.appendChild(aviso);
      contenedor.appendChild(acciones);
      app.escanear(escaneables);
    }

    function siguiente() {
      i++;
      if (i >= rondas.length) app.ir('resumen', { modulo: 'cuidarme', resumen: L.resumen(resultados) });
      else mostrar();
    }

    mostrar();
  };
})(window);
