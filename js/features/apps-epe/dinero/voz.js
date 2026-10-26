/* Texto a voz con la voz del navegador. No envía nada a ningún servicio propio.
   En iPad y iPhone la voz solo se habilita después de un toque o clic: por eso desbloquear() se llama en "Empezar". */
(function (root) {
  'use strict';

  var soportada = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  var activa = true;

  function activar(valor) {
    activa = !!valor;
    if (!activa) parar();
  }

  function desbloquear() {
    if (!soportada) return;
    try {
      var u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch (e) { /* sin voz: la app sigue funcionando */ }
  }

  function parar() {
    if (!soportada) return;
    try { window.speechSynthesis.cancel(); } catch (e) { /* nada */ }
  }

  function decir(texto) {
    if (!soportada || !activa || !texto) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(texto));
      u.lang = EpeI18n.codigo();
      u.rate = 0.92;
      window.speechSynthesis.speak(u);
    } catch (e) { /* nada */ }
  }

  root.EpeVoz = { decir: decir, parar: parar, desbloquear: desbloquear, activar: activar, soportada: soportada };
})(window);
