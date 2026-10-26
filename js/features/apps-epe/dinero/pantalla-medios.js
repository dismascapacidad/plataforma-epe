/* Módulo 3: ¿Cómo pago? Primero se elige el medio según lo que acepta el comercio y lo que la persona lleva.
   Después se practican los pasos del medio elegido (efectivo, débito, QR o transferencia).
   Dos formas de practicar (ajuste "Cuánto hago yo"):
     guiado   un botón por paso, como una guía (cada paso se confirma con un toque)
     gestos   el celular, el posnet y la billetera de la pantalla son la interfaz: se toca el ícono de la app, se escribe la clave
              con un teclado numérico, se arma el alias, se sacan billetes y se cuenta el vuelto
   Sin tiempo límite. Si se equivoca no pasa nada: se explica por qué y se puede volver a intentar. Todo es de práctica:
   la clave es de práctica y no se guarda nada de lo que se escribe.
   También se usa como cierre de la compra de "Ir al súper" (nivel 3): ahí recibe la ronda ya armada (comercio, total y medio fijos),
   no se elige el medio, y al terminar avisa con datos.alTerminar en vez de ir al resumen. */
(function (root) {
  'use strict';

  var h = EpeDom.h;
  var t = EpeI18n.t;
  var L = EpeDineroLogica;
  var M = EpeMedios;
  root.EpePantallas = root.EpePantallas || {};

  function unir(lista) {
    if (lista.length < 2) return lista.join('');
    return lista.slice(0, -1).join(', ') + t('med.y') + lista[lista.length - 1];
  }

  // Para la voz: "almacen punto donpepe".
  function aliasHablado(alias) { return alias.split('.').join(' punto '); }

  // Si existe la variante de texto para el modo gestos (clave terminada en ".g"), se usa esa.
  function textoModo(clave, gestos, vars) {
    if (gestos && t(clave + '.g') !== clave + '.g') return t(clave + '.g', vars);
    return t(clave, vars);
  }

  root.EpePantallas.medios = function (app, datos) {
    var cfg = app.config;
    var gestos = cfg.interaccion === 'gestos';
    var enlace = datos && datos.ronda ? datos : null; // pago que cierra una compra del súper
    var rondas = enlace ? [enlace.ronda] : M.generarMedios(cfg.nivel, cfg.cantidad);
    var resultados = [];
    var i = 0;
    var contenedor = h('section', { class: 'ej ej-medios' });
    app.pantalla.appendChild(contenedor);

    function mostrar() {
      var r = rondas[i];
      var ronda = {
        errores: 0, ayudas: 0, t0: Date.now(), cerrada: false, ocupado: false, gestos: gestos,
        fase: 'elegir', medio: null, flujo: null, paso: 0, erroresElegir: 0, erroresPaso: 0,
        alias: null, rechazados: [], pagado: r.precio
      };
      var objetivosVista = function () { return []; };
      var objetivosAcciones = [];
      var botonesMedio = [];
      var dispositivoEl = null;
      var puntosPin = [];
      EpeDom.vaciar(contenedor);

      var aviso = h('p', { class: 'aviso', role: 'status', 'aria-live': 'polite' });
      function decirAviso(tipo, texto) {
        aviso.className = 'aviso ' + tipo;
        aviso.textContent = texto;
        EpeVoz.decir(texto);
      }
      function limpiarAviso() { aviso.className = 'aviso'; aviso.textContent = ''; }

      // ---------- Cartel del comercio (siempre visible) ----------
      var qrEl = (r.fijo ? r.objetivo === 'qr' : r.acepta.indexOf('qr') !== -1)
        ? h('div', { class: 'qr-cartel' }, [EpeIconos.objeto('qr'), h('span', { texto: t('med.qr.practica') })])
        : null;
      var cartel = h('div', { class: 'cartel', role: 'group', 'aria-label': t('med.cartel') }, [
        h('div', { class: 'cartel-cab' }, [
          h('span', { class: 'cartel-logo' }, EpeIconos.objeto('comercio')),
          h('h3', { class: 'cartel-nombre', texto: r.comercio.nombre })
        ]),
        h('div', { class: 'cartel-producto' }, [
          h('span', { class: 'cartel-arte' }, EpeIconos.producto(r.producto.icono)),
          h('div', { class: 'cartel-datos' }, [
            h('p', { class: 'cartel-consigna', texto: r.fijo ? t('med.consigna.compra') : t('med.consigna', { item: r.producto.nombre }) }),
            h('p', { class: 'cartel-precio' }, [h('span', { class: 'precio-etiqueta', texto: t('med.precio') + ' ' }), h('strong', { texto: EpeI18n.dinero(r.precio) })])
          ])
        ]),
        h('div', { class: 'cartel-acepta' }, [
          h('p', { class: 'zona-titulo', texto: r.fijo ? t('med.cartel.pagas') : t('med.cartel.acepta') }),
          h('ul', { class: 'cartel-chips' }, (r.fijo ? [r.objetivo] : r.acepta).map(function (m) {
            return h('li', { class: 'cartel-chip' }, [EpeIconos.medio(m), h('span', { texto: t('medio.' + m) })]);
          }))
        ]),
        (r.fijo ? r.objetivo === 'transferencia' : r.acepta.indexOf('transferencia') !== -1)
          ? h('p', { class: 'cartel-alias' }, [h('span', { texto: t('med.cartel.alias') + ': ' }), h('strong', { texto: r.comercio.alias })])
          : null,
        r.fijo && r.objetivo === 'debito'
          ? h('p', { class: 'cartel-clave' }, [h('span', { texto: t('med.cartel.clave') + ': ' }), h('strong', { texto: M.PIN_PRACTICA })])
          : null,
        qrEl
      ]);

      var panel = h('div', { class: 'panel' });
      var pasoEl = h('p', { class: 'paso-num' });
      var instruccion = h('h2', { class: 'instruccion' });
      var acciones = h('div', { class: 'medios-acciones' });

      // Lo que recorre el barrido: primero lo que hay en el dispositivo y después los botones de abajo.
      function escaneables() { return objetivosVista().concat(objetivosAcciones); }
      function registrar(lista) { objetivosVista = function () { return []; }; objetivosAcciones = lista; }

      // ---------- Fase 1: elegir el medio ----------
      function situacionHablada() {
        return t('med.voz', {
          item: r.producto.nombre, comercio: r.comercio.nombre, precio: EpeI18n.dineroHablado(r.precio),
          acepta: unir(r.acepta.map(function (m) { return t('medio.' + m + '.voz'); })),
          lleva: unir(r.lleva.map(function (p) { return t('portador.' + p); }))
        });
      }

      function pintarElegir() {
        ronda.fase = 'elegir';
        panel.className = 'panel panel-lleva';
        EpeDom.vaciar(panel);
        panel.appendChild(h('h3', { class: 'zona-titulo', texto: t('med.llevas') }));
        panel.appendChild(h('div', { class: 'lleva-lista' }, r.lleva.map(function (p) {
          return h('div', { class: 'lleva-item' }, [EpeIconos.objeto(p), h('span', { texto: t('portador.' + p) })]);
        })));
        pasoEl.textContent = '';
        instruccion.textContent = t('med.elegi');
        EpeDom.vaciar(acciones);
        acciones.className = 'medios-acciones opciones-medios n-' + r.opciones.length;
        botonesMedio = r.opciones.map(function (m) {
          var b = h('button', {
            class: 'medio-card', type: 'button', 'data-scan': '', 'data-medio': m,
            'data-voz': t('medio.' + m + '.voz'), 'aria-label': t('medio.' + m)
          }, [EpeIconos.medio(m), h('span', { class: 'medio-nombre', texto: t('medio.' + m) })]);
          b.addEventListener('click', function () { elegirMedio(m, b); });
          return b;
        });
        botonesMedio.forEach(function (b) { acciones.appendChild(b); });
        registrar(botonesMedio);
      }

      function elegirMedio(m, b) {
        if (ronda.fase !== 'elegir' || ronda.ocupado || b.getAttribute('aria-disabled') === 'true') return;
        if (r.validos.indexOf(m) !== -1) {
          ronda.medio = m;
          ronda.ocupado = true;
          b.classList.add('acierto');
          botonesMedio.forEach(function (x) { if (x !== b) x.setAttribute('aria-disabled', 'true'); });
          decirAviso('ok', t('med.bien', { medio: t('medio.' + m + '.voz') }));
          app.espera(function () { limpiarAviso(); iniciarFlujo(); }, 1600);
          return;
        }
        ronda.errores++;
        ronda.erroresElegir++;
        b.classList.add('descartada');
        b.setAttribute('aria-disabled', 'true');
        var nombre = t('medio.' + m + '.voz');
        decirAviso('error', M.motivoRechazo(m, r.acepta, r.lleva) === 'no-acepta'
          ? t('med.no-acepta', { medio: nombre })
          : t('med.no-lleva', { medio: nombre, cosa: t('cosa.' + M.PORTADOR[m]) }));
        if (ronda.erroresElegir >= 2) {
          ronda.ayudas = 1;
          botonesMedio.forEach(function (x) { if (r.validos.indexOf(x.getAttribute('data-medio')) !== -1) x.classList.add('pista'); });
        }
        EpeDineroAcceso.reiniciar();
      }

      // ---------- Fase 2: los pasos del medio elegido ----------
      function iniciarFlujo() {
        ronda.fase = 'flujo';
        ronda.flujo = M.FLUJOS[ronda.medio];
        ronda.paso = 0;
        ronda.ocupado = false;
        pintarPaso();
      }

      function esGesto(paso) { return ronda.gestos && !!paso.gesto; }

      function vueltoActual() { return L.calcularVuelto(ronda.pagado, r.precio); }

      function textoPaso(paso, hablado) {
        var vars = { precio: hablado ? EpeI18n.dineroHablado(r.precio) : EpeI18n.dinero(r.precio) };
        if (esGesto(paso) && paso.gesto === 'vuelto' && !vueltoActual().length) return t('f.efectivo.vuelto.nada');
        if (r.fijo && ronda.medio === 'debito' && paso.id === 'clave' && esGesto(paso)) return t('f.debito.clave.titulo.g2');
        return textoModo('f.' + ronda.medio + '.' + paso.id + '.titulo', esGesto(paso), vars);
      }

      function pintarPaso() {
        var paso = ronda.flujo[ronda.paso];
        ronda.erroresPaso = 0;
        ronda.ocupado = false;
        limpiarAviso();
        pasoEl.textContent = t('med.paso', { n: ronda.paso + 1, total: ronda.flujo.length });
        instruccion.textContent = textoPaso(paso, false);
        pintarDispositivo(paso);
        pintarAcciones(paso);
        EpeVoz.decir(textoPaso(paso, true));
        EpeDineroAcceso.reiniciar();
      }

      function avanzarPaso() {
        if (ronda.cerrada || ronda.ocupado) return;
        if (ronda.paso >= ronda.flujo.length - 1) { terminar(); return; }
        ronda.paso++;
        pintarPaso();
      }

      // Avanza después de mostrar un mensaje un momento.
      function avanzarLuego(ms) {
        ronda.ocupado = true;
        app.espera(function () { ronda.ocupado = false; avanzarPaso(); }, ms);
      }

      // Una equivocación en un paso: se explica, se cuenta y a los 2 errores se marca lo correcto.
      function errorPaso(mensaje) {
        ronda.errores++;
        ronda.erroresPaso++;
        decirAviso('error', mensaje);
        if (ronda.erroresPaso >= 2) {
          ronda.ayudas = 1;
          var correctos = contenedor.querySelectorAll('[data-correcta]');
          for (var k = 0; k < correctos.length; k++) correctos[k].classList.add('pista');
        }
        EpeDineroAcceso.reiniciar();
      }

      function terminar() {
        ronda.cerrada = true;
        ronda.ocupado = true;
        cartel.classList.add('acierto');
        panel.className = 'panel panel-dispositivo';
        EpeDom.vaciar(panel);
        dispositivoEl = h('div', { class: 'dispositivo vendedor feliz' }, [
          h('div', { class: 'vendedor-arte' }, EpeIconos.objeto('vendedor')),
          h('p', { class: 'burbuja', texto: t('d.vendedor.gracias.' + ronda.medio) })
        ]);
        panel.appendChild(dispositivoEl);
        EpeDom.vaciar(acciones);
        acciones.className = 'medios-acciones';
        registrar([]);
        pasoEl.textContent = '';
        instruccion.textContent = '';
        decirAviso('ok', t('med.listo', { medio: t('medio.' + ronda.medio + '.voz') }));
        resultados.push({ errores: ronda.errores, ayudas: ronda.ayudas, ms: Date.now() - ronda.t0 });
        EpeDineroAcceso.reiniciar();
        app.espera(siguiente, 3400);
      }

      // ---------- Piezas del dispositivo ----------
      function fila(etiqueta, valor) {
        return h('div', { class: 'cel-fila' }, [h('span', { class: 'cel-etq', texto: etiqueta }), h('strong', { class: 'cel-val', texto: valor })]);
      }

      function celular(hijos, conBarra, extra) {
        return {
          variante: 'celular' + (extra ? ' ' + extra : ''),
          hijos: [
            conBarra === false ? null : h('div', { class: 'cel-barra', texto: t('d.cel.app') }),
            h('div', { class: 'cel-cuerpo' }, hijos),
            h('p', { class: 'cel-pie', texto: t('d.cel.practica') })
          ]
        };
      }

      function vendedor(texto) {
        return { variante: 'vendedor', hijos: [h('div', { class: 'vendedor-arte' }, EpeIconos.objeto('vendedor')), h('p', { class: 'burbuja', texto: texto })] };
      }

      function teclasDecorativas() {
        return h('div', { class: 'posnet-teclas', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function () { return h('span'); }));
      }

      function posnet(lineas, extra) {
        return { variante: 'posnet', hijos: [h('div', { class: 'posnet-pantalla' }, lineas), extra || null, teclasDecorativas()] };
      }

      // Botón del dispositivo (se toca, o el barrido lo elige). `correcta` lo marca para la ayuda.
      function botonDisp(clase, hijos, voz, alClic, correcta) {
        var b = h('button', { class: clase, type: 'button', 'data-scan': '', 'data-voz': voz, 'aria-label': voz }, hijos);
        if (correcta) b.setAttribute('data-correcta', '');
        b.addEventListener('click', alClic);
        return b;
      }

      // Botón de texto dentro de la pantalla del celular.
      function botonCel(texto, alClic, correcta, secundario) {
        return botonDisp('cel-boton' + (secundario ? ' sec' : ''), [h('span', { texto: texto })], texto, alClic, correcta);
      }

      // Teclado numérico: 1 al 9, Borrar, 0 y OK. Con barrido, solo se recorre la tecla que sigue (y Borrar/OK), y se la marca.
      function crearTeclado(opts) {
        var teclas = {};
        function tecla(clave, texto, voz, clase) {
          var b = h('button', { class: 'tecla ' + (clase || ''), type: 'button', 'data-scan': '', 'data-voz': voz, 'aria-label': voz }, h('span', { texto: texto }));
          b.addEventListener('click', function () { opts.alPulsar(clave); });
          teclas[clave] = b;
          return b;
        }
        var orden = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(function (d) { return tecla(d, d, d); });
        orden.push(tecla('borrar', '⌫', t('d.tec.borrar'), 'accion'), tecla('0', '0', '0'), tecla('ok', 'OK', t('d.tec.ok'), 'ok'));
        var el = h('div', { class: 'teclado', role: 'group', 'aria-label': t('d.tec.grupo') }, orden);

        function actualizar(ingresado, completo) {
          teclas.ok.disabled = !completo;
          Object.keys(teclas).forEach(function (k) { teclas[k].classList.remove('guia'); });
          if (EpeDineroAcceso.esEscaneo()) {
            var sig = M.siguienteTecla(opts.objetivo, ingresado);
            if (sig && teclas[sig]) teclas[sig].classList.add('guia');
            if (sig === null) teclas.ok.classList.add('guia');
          }
        }

        function escaneables() {
          if (!EpeDineroAcceso.esEscaneo()) return orden;
          var sig = M.siguienteTecla(opts.objetivo, opts.leer());
          var lista = [];
          if (sig === null) lista.push(teclas.ok);
          else if (sig !== 'borrar') lista.push(teclas[sig]);
          if (opts.leer().length) lista.push(teclas.borrar);
          return lista;
        }

        return { el: el, teclas: teclas, actualizar: actualizar, escaneables: escaneables };
      }

      // ---------- Lo que se ve en el "dispositivo" (celular, posnet, vendedor...) ----------
      function vista(paso) {
        var g = esGesto(paso);
        var disp = [];   // lo que el barrido puede elegir dentro del dispositivo
        var titularApp = ronda.alias ? M.titularDeAlias(ronda.alias) : '';
        objetivosVista = function () { return disp; };

        switch (paso.vista) {
          case 'ef-billetes': {
            if (!g) {
              return {
                variante: 'billetera',
                hijos: [
                  h('p', { class: 'zona-titulo', texto: t('d.ef.pagar') }),
                  h('p', { class: 'ef-precio', texto: EpeI18n.dinero(r.precio) }),
                  h('div', { class: 'mini-billetes', 'aria-hidden': 'true' }, L.descomponer(r.precio, [20000, 10000, 2000, 1000, 500, 200, 100]).map(function (v) {
                    return h('span', { class: 'mini-billete' }, EpeIconos.dinero(v));
                  }))
                ]
              };
            }
            // Gestos: se sacan billetes de la billetera hasta que alcance.
            var sacado = 0;
            var totalEl = h('p', { class: 'ef-sacaste', texto: t('g.ef.sacaste', { total: EpeI18n.dinero(0) }) });
            var billetes = r.billetera.billetes.map(function (v) {
              var b = botonDisp('billete-btn', EpeIconos.dinero(v), EpeI18n.dineroHablado(v), function () {
                if (ronda.ocupado || b.getAttribute('aria-disabled') === 'true') return;
                b.setAttribute('aria-disabled', 'true');
                b.classList.add('sacado');
                sacado += v;
                totalEl.textContent = t('g.ef.sacaste', { total: EpeI18n.dinero(sacado) });
                if (sacado >= r.precio) {
                  ronda.pagado = sacado;
                  decirAviso('ok', sacado > r.precio ? t('g.ef.alcanza', { total: EpeI18n.dinero(sacado) }) : t('g.ef.justo', { total: EpeI18n.dinero(sacado) }));
                  avanzarLuego(1700);
                } else {
                  EpeVoz.decir(EpeI18n.dineroHablado(v));
                  EpeDineroAcceso.reiniciar();
                }
              });
              disp.push(b);
              return b;
            });
            return {
              variante: 'billetera',
              hijos: [
                h('p', { class: 'zona-titulo', texto: t('d.ef.pagar') }),
                h('p', { class: 'ef-precio', texto: EpeI18n.dinero(r.precio) }),
                totalEl,
                h('div', { class: 'billetes-fila', role: 'group', 'aria-label': t('pay.billetera') }, billetes)
              ]
            };
          }
          case 'ef-vendedor': return vendedor(t('d.vendedor.entregar'));
          case 'ef-vuelto': {
            if (!g) return { variante: 'billetera', hijos: [h('div', { class: 'ef-icono' }, EpeIconos.objeto('billetes')), h('p', { class: 'ef-texto', texto: t('d.ef.vuelto') })] };
            var vuelto = vueltoActual();
            if (!vuelto.length) {
              var seguir = botonDisp('cel-boton', [h('span', { texto: t('g.seguir') })], t('g.seguir'), function () { avanzarPaso(); }, true);
              disp.push(seguir);
              return { variante: 'billetera', hijos: [h('div', { class: 'ef-icono' }, EpeIconos.objeto('billetes')), h('p', { class: 'ef-texto', texto: t('d.ef.sin-vuelto') }), seguir] };
            }
            var contado = 0;
            var montoVuelto = L.sumar(vuelto);
            var contadoEl = h('p', { class: 'ef-sacaste', texto: t('g.ef.contaste', { total: EpeI18n.dinero(0), vuelto: EpeI18n.dinero(montoVuelto) }) });
            var pendientes = vuelto.length;
            var billetesV = vuelto.map(function (v) {
              var b = botonDisp('billete-btn', EpeIconos.dinero(v), EpeI18n.dineroHablado(v), function () {
                if (ronda.ocupado || b.getAttribute('aria-disabled') === 'true') return;
                b.setAttribute('aria-disabled', 'true');
                b.classList.add('sacado');
                contado += v;
                pendientes--;
                contadoEl.textContent = t('g.ef.contaste', { total: EpeI18n.dinero(contado), vuelto: EpeI18n.dinero(montoVuelto) });
                if (!pendientes) { decirAviso('ok', t('g.ef.vuelto-ok', { vuelto: EpeI18n.dinero(montoVuelto) })); avanzarLuego(1700); }
                else { EpeVoz.decir(EpeI18n.dineroHablado(v)); EpeDineroAcceso.reiniciar(); }
              });
              disp.push(b);
              return b;
            });
            return {
              variante: 'billetera',
              hijos: [h('p', { class: 'zona-titulo', texto: t('g.ef.tu-vuelto') }), contadoEl, h('div', { class: 'billetes-fila', role: 'group' }, billetesV)]
            };
          }
          case 'ticket': {
            if (!g) {
              return {
                variante: 'ticket',
                hijos: [h('div', { class: 'ticket-arte' }, EpeIconos.objeto('ticket')), h('div', { class: 'ticket-datos' }, [
                  h('p', { class: 'zona-titulo', texto: t('d.ticket') }), h('p', { class: 'ticket-linea', texto: r.comercio.nombre }), h('p', { class: 'ticket-linea', texto: EpeI18n.dinero(r.precio) })
                ])]
              };
            }
            var tk = botonDisp('ticket-btn', [h('div', { class: 'ticket-arte' }, EpeIconos.objeto('ticket')), h('div', { class: 'ticket-datos' }, [
              h('p', { class: 'zona-titulo', texto: t('d.ticket') }), h('p', { class: 'ticket-linea', texto: r.comercio.nombre }), h('p', { class: 'ticket-linea', texto: EpeI18n.dinero(r.precio) })
            ])], t('f.efectivo.ticket.btn'), function () { avanzarPaso(); }, true);
            disp.push(tk);
            return { variante: 'ticket', hijos: [tk] };
          }
          case 'vendedor-pregunta': return vendedor(t('d.vendedor.pregunta'));
          case 'posnet-total':
            return posnet([h('p', { class: 'posnet-etq', texto: t('d.posnet.total') }), h('p', { class: 'posnet-monto', texto: EpeI18n.dinero(r.precio) }), h('p', { class: 'posnet-msg', texto: t('d.posnet.acercar') })]);
          case 'posnet-clave': {
            puntosPin = [0, 1, 2, 3].map(function () { return h('span', { class: 'pin-punto' }); });
            if (!g) {
              return {
                variante: 'posnet',
                hijos: [
                  h('div', { class: 'posnet-pantalla' }, [h('p', { class: 'posnet-msg', texto: t('d.posnet.clave') }), h('div', { class: 'pin', 'aria-hidden': 'true' }, puntosPin), h('p', { class: 'posnet-chico', texto: t('d.posnet.clave.aviso') })]),
                  teclasDecorativas()
                ]
              };
            }
            // Gestos: teclado numérico real. La clave es la de práctica, la que se ve al empezar.
            var clave = '';
            var msg = h('p', { class: 'posnet-chico', texto: t('d.posnet.clave.aviso') });
            var teclado = crearTeclado({ objetivo: M.PIN_PRACTICA, leer: function () { return clave; }, alPulsar: pulsar });
            function pintarClave() {
              puntosPin.forEach(function (p, k) { p.classList.toggle('lleno', k < clave.length); });
              teclado.actualizar(clave, clave.length === 4);
              EpeDineroAcceso.reiniciar();
            }
            function pulsar(k) {
              if (ronda.ocupado) return;
              if (k === 'borrar') { clave = clave.slice(0, -1); msg.textContent = t('d.posnet.clave.aviso'); pintarClave(); return; }
              if (k === 'ok') {
                if (clave.length < 4) return;
                if (clave === M.PIN_PRACTICA) {
                  msg.textContent = t('g.clave.ok');
                  msg.classList.add('bien');
                  ronda.ocupado = true;
                  puntosPin.forEach(function (p) { p.classList.add('bien'); });
                  avanzarLuego(900);
                  ronda.ocupado = true;
                  return;
                }
                ronda.ocupado = true;
                msg.textContent = t('g.error.clave');
                msg.classList.add('mal');
                puntosPin.forEach(function (p) { p.classList.add('mal'); });
                ronda.errores++;
                ronda.erroresPaso++;
                decirAviso('error', t('g.error.clave'));
                app.espera(function () {
                  clave = '';
                  ronda.ocupado = false;
                  msg.textContent = t('d.posnet.clave.aviso');
                  msg.classList.remove('mal');
                  puntosPin.forEach(function (p) { p.classList.remove('mal'); });
                  limpiarAviso();
                  if (ronda.erroresPaso >= 2) mostrarClave();
                  pintarClave();
                }, 1200);
                return;
              }
              if (clave.length < 4) { clave += k; pintarClave(); }
            }
            objetivosVista = function () { return teclado.escaneables(); };
            teclado.actualizar('', false);
            return {
              variante: 'posnet con-teclado',
              hijos: [h('div', { class: 'posnet-pantalla' }, [h('p', { class: 'posnet-msg', texto: t('d.posnet.clave') }), h('div', { class: 'pin', 'aria-hidden': 'true' }, puntosPin), msg]), teclado.el]
            };
          }
          case 'posnet-espera':
            return posnet([h('p', { class: 'posnet-msg', texto: t('d.posnet.espera') }), h('div', { class: 'barra-espera', 'aria-hidden': 'true' }, h('span'))]);
          case 'posnet-ok': {
            if (!g) return posnet([h('p', { class: 'posnet-ok', texto: '✓ ' + t('d.posnet.ok') }), h('p', { class: 'posnet-msg', texto: t('d.posnet.retirar') })]);
            var tarjeta = botonDisp('tarjeta-saliente', [EpeIconos.objeto('tarjeta'), h('span', { texto: t('d.posnet.tarjeta') })], t('d.posnet.tarjeta'), function () { avanzarPaso(); }, true);
            disp.push(tarjeta);
            return {
              variante: 'posnet',
              hijos: [h('div', { class: 'posnet-pantalla' }, [h('p', { class: 'posnet-ok', texto: '✓ ' + t('d.posnet.ok') }), h('p', { class: 'posnet-msg', texto: t('d.posnet.retirar') })]), tarjeta]
            };
          }
          case 'cel-inicio': {
            if (!g) {
              return celular([h('div', { class: 'cel-inicio' }, [
                h('span', { class: 'cel-tile gris' }), h('span', { class: 'cel-tile gris' }), h('span', { class: 'cel-tile gris' }),
                h('span', { class: 'cel-tile app resaltar' }, [h('span', { class: 'cel-app-logo', texto: 'MB' }), h('span', { class: 'cel-tile-txt', texto: t('d.cel.app') })])
              ])], false);
            }
            var tiles = ['mensajes', 'fotos', 'reloj'].map(function (k) {
              return botonDisp('cel-tile gris', [h('span', { class: 'cel-app-logo gris', texto: t('d.cel.' + k).charAt(0) }), h('span', { class: 'cel-tile-txt', texto: t('d.cel.' + k) })], t('d.cel.' + k), function () { errorPaso(t('g.error.app')); }, false);
            });
            var app2 = botonDisp('cel-tile app', [h('span', { class: 'cel-app-logo', texto: 'MB' }), h('span', { class: 'cel-tile-txt', texto: t('d.cel.app') })], t('d.cel.app'), function () { avanzarPaso(); }, true);
            var orden = [tiles[0], tiles[1], app2, tiles[2]];
            orden.forEach(function (b2) { disp.push(b2); });
            return celular([h('div', { class: 'cel-inicio' }, orden)], false);
          }
          case 'app-menu': {
            var items = [
              { k: 'transferencia', icono: 'transferir', txt: 'd.menu.transferir' }, { k: 'qr', icono: 'qr', txt: 'd.menu.qr' },
              { k: 'cuentas', icono: 'billetes', txt: 'd.menu.cuentas' }, { k: 'tarjetas', icono: 'tarjeta', txt: 'd.menu.tarjetas' }
            ];
            if (!g) {
              return celular([h('div', { class: 'cel-menu' }, items.map(function (it) {
                return h('span', { class: 'cel-tile' + (paso.destacar === it.k ? ' resaltar' : '') }, [EpeIconos.objeto(it.icono), h('span', { class: 'cel-tile-txt', texto: t(it.txt) })]);
              }))]);
            }
            var botones = items.map(function (it) {
              var b = botonDisp('cel-tile', [EpeIconos.objeto(it.icono), h('span', { class: 'cel-tile-txt', texto: t(it.txt) })], t(it.txt), function () {
                if (it.k === paso.destacar) avanzarPaso();
                else errorPaso(t('g.error.menu', { opcion: t('d.menu.' + (paso.destacar === 'qr' ? 'qr' : 'transferir')) }));
              }, it.k === paso.destacar);
              disp.push(b);
              return b;
            });
            return celular([h('div', { class: 'cel-menu' }, botones)]);
          }
          case 'cel-camara':
            return celular([h('div', { class: 'cel-camara' }, [h('div', { class: 'cel-visor' }), h('p', { class: 'cel-msg', texto: t('d.camara') })])]);
          case 'qr-datos': {
            var datos = [fila(t('d.qr.comercio'), r.comercio.nombre), fila(t('d.qr.monto'), EpeI18n.dinero(r.precio))];
            if (!(g && paso.id === 'confirmar')) return celular(datos);
            var pagar = botonCel(t('d.qr.pagar'), function () { avanzarPaso(); }, true);
            var cancelar = botonCel(t('d.cancelar'), function () { errorPaso(t('g.error.cancelar', { opcion: t('d.qr.pagar') })); }, false, true);
            disp.push(pagar, cancelar);
            return celular(datos.concat([h('div', { class: 'cel-botones' }, [cancelar, pagar])]));
          }
          case 'tr-alias': {
            if (!g) return celular([h('p', { class: 'cel-etq', texto: t('d.tr.alias') }), h('div', { class: 'cel-campo vacio', texto: t('d.tr.alias.vacio') })]);
            return celular([h('p', { class: 'cel-etq', texto: t('d.tr.alias') }), h('div', { class: 'cel-campo vacio', id: 'campo-alias', texto: t('d.tr.alias.vacio') })]);
          }
          case 'tr-verificar':
            return celular([h('p', { class: 'cel-etq', texto: t('d.tr.verif') }), fila(t('med.cartel.alias'), ronda.alias || ''), fila(t('d.tr.titular'), titularApp || '')]);
          case 'tr-importe': {
            if (!g) return celular([fila(t('d.tr.titular'), titularApp || ''), h('p', { class: 'cel-etq', texto: t('d.tr.importe') }), h('div', { class: 'cel-campo vacio', texto: t('d.tr.importe.vacio') })]);
            var digitos = '';
            var campo = h('div', { class: 'cel-campo vacio', texto: t('d.tr.importe.vacio') });
            var tec = crearTeclado({ objetivo: String(r.precio), leer: function () { return digitos; }, alPulsar: pulsarImporte });
            function pintarImporte() {
              campo.textContent = digitos ? EpeI18n.dinero(Number(digitos)) : t('d.tr.importe.vacio');
              campo.classList.toggle('vacio', !digitos);
              tec.actualizar(digitos, digitos.length > 0);
              EpeDineroAcceso.reiniciar();
            }
            function pulsarImporte(k) {
              if (ronda.ocupado) return;
              if (k === 'borrar') { digitos = digitos.slice(0, -1); pintarImporte(); return; }
              if (k === 'ok') {
                if (!digitos) return;
                if (Number(digitos) === r.precio) { ronda.ocupado = false; avanzarLuego(500); return; }
                digitos = '';
                errorPaso(t('paso.error.importe', { precio: EpeI18n.dinero(r.precio) }));
                pintarImporte();
                return;
              }
              if (digitos.length < 6 && !(digitos === '' && k === '0')) { digitos += k; pintarImporte(); }
            }
            objetivosVista = function () { return tec.escaneables(); };
            tec.actualizar('', false);
            return celular([fila(t('d.tr.titular'), titularApp || ''), h('p', { class: 'cel-etq', texto: t('d.tr.importe') }), campo, tec.el], true, 'con-teclado');
          }
          case 'tr-resumen': {
            var resumen = [h('p', { class: 'cel-etq', texto: t('d.tr.resumen') }), h('p', { class: 'cel-grande', texto: EpeI18n.dinero(r.precio) }), fila(t('d.tr.a'), titularApp || r.comercio.nombre), fila(t('med.cartel.alias'), ronda.alias || r.comercio.alias)];
            if (!g) return celular(resumen);
            var confirmar = botonCel(t('d.tr.confirmar'), function () { avanzarPaso(); }, true);
            var cancelar2 = botonCel(t('d.cancelar'), function () { errorPaso(t('g.error.cancelar', { opcion: t('d.tr.confirmar') })); }, false, true);
            disp.push(confirmar, cancelar2);
            return celular(resumen.concat([h('div', { class: 'cel-botones' }, [cancelar2, confirmar])]));
          }
          case 'comprobante': {
            var comp = [
              h('div', { class: 'cel-ok', 'aria-hidden': 'true', texto: '✓' }),
              h('p', { class: 'cel-titulo', texto: t(ronda.medio === 'qr' ? 'd.comp.qr' : 'd.comp.tr') }),
              fila(t('d.comp.monto'), EpeI18n.dinero(r.precio)),
              fila(t('d.comp.para'), r.comercio.nombre)
            ];
            if (!g) return celular(comp, true);
            var mostrarBtn = botonCel(t('d.comp.mostrar'), function () { avanzarPaso(); }, true);
            var cerrar = botonCel(t('d.comp.cerrar'), function () { errorPaso(t('g.error.cerrar', { opcion: t('d.comp.mostrar') })); }, false, true);
            disp.push(mostrarBtn, cerrar);
            return celular(comp.concat([h('div', { class: 'cel-botones' }, [cerrar, mostrarBtn])]), true);
          }
          default:
            return vendedor('');
        }
      }

      function pintarDispositivo(paso) {
        var v = vista(paso);
        panel.className = 'panel panel-dispositivo';
        EpeDom.vaciar(panel);
        dispositivoEl = h('div', { class: 'dispositivo ' + v.variante }, v.hijos);
        panel.appendChild(dispositivoEl);
      }

      // En el posnet: recordar cuál es la clave de práctica (cuenta como ayuda).
      function mostrarClave() {
        ronda.ayudas = 1;
        decirAviso('info', t('g.clave.hint', { clave: M.PIN_PRACTICA.split('').join(' ') }));
      }

      // ---------- Los botones de cada paso ----------
      function boton(texto, clase, voz, alClic) {
        var b = h('button', { class: clase, type: 'button', 'data-scan': '', 'data-voz': voz || texto, texto: texto });
        b.addEventListener('click', alClic);
        return b;
      }

      function textoBtn(paso) { return t('f.' + ronda.medio + '.' + paso.id + '.btn'); }

      // Cuando el alias se arma en dos partes.
      function accionesPartes() {
        var sel = { primera: null, segunda: null };
        var botonesP = { primera: [], segunda: [] };
        var buscar = boton(t('g.buscar'), 'btn btn-primario', null, function () { buscarAlias(); });
        buscar.disabled = true;
        var campo = function () { return document.getElementById('campo-alias'); };

        function pintarCampo() {
          var c = campo();
          if (c) {
            c.textContent = (sel.primera || '…') + '.' + (sel.segunda || '…');
            c.classList.toggle('vacio', !sel.primera && !sel.segunda);
          }
          buscar.disabled = !(sel.primera && sel.segunda);
        }

        function grupoPartes(clave, opciones) {
          botonesP[clave] = opciones.map(function (valor) {
            var b = h('button', {
              class: 'opcion-texto parte', type: 'button', 'data-scan': '', 'aria-pressed': 'false', 'data-voz': valor,
              'aria-label': t('d.partes.' + clave) + ': ' + valor
            }, h('strong', { texto: valor }));
            b.addEventListener('click', function () {
              if (ronda.ocupado) return;
              sel[clave] = valor;
              botonesP[clave].forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
              pintarCampo();
              EpeVoz.decir(valor);
            });
            return b;
          });
          return h('div', { class: 'parte-grupo' }, [h('p', { class: 'zona-titulo', texto: t('d.partes.' + clave) }), h('div', { class: 'parte-fila' }, botonesP[clave])]);
        }

        function buscarAlias() {
          if (ronda.ocupado || !(sel.primera && sel.segunda)) return;
          var res = M.resolverAlias(sel.primera, sel.segunda);
          if (!res.existe) { limpiarSel(); errorPaso(t('g.error.alias-no')); return; }
          if (ronda.rechazados.indexOf(res.alias) !== -1) { limpiarSel(); errorPaso(t('g.error.alias-ya')); return; }
          ronda.alias = res.alias;
          // Si es de otro comercio no se avisa acá: es justo lo que hay que descubrir al verificar el nombre.
          if (res.alias !== r.comercio.alias) ronda.errores++;
          avanzarPaso();
        }

        function limpiarSel() {
          sel.primera = null; sel.segunda = null;
          botonesP.primera.concat(botonesP.segunda).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          pintarCampo();
        }

        var contenido = [grupoPartes('primera', r.aliasPartes.primeras), grupoPartes('segunda', r.aliasPartes.segundas)];
        var lista = botonesP.primera.concat(botonesP.segunda, [buscar]);
        return { contenido: contenido.concat([buscar]), lista: lista };
      }

      function pintarAcciones(paso) {
        EpeDom.vaciar(acciones);
        acciones.className = 'medios-acciones';
        var lista = [];
        var extra = null;
        var g = esGesto(paso);

        if (g && paso.gesto === 'frases') {
          acciones.className = 'medios-acciones opciones-texto n-3';
          lista = r.frases.map(function (m) {
            var bt = h('button', { class: 'opcion-texto', type: 'button', 'data-scan': '', 'data-voz': t('frase.' + m) }, h('strong', { texto: t('frase.' + m) }));
            if (m === ronda.medio) bt.setAttribute('data-correcta', '');
            bt.addEventListener('click', function () {
              if (ronda.ocupado || bt.getAttribute('aria-disabled') === 'true') return;
              if (m === ronda.medio) { bt.classList.add('acierto'); decirAviso('ok', t('frase.' + m) + '.'); avanzarLuego(1100); return; }
              bt.setAttribute('aria-disabled', 'true');
              bt.classList.add('descartada');
              errorPaso(t('g.error.frase', { frase: t('frase.' + ronda.medio) }));
            });
            return bt;
          });
        } else if (g && paso.gesto === 'clave') {
          lista = [boton(t('g.clave.ver'), 'btn btn-secundario', null, mostrarClave)];
        } else if (g && paso.gesto === 'partes') {
          acciones.className = 'medios-acciones partes';
          var pp = accionesPartes();
          pp.contenido.forEach(function (el) { acciones.appendChild(el); });
          registrarAcciones(pp.lista);
          return;
        } else if (g) {
          lista = [];   // el paso se hace tocando el dispositivo
        } else if (paso.tipo === 'tocar') {
          lista = [boton(textoBtn(paso), 'btn btn-primario btn-grande', null, function () { alTocarPaso(paso); })];
        } else if (paso.tipo === 'arrastrar') {
          var etiqueta = textoBtn(paso);
          var b = h('button', {
            class: 'objeto-arrastrable', type: 'button', 'data-scan': '', 'data-voz': etiqueta,
            'aria-label': etiqueta + '. ' + t('med.arrastrar')
          }, [EpeIconos.objeto(paso.objeto), h('span', { class: 'objeto-txt', texto: etiqueta })]);
          EpeArrastre.vincular(b, {
            valor: paso.id,
            zona: function () { return paso.zona === 'qr' ? qrEl : dispositivoEl; },
            alSoltar: function () { alArrastrar(paso); }, alTocar: function () { alArrastrar(paso); }
          });
          lista = [b];
          extra = h('p', { class: 'hint-arrastre', texto: t('med.arrastrar') });
        } else if (paso.tipo === 'espera') {
          registrar([]);
          app.espera(avanzarPaso, paso.ms);
          return;
        } else if (paso.tipo === 'sino') {
          acciones.className = 'medios-acciones dos';
          var sufijo = paso.sino === 'verificar' ? '.ver' : '';
          lista = ['si', 'no'].map(function (k) {
            var tx = t('paso.sino.' + k + sufijo);
            var bt = boton(tx, 'btn btn-secundario btn-grande', null, function () { elegirSino(paso, k, bt); });
            return bt;
          });
        } else if (paso.tipo === 'alias') {
          acciones.className = 'medios-acciones opciones-texto n-3';
          lista = r.aliasOpciones.map(function (a) {
            var bt = h('button', {
              class: 'opcion-texto', type: 'button', 'data-scan': '', 'data-voz': aliasHablado(a.alias),
              'aria-label': t('paso.alias.opcion', { alias: aliasHablado(a.alias) })
            }, h('strong', { texto: a.alias }));
            if (ronda.rechazados.indexOf(a.alias) !== -1) { bt.setAttribute('aria-disabled', 'true'); bt.classList.add('descartada'); }
            bt.addEventListener('click', function () { elegirAlias(a); });
            return bt;
          });
        } else if (paso.tipo === 'importe') {
          acciones.className = 'medios-acciones opciones-texto n-' + r.importeOpciones.length;
          lista = r.importeOpciones.map(function (v) {
            var bt = h('button', {
              class: 'opcion-texto', type: 'button', 'data-scan': '', 'data-valor': v, 'data-voz': EpeI18n.dineroHablado(v),
              'aria-label': t('paso.importe.opcion', { importe: EpeI18n.dinero(v) })
            }, h('strong', { texto: EpeI18n.dinero(v) }));
            bt.addEventListener('click', function () { elegirImporte(v, bt); });
            return bt;
          });
        }

        lista.forEach(function (b2) { acciones.appendChild(b2); });
        if (extra) acciones.appendChild(extra);
        registrarAcciones(lista);
      }

      // Los botones de abajo se suman a lo que ya registró el dispositivo.
      function registrarAcciones(lista) { objetivosAcciones = lista; }

      // El QR se lee antes de seguir: el visor se pone verde un momento.
      function alArrastrar(paso) {
        if (ronda.ocupado) return;
        if (paso.id === 'escanear') {
          var visor = dispositivoEl && dispositivoEl.querySelector('.cel-visor');
          var msg = dispositivoEl && dispositivoEl.querySelector('.cel-msg');
          if (visor) visor.classList.add('leido');
          if (msg) msg.textContent = t('d.camara.leido');
          EpeVoz.decir(t('d.camara.leido'));
          avanzarLuego(900);
          return;
        }
        avanzarPaso();
      }

      function alTocarPaso(paso) {
        if (ronda.ocupado) return;
        if (paso.id === 'clave' && ronda.medio === 'debito') {
          // En el modo guiado la clave se "escribe" sola: es de práctica y no se pide ningún dato.
          ronda.ocupado = true;
          puntosPin.forEach(function (p, k) { app.espera(function () { p.classList.add('lleno'); }, 160 * (k + 1)); });
          app.espera(function () { ronda.ocupado = false; avanzarPaso(); }, 1000);
          return;
        }
        avanzarPaso();
      }

      function elegirSino(paso, k, bt) {
        if (ronda.ocupado || bt.getAttribute('aria-disabled') === 'true') return;
        var correcta = paso.sino === 'qr' ? 'si' : M.respuestaVerificar(r.comercio, ronda.alias);
        if (k === correcta) {
          if (paso.sino === 'verificar' && k === 'no') {
            // Era otro destinatario: se vuelve a elegir el alias.
            ronda.ocupado = true;
            ronda.rechazados.push(ronda.alias);
            decirAviso('ok', t('med.volver-alias'));
            app.espera(function () {
              ronda.alias = null;
              ronda.paso = ronda.flujo.map(function (p) { return p.id; }).indexOf('alias');
              pintarPaso();
            }, 1800);
            return;
          }
          avanzarPaso();
          return;
        }
        ronda.errores++;
        bt.setAttribute('aria-disabled', 'true');
        bt.classList.add('descartada');
        var mensaje;
        if (paso.sino === 'qr') mensaje = t('paso.error.qr');
        else if (k === 'si') mensaje = t('paso.error.ver-no', { cartel: r.comercio.nombre, app: M.titularDeAlias(ronda.alias) });
        else mensaje = t('paso.error.ver-si', { cartel: r.comercio.nombre });
        decirAviso('error', mensaje);
        EpeDineroAcceso.reiniciar();
      }

      function elegirAlias(a) {
        if (ronda.ocupado || ronda.rechazados.indexOf(a.alias) !== -1) return;
        ronda.alias = a.alias;
        if (a.alias !== r.comercio.alias) ronda.errores++;
        avanzarPaso();
      }

      function elegirImporte(v, bt) {
        if (ronda.ocupado || bt.getAttribute('aria-disabled') === 'true') return;
        if (v === r.precio) { avanzarPaso(); return; }
        ronda.errores++;
        ronda.erroresPaso++;
        bt.setAttribute('aria-disabled', 'true');
        bt.classList.add('descartada');
        decirAviso('error', t('paso.error.importe', { precio: EpeI18n.dinero(r.precio) }));
        if (ronda.erroresPaso >= 2) {
          ronda.ayudas = 1;
          acciones.querySelectorAll('.opcion-texto').forEach(function (x) { if (x.getAttribute('data-valor') === String(r.precio)) x.classList.add('pista'); });
        }
        EpeDineroAcceso.reiniciar();
      }

      function escuchar() {
        if (ronda.fase === 'elegir') EpeVoz.decir(situacionHablada());
        else if (ronda.flujo && !ronda.cerrada) EpeVoz.decir(textoPaso(ronda.flujo[ronda.paso], true));
      }

      contenedor.appendChild(EpeComp.barraEjercicio(app, enlace ? enlace.i : i, enlace ? enlace.n : rondas.length, escuchar));
      contenedor.appendChild(cartel);
      contenedor.appendChild(panel);
      contenedor.appendChild(h('div', { class: 'instruccion-caja' }, [pasoEl, instruccion]));
      contenedor.appendChild(aviso);
      contenedor.appendChild(acciones);

      if (r.fijo) {
        // El medio ya está definido: se pasa directo a los pasos.
        ronda.medio = r.objetivo;
        iniciarFlujo();
      } else {
        pintarElegir();
        EpeVoz.decir(situacionHablada());
      }
      app.escanear(escaneables);
    }

    function siguiente() {
      if (enlace) {
        // Vuelve al súper con lo que pasó en el pago.
        contenedor.remove();
        enlace.alTerminar(resultados[0] || { errores: 0, ayudas: 0 });
        return;
      }
      i++;
      if (i >= rondas.length) app.ir('resumen', { modulo: 'medios', resumen: L.resumen(resultados) });
      else mostrar();
    }

    mostrar();
  };
})(window);
