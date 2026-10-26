/* Preferencias en localStorage. Solo guarda ajustes de la persona (nunca resultados ni datos personales).
   Cada lectura y escritura va en try/catch: puede fallar en ventanas privadas o con datos bloqueados. */
(function (root) {
  'use strict';

  var PREFIJO = 'epe-dinero:';

  function leer(clave, porDefecto) {
    try {
      var crudo = window.localStorage.getItem(PREFIJO + clave);
      return crudo === null ? porDefecto : JSON.parse(crudo);
    } catch (e) {
      return porDefecto;
    }
  }

  function guardar(clave, valor) {
    try {
      window.localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }

  root.EpeAlmacen = { leer: leer, guardar: guardar };
})(window);
