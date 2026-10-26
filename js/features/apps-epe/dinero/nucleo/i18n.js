/* Idiomas. Cada idioma es un diccionario registrado aparte (js/i18n/es-AR.js).
   Para sumar otro país: crear su archivo con el mismo conjunto de claves y moneda propia, y registrarlo. */
(function (root) {
  'use strict';

  var diccionarios = {};
  var actual = 'es-AR';

  function registrar(codigo, diccionario) { diccionarios[codigo] = diccionario; }

  function usar(codigo) {
    if (diccionarios[codigo]) {
      actual = codigo;
      document.documentElement.setAttribute('lang', codigo);
    }
  }

  function dic() { return diccionarios[actual] || {}; }

  function t(clave, vars) {
    var textos = dic().textos || {};
    var texto = Object.prototype.hasOwnProperty.call(textos, clave) ? textos[clave] : clave;
    if (vars) {
      Object.keys(vars).forEach(function (k) { texto = texto.split('{' + k + '}').join(String(vars[k])); });
    }
    return texto;
  }

  function dinero(n) {
    var f = dic().moneda || { simbolo: '$', miles: '.' };
    return f.simbolo + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, f.miles);
  }

  // Para la voz: dígitos sin separador, así el sintetizador lee el número completo.
  function dineroHablado(n) {
    var f = dic().moneda || { hablado: 'pesos' };
    return String(Math.round(n)) + ' ' + f.hablado;
  }

  function codigo() { return actual; }

  root.EpeI18n = { registrar: registrar, usar: usar, t: t, dinero: dinero, dineroHablado: dineroHablado, codigo: codigo };
})(window);
