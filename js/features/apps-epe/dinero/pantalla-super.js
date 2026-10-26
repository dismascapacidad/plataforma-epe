/* Módulo 4: Ir al súper. Aprender la secuencia de una compra, paso a paso (análisis de tareas).
   Nivel 1  ¿Qué sigue?: ya hiciste algunos pasos, elegís el que sigue.
   Nivel 2  Poner los pasos en orden: tocando o arrastrando de a uno.
   Nivel 3  Mini-súper: una lista de 3 productos, leer carteles de pasillo, encontrar el producto en la góndola,
            ponerlo en el changuito y, en la caja, ver cuánto es en total. Después se paga ese total (cada compra con un
            medio distinto: efectivo, débito, QR o transferencia), con los mismos pasos de «¿Cómo pago?».
   Sin tiempo límite. Si se equivoca se explica por qué y se puede volver a intentar; a los 2 errores se marca lo correcto.
   Todo es de práctica: los productos y precios son ejemplos y no se guarda ningún dato. */
(function (root) {
  'use strict';

  var h = EpeDom.h;
  var t = EpeI18n.t;
  var L = EpeDineroLogica;
  var S = EpeSuper;
  root.EpePantallas = root.EpePantallas || {};

  function etiquetaPaso(id) { return t('sp.paso.' + id); }
  function unir(lista) {
    if (lista.length < 2) return lista.join('');
    return lista.slice(0, -1).join(', ') + t('med.y') + lista[lista.length - 1];
  }

  // Tarjeta para elegir (botón). `texto` es lo que lee la voz y el lector de pantalla.
  function tarjeta(clase, icono, etiqueta, extra, voz) {
    return h('button', { class: 'sp-card ' + clase, type: 'button', 'data-scan': '', 'data-voz': voz || etiqueta, 'aria-label': voz || etiqueta }, [
      icono, h('span', { class: 'sp-card-txt', texto: etiqueta }), extra || null
    ]);
  }

  // Paso ya hecho o ya colocado (no se toca).
  function fichaPaso(id, clase) {
    return h('div', { class: 'sp-ficha ' + (clase || '') }, [EpeIconos.paso(id), h('span', { class: 'sp-ficha-txt', texto: etiquetaPaso(id) })]);
  }

  root.EpePantallas.super = function (app) {
    var cfg = app.config;
    var rondas = EpeSuper.generarSuper(cfg.nivel, cfg.cantidad);
    var resultados = [];
    var i = 0;
    var contenedor = h('section', { class: 'ej ej-super nivel-' + cfg.nivel });
    app.pantalla.appendChild(contenedor);

    function mostrar() {
      var r = rondas[i];
      var ronda = { errores: 0, ayudas: 0, t0: Date.now(), cerrada: false, ocupado: false, erroresPaso: 0 };
      var voz = '';   // lo que se lee al tocar "Escuchar"
      EpeDom.vaciar(contenedor);

      var escena = h('div', { class: 'sp-escena' });
      var instruccion = h('h2', { class: 'instruccion' });
      var hint = h('p', { class: 'sp-hint' });
      var aviso = h('p', { class: 'aviso', role: 'status', 'aria-live': 'polite' });
      var acciones = h('div', { class: 'sp-acciones' });

      function decirAviso(tipo, texto) {
        aviso.className = 'aviso ' + tipo;
        aviso.textContent = texto;
        EpeVoz.decir(texto);
      }
      function limpiarAviso() { aviso.className = 'aviso'; aviso.textContent = ''; }

      function escaneables() { return Array.prototype.slice.call(acciones.querySelectorAll('[data-scan]')); }

      function consigna(texto, textoVoz) {
        instruccion.textContent = texto;
        voz = textoVoz || texto;
        EpeVoz.decir(voz);
      }

      // Una equivocación: se explica, se cuenta, y a los 2 seguidos en el mismo paso se marca lo correcto.
      function errorPaso(mensaje, tarjetaMala) {
        ronda.errores++;
        ronda.erroresPaso++;
        if (tarjetaMala) { tarjetaMala.classList.add('descartada'); tarjetaMala.setAttribute('aria-disabled', 'true'); }
        decirAviso('error', mensaje);
        if (ronda.erroresPaso >= 2) {
          ronda.ayudas = 1;
          var c = acciones.querySelector('[data-correcta]');
          if (c) c.classList.add('pista');
        }
        EpeDineroAcceso.reiniciar();
      }

      function terminarRonda(mensaje, ms) {
        ronda.cerrada = true;
        ronda.ocupado = true;
        resultados.push({ errores: ronda.errores, ayudas: ronda.ayudas, ms: Date.now() - ronda.t0 });
        decirAviso('ok', mensaje);
        EpeDom.vaciar(acciones);
        EpeDineroAcceso.reiniciar();
        app.espera(siguiente, ms);
      }

      // La compra sigue en el pago: se abre "¿Cómo pago?" con este total y el medio de esta compra, y después se vuelve.
      function irAPagar() {
        ronda.ocupado = true;
        decirAviso('ok', t('sp.bien.total', { total: EpeI18n.dinero(r.total) }));
        EpeDom.vaciar(acciones);
        EpeDineroAcceso.reiniciar();
        app.espera(function () {
          contenedor.hidden = true;
          EpePantallas.medios(app, {
            ronda: EpeMedios.armarRondaPago(r.total, r.pago),
            i: i,
            n: rondas.length,
            alTerminar: function (res) {
              ronda.errores += res.errores;
              ronda.ayudas += res.ayudas;
              contenedor.hidden = false;
              resultados.push({ errores: ronda.errores, ayudas: ronda.ayudas, ms: Date.now() - ronda.t0 });
              siguiente();
            }
          });
        }, 2200);
      }

      // ---------- Nivel 1: ¿qué sigue? ----------
      function nivel1() {
        var ranura = h('div', { class: 'sp-ficha sp-ranura', 'aria-label': t('sp.siguiente') }, h('span', { class: 'sp-interrogante', 'aria-hidden': 'true', texto: '?' }));
        var tira = h('div', { class: 'sp-tira' });
        r.hechos.forEach(function (id) {
          tira.appendChild(fichaPaso(id, 'hecho'));
          tira.appendChild(h('span', { class: 'sp-flecha', 'aria-hidden': 'true', texto: '→' }));
        });
        tira.appendChild(ranura);
        escena.appendChild(h('p', { class: 'zona-titulo', texto: t('sp.hechos') }));
        escena.appendChild(tira);
        consigna(t('sp.siguiente'), t('sp.voz.pasos', { pasos: unir(r.hechos.map(etiquetaPaso)) }) + ' ' + t('sp.siguiente'));
        hint.textContent = t('sp.hint.elegir');

        var pos = S.PASOS.indexOf(r.correcto);
        r.opciones.forEach(function (id) {
          var b = tarjeta('', EpeIconos.paso(id), etiquetaPaso(id));
          if (id === r.correcto) b.setAttribute('data-correcta', '');
          b.addEventListener('click', function () {
            if (ronda.ocupado || b.getAttribute('aria-disabled') === 'true') return;
            if (id === r.correcto) {
              ronda.ocupado = true;
              b.classList.add('acierto');
              EpeDom.vaciar(ranura);
              ranura.className = 'sp-ficha acierto';
              ranura.appendChild(EpeIconos.paso(id));
              ranura.appendChild(h('span', { class: 'sp-ficha-txt', texto: etiquetaPaso(id) }));
              terminarRonda(t('sp.bien.siguiente', { antes: etiquetaPaso(r.hechos[r.hechos.length - 1]), paso: etiquetaPaso(id) }), 2200);
              return;
            }
            errorPaso(S.PASOS.indexOf(id) < pos ? t('sp.error.ya') : t('sp.error.despues'), b);
          });
          acciones.appendChild(b);
        });
      }

      // ---------- Nivel 2: poner los pasos en orden ----------
      function nivel2() {
        var colocados = [];
        var tira = h('ol', { class: 'sp-slots', 'aria-label': t('sp.ordenar') });
        var slots = r.orden.map(function (id, k) {
          var li = h('li', { class: 'sp-slot' }, h('span', { class: 'sp-slot-num', texto: String(k + 1) }));
          li.setAttribute('aria-label', t('sp.slot', { n: k + 1 }));
          tira.appendChild(li);
          return li;
        });
        escena.appendChild(tira);
        consigna(t('sp.ordenar'));
        hint.textContent = t('sp.hint.ordenar');

        var cartas = {};
        function colocar(id) {
          if (ronda.ocupado || ronda.cerrada) return;
          var esperado = S.proximoCorrecto(r.orden, colocados);
          if (id !== esperado) {
            errorPaso(t('sp.error.orden'), null);
            return;
          }
          var k = colocados.length;
          colocados.push(id);
          var slot = slots[k];
          slot.classList.add('lleno');
          slot.appendChild(fichaPaso(id, 'colocada'));
          var c = cartas[id];
          if (c && c.parentNode) c.parentNode.removeChild(c);
          ronda.erroresPaso = 0;
          limpiarAviso();
          Object.keys(cartas).forEach(function (x) { cartas[x].classList.remove('pista'); cartas[x].removeAttribute('data-correcta'); });
          var sig = S.proximoCorrecto(r.orden, colocados);
          if (sig) { cartas[sig].setAttribute('data-correcta', ''); EpeVoz.decir(etiquetaPaso(id)); EpeDineroAcceso.reiniciar(); }
          else { ronda.ocupado = true; terminarRonda(t('sp.bien.orden'), 2400); }
        }

        r.mezcla.forEach(function (id) {
          var b = tarjeta('arrastrable', EpeIconos.paso(id), etiquetaPaso(id), null, etiquetaPaso(id) + '. ' + t('sp.hint.ordenar'));
          cartas[id] = b;
          EpeArrastre.vincular(b, { valor: id, zona: function () { return tira; }, alSoltar: colocar, alTocar: colocar });
          acciones.appendChild(b);
        });
        cartas[r.orden[0]].setAttribute('data-correcta', '');
      }

      // ---------- Nivel 3: mini-súper ----------
      function nivel3() {
        var k = 0;               // producto de la lista que se está buscando
        var enChanguito = [];    // productos ya puestos
        var fase = 'pasillo';
        var listaEl = h('ul', { class: 'sp-lista' });
        var carroEl = h('div', { class: 'sp-carro-items' });
        var carroTitulo = h('p', { class: 'zona-titulo', texto: t('sp.changuito') });

        var filas = r.lista.map(function (it) {
          var li = h('li', { class: 'sp-lista-item' }, [
            h('span', { class: 'sp-lista-icono', 'aria-hidden': 'true' }, EpeIconos.producto(it.producto.icono)),
            h('span', { class: 'sp-lista-nombre', texto: it.producto.nombre })
          ]);
          listaEl.appendChild(li);
          return li;
        });

        escena.appendChild(h('div', { class: 'sp-card-info sp-lista-card' }, [h('p', { class: 'zona-titulo', texto: t('sp.lista') }), listaEl]));
        escena.appendChild(h('div', { class: 'sp-card-info sp-carro-card' }, [carroTitulo, carroEl]));

        function pintarCarro(conPrecios) {
          EpeDom.vaciar(carroEl);
          if (!enChanguito.length) { carroEl.appendChild(h('p', { class: 'sp-vacio', texto: t('sp.vacio') })); return; }
          enChanguito.forEach(function (p) {
            carroEl.appendChild(h('div', { class: 'sp-carro-item' }, [
              h('span', { class: 'sp-lista-icono', 'aria-hidden': 'true' }, EpeIconos.producto(p.icono)),
              h('span', { class: 'sp-lista-nombre', texto: p.nombre }),
              conPrecios ? h('strong', { class: 'sp-precio', texto: EpeI18n.dinero(p.precio) }) : null
            ]));
          });
        }

        function marcarActual() {
          filas.forEach(function (li, n) {
            li.classList.toggle('actual', n === k);
            li.classList.toggle('hecho', n < k);
          });
        }

        function pintarFase() {
          EpeDom.vaciar(acciones);
          ronda.erroresPaso = 0;
          ronda.ocupado = false;
          limpiarAviso();
          var it = r.lista[k];
          if (fase === 'pasillo') {
            marcarActual();
            pintarCarro(false);
            carroTitulo.textContent = t('sp.changuito');
            consigna(t('sp.busca.pasillo', { producto: it.producto.nombre }));
            hint.textContent = '';
            r.pasillos.forEach(function (pas) {
              var nombre = t('sp.pasillo.' + pas);
              var b = tarjeta('pasillo', EpeIconos.producto(S.ICONO_PASILLO[pas]), nombre, null, t('sp.opcion.pasillo', { pasillo: nombre }));
              if (pas === it.pasillo) b.setAttribute('data-correcta', '');
              b.addEventListener('click', function () {
                if (ronda.ocupado || b.getAttribute('aria-disabled') === 'true') return;
                if (pas === it.pasillo) {
                  b.classList.add('acierto');
                  ronda.ocupado = true;
                  decirAviso('ok', t('sp.bien.pasillo', { pasillo: nombre }));
                  app.espera(function () { fase = 'estante'; pintarFase(); }, 1300);
                  return;
                }
                errorPaso(t('sp.error.pasillo', { pasillo: nombre }), b);
              });
              acciones.appendChild(b);
            });
          } else if (fase === 'estante') {
            consigna(t('sp.busca.estante', { producto: it.producto.nombre }));
            it.estante.forEach(function (id) {
              var p = S.producto(id);
              var b = tarjeta('producto', EpeIconos.producto(p.icono), p.nombre,
                h('span', { class: 'sp-precio', texto: EpeI18n.dinero(p.precio) }), p.nombre + ', ' + EpeI18n.dineroHablado(p.precio));
              if (id === it.producto.id) b.setAttribute('data-correcta', '');
              b.addEventListener('click', function () {
                if (ronda.ocupado || b.getAttribute('aria-disabled') === 'true') return;
                if (id === it.producto.id) {
                  b.classList.add('acierto');
                  ronda.ocupado = true;
                  enChanguito.push(it.producto);
                  pintarCarro(false);
                  k++;
                  marcarActual();
                  decirAviso('ok', t('sp.bien.producto'));
                  app.espera(function () {
                    if (k < r.lista.length) { fase = 'pasillo'; } else { fase = 'caja'; }
                    pintarFase();
                  }, 1400);
                  return;
                }
                errorPaso(t('sp.error.producto', { otro: p.nombre, producto: it.producto.nombre }), b);
              });
              acciones.appendChild(b);
            });
          } else {
            // Caja: se ve cada precio en la cinta y se elige el total.
            carroTitulo.textContent = t('sp.cinta');
            pintarCarro(true);
            consigna(t('sp.busca.total'));
            hint.textContent = '';
            r.opcionesTotal.forEach(function (v) {
              var b = h('button', {
                class: 'sp-card total', type: 'button', 'data-scan': '', 'data-voz': EpeI18n.dineroHablado(v),
                'aria-label': t('sp.opcion.total', { total: EpeI18n.dinero(v) })
              }, h('strong', { class: 'sp-total-num', texto: EpeI18n.dinero(v) }));
              if (v === r.total) b.setAttribute('data-correcta', '');
              b.addEventListener('click', function () {
                if (ronda.ocupado || b.getAttribute('aria-disabled') === 'true') return;
                if (v === r.total) { b.classList.add('acierto'); irAPagar(); return; }
                errorPaso(t('sp.error.total'), b);
              });
              acciones.appendChild(b);
            });
          }
          EpeDineroAcceso.reiniciar();
        }

        pintarFase();
      }

      contenedor.appendChild(EpeComp.barraEjercicio(app, i, rondas.length, function () { EpeVoz.decir(voz); }));
      contenedor.appendChild(escena);
      contenedor.appendChild(h('div', { class: 'instruccion-caja' }, [instruccion, hint]));
      contenedor.appendChild(aviso);
      contenedor.appendChild(acciones);

      if (r.tipo === 'siguiente') nivel1();
      else if (r.tipo === 'ordenar') nivel2();
      else nivel3();
      app.escanear(escaneables);
    }

    function siguiente() {
      i++;
      if (i >= rondas.length) app.ir('resumen', { modulo: 'super', resumen: L.resumen(resultados) });
      else mostrar();
    }

    mostrar();
  };
})(window);
