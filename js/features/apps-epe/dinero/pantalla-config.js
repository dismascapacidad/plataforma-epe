/* Ventana de opciones antes de empezar. Cómo se responde (tocar o barrido, teclas, velocidad) lo resuelve
   el panel de acceso de la plataforma, en una segunda ventana; el dispositivo dis+capacidad se configura
   con su widget "Configurar dispositivo". */
(function (root) {
  'use strict';

  var h = EpeDom.h;
  var t = EpeI18n.t;
  root.EpePantallas = root.EpePantallas || {};

  var ID_PANEL = 'dinero'; // guarda las teclas y la velocidad en este navegador (epe-acceso-dinero)

  root.EpePantallas.config = function (app, datos) {
    var modulo = datos.modulo;
    var cfg = app.config;

    // El inicio queda de fondo, sin barrido: acá se configura con el toque.
    EpePantallas.inicio(app);

    function cambiar(clave) {
      return function (valor) { cfg[clave] = valor; app.guardarConfig(); };
    }

    // ── Cómo se responde: el panel de la plataforma, sin "una tecla por acción" (acá hay muchos elementos) ──
    var cajaPanel = h('div', { class: 'config-acceso' });
    var panel = EpeAcceso.crearPanel(cajaPanel, {
      id: ID_PANEL,
      acciones: [],
      directo: { sinTeclas: true, titulo: t('acceso.tocar'), detalle: t('acceso.tocar.det') }
    });

    var resumen = h('p', { class: 'acceso-resumen', 'aria-live': 'polite' });
    function pintarResumen() {
      var c = panel.leer();
      var texto = t('acceso.tocar');
      if (c.modo === 'manual') texto = t('acceso.resumen.manual', { a: EpeTeclas.etiqueta(c.avanzar), b: EpeTeclas.etiqueta(c.seleccionar) });
      else if (c.modo === 'auto') texto = t('acceso.resumen.auto', { b: EpeTeclas.etiqueta(c.seleccionar) });
      if (c.modo !== 'directo' && c.toque && c.toque.activo) texto += t('acceso.resumen.toque');
      resumen.textContent = texto;
    }

    var btnCambiar = h('button', { class: 'btn btn-fantasma', type: 'button', 'data-chrome': '', texto: t('acceso.cambiar') });
    var filaAcceso = h('div', { class: 'fila' }, [
      h('p', { class: 'fila-titulo', texto: t('config.acceso') }),
      h('div', { class: 'acceso-fila' }, [resumen, btnCambiar])
    ]);

    var filas = [
      filaAcceso,
      EpeComp.grupo(t('config.nivel'), [
        { valor: 1, texto: t('nivel.1') }, { valor: 2, texto: t('nivel.2') }, { valor: 3, texto: t('nivel.3') }
      ], cfg.nivel, cambiar('nivel')),
      EpeComp.grupo(t('config.cantidad'), [
        { valor: 5, texto: '5' }, { valor: 8, texto: '8' }, { valor: 10, texto: '10' }
      ], cfg.cantidad, cambiar('cantidad')),
      EpeComp.grupo(t('config.voz'), [
        { valor: true, texto: t('voz.si') }, { valor: false, texto: t('voz.no') }
      ], cfg.voz, cambiar('voz'))
    ];

    // Solo en "¿Cómo pago?": cuánto hace la persona en cada paso, y la clave de práctica del posnet.
    var claveEl = null;
    if (modulo === 'medios') {
      filas.splice(3, 0, EpeComp.grupo(t('config.interaccion'), [
        { valor: 'gestos', texto: t('inter.gestos') }, { valor: 'guiado', texto: t('inter.guiado') }
      ], cfg.interaccion, cambiar('interaccion')));
      claveEl = h('div', { class: 'clave-practica' }, [
        h('p', { class: 'clave-titulo', texto: t('config.clave') }),
        h('div', { class: 'clave-digitos', 'aria-label': EpeMedios.PIN_PRACTICA.split('').join(' ') }, EpeMedios.PIN_PRACTICA.split('').map(function (d) {
          return h('span', { class: 'clave-digito', 'aria-hidden': 'true', texto: d });
        })),
        h('p', { class: 'clave-aviso', texto: t('config.clave.aviso') })
      ]);
    }

    // ── Dispositivo dis+capacidad ──
    var btnDisp = h('button', { class: 'epe-btn-ghost epe-btn-sm', type: 'button', 'data-chrome': '', texto: t('disp.configurar') });
    var btnRest = h('button', { class: 'epe-btn-ghost epe-btn-sm', type: 'button', 'data-chrome': '', texto: t('disp.restaurar') });

    function entradasDispositivo() { return EpeAcceso.entradasNecesarias(panel.leer(), []); }

    // En "tocar o arrastrar" no hay teclas que programar: el botón del dispositivo solo aparece con barrido.
    function actualizarBotones() {
      btnDisp.hidden = !root.EpeConfigurarDispositivo || entradasDispositivo().length === 0;
      btnRest.hidden = !app.restaurar;
    }
    cajaPanel.addEventListener('change', actualizarBotones);

    btnDisp.addEventListener('click', function () {
      if (!root.EpeConfigurarDispositivo) return;
      root.EpeConfigurarDispositivo.abrir(entradasDispositivo(), {
        titulo: t('disp.titulo'),
        // Con un solo botón, el toque corto avanza y la pulsación larga elige (o al revés): cuenta como dos pulsadores.
        combinar: true
      }).then(function (r) {
        if (r && r.restaurar) app.restaurar = r.restaurar;
        actualizarBotones();
        if (r && r.continuar) empezar();
      });
    });

    btnRest.addEventListener('click', function () {
      if (!app.restaurar) return;
      var fn = app.restaurar;
      app.restaurar = null;
      btnRest.disabled = true;
      btnRest.textContent = t('disp.restaurando');
      fn().then(function (r) {
        btnRest.textContent = r && r.ok ? t('disp.listo') : t('disp.distinto');
      }).catch(function () {
        btnRest.textContent = t('disp.error');
      }).then(function () {
        setTimeout(function () {
          btnRest.disabled = false;
          btnRest.textContent = t('disp.restaurar');
          actualizarBotones();
        }, 2500);
      });
    });

    // ── Ventana principal ──
    var volver = h('button', { class: 'btn btn-secundario', type: 'button', 'data-chrome': '', 'data-voz': t('btn.volver'), onclick: function () { app.ir('inicio'); }, texto: t('btn.volver') });
    function empezar() {
      // En iPad y iPhone la voz se habilita con este toque.
      EpeVoz.desbloquear();
      app.guardarConfig();
      app.accesoCfg = panel.leer();
      app.ir(modulo);
    }
    var btnEmpezar = h('button', { class: 'btn btn-primario', type: 'button', 'data-chrome': '', 'data-voz': t('btn.empezar'), onclick: empezar, texto: t('btn.empezar') });

    var dialogo = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'config-titulo' }, [
      h('header', { class: 'modal-cabecera' }, [
        h('h2', { id: 'config-titulo', tabindex: '-1', texto: t('home.' + modulo + '.titulo') }),
        h('p', { class: 'modal-sub', texto: t('config.sub') })
      ]),
      h('div', { class: 'config-grilla' }, filas),
      claveEl,
      (modulo === 'reconocer' || modulo === 'pagar' || modulo === 'medios') ? h('p', { class: 'config-fuente', texto: t('config.fuente') }) : null,
      h('div', { class: 'modal-botones' }, [volver, btnEmpezar]),
      EpeComp.marca('marca-modal')
    ]);

    // ── Ventana de acceso (el panel de la plataforma) ──
    var btnListo = h('button', { class: 'btn btn-primario', type: 'button', 'data-chrome': '', texto: t('acceso.listo') });
    var dialogoAcceso = h('div', { class: 'modal modal-acceso', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'acceso-titulo' }, [
      h('header', { class: 'modal-cabecera' }, h('h2', { id: 'acceso-titulo', tabindex: '-1', texto: t('config.acceso') })),
      h('div', { class: 'config-acceso-caja' }, [cajaPanel, h('div', { class: 'config-dispositivo' }, [btnDisp, btnRest])]),
      h('div', { class: 'modal-botones uno' }, btnListo)
    ]);

    // Las dos ventanas van directo en <body> y con sufijo -overlay: así la plataforma (ajuste-modal.js) las detecta
    // y las achica si no entran en la pantalla. app.limpiar() las quita al salir de esta pantalla.
    var fondo = h('div', { class: 'modal-fondo dinero-overlay' }, dialogo);
    var fondoAcceso = h('div', { class: 'modal-fondo dinero-overlay', hidden: true }, dialogoAcceso);
    document.body.appendChild(fondo);
    document.body.appendChild(fondoAcceso);

    function abrirAcceso() {
      fondoAcceso.hidden = false;
      actualizarBotones();
      document.getElementById('acceso-titulo').focus();
    }
    function cerrarAcceso() {
      fondoAcceso.hidden = true;
      pintarResumen();
      btnCambiar.focus();
    }
    btnCambiar.addEventListener('click', abrirAcceso);
    btnListo.addEventListener('click', cerrarAcceso);
    // Esc cierra primero la ventana de acceso (y no toda la configuración).
    app.alEscape = function () {
      if (fondoAcceso.hidden) return false;
      cerrarAcceso();
      return true;
    };

    pintarResumen();
    actualizarBotones();

    // La configuración se usa tocando (sin barrido): el barrido corre solo dentro de los ejercicios.
    var titulo = document.getElementById('config-titulo');
    if (titulo) titulo.focus();
  };
})(window);
