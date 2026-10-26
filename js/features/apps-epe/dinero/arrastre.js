/* Arrastrar billetes con el dedo, el lápiz o el mouse.
   Un toque corto (sin mover) hace lo mismo que soltar en el mostrador: es la alternativa a arrastrar
   para quien no puede sostener el gesto (WCAG 2.5.7). El teclado y el barrido llegan como clic. */
(function (root) {
  'use strict';

  var UMBRAL_PX = 10;
  var VENTANA_CLIC_MS = 700;

  // opts: { valor, zona: () => Element, alSoltar(valor), alTocar(valor) }
  function vincular(el, opts) {
    var estado = null;
    var ultimoPuntero = 0;

    function dentro(zona, x, y) {
      if (!zona) return false;
      var r = zona.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function crearFantasma() {
      var origen = el.querySelector('svg');
      if (!origen) return null;
      var caja = origen.getBoundingClientRect();
      var f = document.createElement('div');
      f.className = 'fantasma';
      f.style.setProperty('--ancho', Math.max(90, caja.width) + 'px');
      f.appendChild(origen.cloneNode(true));
      document.body.appendChild(f);
      return f;
    }

    function mover(e) {
      if (estado.fantasma) {
        estado.fantasma.style.left = e.clientX + 'px';
        estado.fantasma.style.top = e.clientY + 'px';
      }
      var zona = opts.zona();
      if (zona) zona.classList.toggle('zona-activa', dentro(zona, e.clientX, e.clientY));
    }

    function limpiar() {
      var zona = opts.zona();
      if (zona) zona.classList.remove('zona-activa');
      if (estado && estado.fantasma && estado.fantasma.parentNode) estado.fantasma.parentNode.removeChild(estado.fantasma);
      el.classList.remove('arrastrando');
      estado = null;
    }

    el.addEventListener('pointerdown', function (e) {
      if (e.isPrimary === false) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      if (estado) limpiar();
      estado = { id: e.pointerId, x: e.clientX, y: e.clientY, arrastrando: false, fantasma: null };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    });

    el.addEventListener('pointermove', function (e) {
      if (!estado || e.pointerId !== estado.id) return;
      if (!estado.arrastrando) {
        var dx = e.clientX - estado.x, dy = e.clientY - estado.y;
        if (Math.sqrt(dx * dx + dy * dy) < UMBRAL_PX) return;
        estado.arrastrando = true;
        estado.fantasma = crearFantasma();
        el.classList.add('arrastrando');
      }
      mover(e);
    });

    function terminar(e, cancelado) {
      if (!estado || e.pointerId !== estado.id) return;
      var arrastro = estado.arrastrando;
      var zona = opts.zona();
      var solto = arrastro && !cancelado && dentro(zona, e.clientX, e.clientY);
      var fueToque = !arrastro && !cancelado;
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* nada */ }
      limpiar();
      ultimoPuntero = Date.now();
      if (solto) opts.alSoltar(opts.valor);
      else if (fueToque) opts.alTocar(opts.valor);
    }

    el.addEventListener('pointerup', function (e) { terminar(e, false); });
    el.addEventListener('pointercancel', function (e) { terminar(e, true); });
    el.addEventListener('lostpointercapture', function (e) { if (estado && e.pointerId === estado.id && !estado.arrastrando) limpiar(); });

    // Teclado, lector de pantalla y barrido: el clic llega sin un puntero reciente.
    el.addEventListener('click', function () {
      if (Date.now() - ultimoPuntero < VENTANA_CLIC_MS) return;
      opts.alTocar(opts.valor);
    });
  }

  root.EpeArrastre = { vincular: vincular };
})(window);
