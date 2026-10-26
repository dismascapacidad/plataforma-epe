/* Arranque de la práctica con dinero. Va en un archivo aparte (no en un <script> dentro de la página). */
(function () {
  'use strict';
  try {
    EpeApp.iniciar(document.getElementById('app'));
  } catch (e) {
    document.getElementById('error-arranque').hidden = false;
    if (window.console) console.error(e);
  }
})();
