/* Módulo 1: reconocer billetes. Se pide un valor y se toca el billete (o la moneda) correcto.
   Sin tiempo límite. Si se equivoca, esa opción se apaga (queda una menos) y a los 2 errores se marca la correcta. */
(function (root) {
  'use strict';

  var h = EpeDom.h;
  var t = EpeI18n.t;
  var L = EpeDineroLogica;
  root.EpePantallas = root.EpePantallas || {};

  root.EpePantallas.reconocer = function (app) {
    var cfg = app.config;
    var rondas = L.generarReconocer(cfg.nivel, cfg.cantidad);
    var resultados = [];
    var i = 0;
    var ronda = null;
    var contenedor = h('section', { class: 'ej' });
    app.pantalla.appendChild(contenedor);

    function consigna(r, hablada) {
      var tipo = L.esMoneda(r.objetivo) ? 'moneda' : 'billete';
      return t('rec.consigna.' + tipo, { valor: hablada ? EpeI18n.dineroHablado(r.objetivo) : EpeI18n.dinero(r.objetivo) });
    }

    function mostrar() {
      var r = rondas[i];
      ronda = { errores: 0, ayudas: 0, t0: Date.now(), cerrada: false };
      EpeDom.vaciar(contenedor);

      var aviso = h('p', { class: 'aviso', role: 'status', 'aria-live': 'polite' });
      function decirAviso(tipo, texto) {
        aviso.className = 'aviso ' + tipo;
        aviso.textContent = texto;
        EpeVoz.decir(texto);
      }

      var botones = r.opciones.map(function (v) {
        var esMoneda = L.esMoneda(v);
        var b = h('button', {
          class: 'opcion', type: 'button', 'data-scan': '', 'data-valor': v, 'data-voz': EpeI18n.dineroHablado(v),
          'aria-label': t(esMoneda ? 'a11y.moneda' : 'a11y.billete', { valor: EpeI18n.dinero(v) })
        }, EpeIconos.dinero(v));
        b.addEventListener('click', function () { elegir(v, b); });
        return b;
      });

      function elegir(valor, boton) {
        if (ronda.cerrada || boton.getAttribute('aria-disabled') === 'true') return;
        if (valor === r.objetivo) {
          ronda.cerrada = true;
          boton.classList.add('acierto');
          botones.forEach(function (x) { if (x !== boton) x.setAttribute('aria-disabled', 'true'); });
          decirAviso('ok', t('rec.bien'));
          resultados.push({ errores: ronda.errores, ayudas: ronda.ayudas, ms: Date.now() - ronda.t0 });
          app.espera(siguiente, 1500);
        } else {
          ronda.errores++;
          boton.classList.add('descartada');
          boton.setAttribute('aria-disabled', 'true');
          decirAviso('error', t('rec.otra'));
          if (ronda.errores >= 2) {
            ronda.ayudas = 1;
            botones.forEach(function (x) { if (x.getAttribute('data-valor') === String(r.objetivo)) x.classList.add('pista'); });
          }
          EpeDineroAcceso.reiniciar();
        }
      }

      contenedor.appendChild(EpeComp.barraEjercicio(app, i, rondas.length, function () { EpeVoz.decir(consigna(r, true)); }));
      contenedor.appendChild(h('h2', { class: 'consigna', texto: consigna(r, false) }));
      contenedor.appendChild(h('div', { class: 'opciones n-' + r.opciones.length }, botones));
      contenedor.appendChild(aviso);

      EpeVoz.decir(consigna(r, true));
      app.escanear(function () { return botones; });
    }

    function siguiente() {
      i++;
      if (i >= rondas.length) app.ir('resumen', { modulo: 'reconocer', resumen: L.resumen(resultados) });
      else mostrar();
    }

    mostrar();
  };
})(window);
