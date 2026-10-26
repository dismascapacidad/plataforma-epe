/* Acceso de la práctica con dinero: une las pantallas con el motor de la plataforma (EpeEntrada).
   Modos (los elige el panel de acceso de la plataforma, EpeAcceso.crearPanel):
     directo  la pantalla se usa tal cual: tocar, arrastrar, teclado y mouse normales (no corre ningún barrido)
     auto     barrido automático, 1 pulsador: lo marcado avanza solo y el pulsador elige
     manual   barrido dirigido, 2 pulsadores: uno avanza y el otro elige
   Los dispositivos dis+capacidad emulan teclado y mouse, así que llegan como teclas.
   El barrido solo corre dentro de los ejercicios: en el inicio y en la configuración no se activa.
   Lo que lleva data-chrome (Salir, Escuchar, tema) siempre responde al toque directo
   (la capa de toque lo deja por encima, ver estructura.css). */
(function (root) {
  'use strict';

  var cfg = null; // salida de panel.leer(); null = modo directo
  var obtener = null; // devuelve los elementos en el orden en que se recorren
  var entrada = null; // motor activo (solo en los modos de barrido)
  var ultimos = []; // lista que el motor recorrió la última vez (para resolver qué se eligió)
  var observador = null;

  function modo() { return cfg ? cfg.modo : 'directo'; }
  function esEscaneo() { return modo() === 'manual' || modo() === 'auto'; }

  function objetivos() {
    if (!obtener) return [];
    return obtener().filter(function (el) {
      return el && el.isConnected && !el.disabled && !el.hidden && el.getAttribute('aria-disabled') !== 'true';
    });
  }

  function decirResaltado(el) {
    root.EpeVoz.decir(el.getAttribute('data-voz') || el.getAttribute('aria-label') || el.textContent);
  }

  // El motor marca el elemento con data-scan-actual; al aparecer en uno nuevo, se lo lee en voz alta.
  function vigilarResaltado() {
    detenerVigilancia();
    observador = new MutationObserver(function (registros) {
      var dichos = [];
      registros.forEach(function (r) {
        var el = r.target;
        if (el.hasAttribute('data-scan-actual') && dichos.indexOf(el) === -1) {
          dichos.push(el);
          decirResaltado(el);
        }
      });
    });
    observador.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-scan-actual'] });
  }

  function detenerVigilancia() {
    if (observador) { observador.disconnect(); observador = null; }
  }

  // Lo que eligió la persona en el panel de acceso (o null para el modo directo).
  function configurar(config) { cfg = config || null; }

  // fn devuelve los elementos que se pueden elegir en la pantalla actual.
  function activar(fn) {
    detener();
    obtener = fn;
    if (!esEscaneo()) return;
    vigilarResaltado();
    entrada = root.EpeEntrada.crear({
      cfg: cfg,
      getObjetivos: function () {
        ultimos = objetivos();
        return ultimos.map(function (el, i) { return { id: String(i), el: el }; });
      },
      alAccion: function (id) {
        var el = ultimos[Number(id)];
        if (el) el.click();
      }
    });
    entrada.iniciar();
  }

  function detener() {
    if (entrada) { entrada.detener(); entrada = null; }
    detenerVigilancia();
    ultimos = [];
  }

  function desactivar() {
    obtener = null;
    detener();
  }

  // Vuelve al primer elemento y reinicia el tiempo (por ejemplo, después de un error o de cambiar las opciones).
  function reiniciar() {
    if (entrada) entrada.reiniciar();
  }

  root.EpeDineroAcceso = {
    configurar: configurar,
    activar: activar,
    desactivar: desactivar,
    reiniciar: reiniciar,
    esEscaneo: esEscaneo,
    modoActual: modo
  };
})(window);
