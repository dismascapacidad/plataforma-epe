/* Lógica pura del módulo "Cuidarme al pagar": escenas de "¿Qué hacés?", reglas y rondas por nivel (sin DOM).
   Se puede probar con node. Todas las situaciones, personas y nombres son inventados y de práctica.
   Los textos están en js/i18n/es-AR.js (claves cu.<escena>.*): este archivo solo define la estructura. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./logica.js'));
  else root.EpeCuidarme = factory(root.EpeDineroLogica);
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';

  // Tres reglas que se repiten en todas las escenas.
  var REGLAS = ['clave', 'pausa', 'nombre'];

  // Cada escena: la regla que enseña, el dibujo y a partir de qué nivel aparece.
  // Las opciones son siempre 3: una que sí (bien), una dudosa y una que no (mal).
  var ESCENAS = [
    { id: 'clave',   regla: 'clave',  icono: 'persona',  nivel: 1 },
    { id: 'llamada', regla: 'clave',  icono: 'llamada',  nivel: 1 },
    { id: 'nombre',  regla: 'nombre', icono: 'nombre',   nivel: 1 },
    { id: 'enlace',  regla: 'pausa',  icono: 'mensaje',  nivel: 2 },
    { id: 'qr',      regla: 'nombre', icono: 'qrpegado', nivel: 2 },
    { id: 'posnet',  regla: 'clave',  icono: 'posnet',   nivel: 2 },
    { id: 'devolver', regla: 'pausa', icono: 'comprobante', nivel: 3 },
    { id: 'premio',  regla: 'pausa',  icono: 'premio',   nivel: 3 }
  ];

  var TIPOS = ['bien', 'dudosa', 'mal'];

  function escenasDeNivel(nivel) {
    var n = [1, 2, 3].indexOf(nivel) === -1 ? 1 : nivel;
    return ESCENAS.filter(function (e) { return e.nivel <= n; });
  }

  // Una ronda por escena. Si se piden más que las que hay, se vuelven a recorrer (sin repetir seguidas).
  // En el nivel 3 no se marca la respuesta correcta después de equivocarse.
  function generarCuidarme(nivel, cantidad, rng) {
    var n = [1, 2, 3].indexOf(nivel) === -1 ? 1 : nivel;
    var pool = escenasDeNivel(n).map(function (e) { return e.id; });
    return L.sorteoSinRepetir(pool, cantidad, rng).map(function (id) {
      var e = ESCENAS.filter(function (x) { return x.id === id; })[0];
      return { escena: e, opciones: L.mezclar(TIPOS, rng), conPista: n < 3 };
    });
  }

  return { REGLAS: REGLAS, ESCENAS: ESCENAS, TIPOS: TIPOS, escenasDeNivel: escenasDeNivel, generarCuidarme: generarCuidarme };
});
