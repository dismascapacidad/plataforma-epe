/* Lógica pura del módulo "Ir al súper": la secuencia de una compra (análisis de tareas), las rondas por nivel
   y la lista con pasillos del mini-súper (sin DOM). Se puede probar con node.
   Todo es de práctica: los productos y precios son ejemplos, no de un comercio real. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./logica.js'), require('./datos.js'), require('./medios.js'));
  else root.EpeSuper = factory(root.EpeDineroLogica, root.EpeDineroDatos, root.EpeMedios);
})(typeof self !== 'undefined' ? self : this, function (L, Datos, M) {
  'use strict';

  // La compra completa, paso a paso y en orden.
  var PASOS = ['lista', 'changuito', 'pasillo', 'producto', 'poner', 'tachar', 'caja', 'cinta', 'pagar', 'salir'];

  // Pasillos del mini-súper y qué productos hay en cada uno.
  var PASILLOS = {
    almacen: ['fideos', 'arroz', 'yerba', 'aceite', 'harina'],
    lacteos: ['leche', 'yogur', 'queso'],
    panaderia: ['pan', 'alfajor', 'galletitas'],
    carnes: ['carne', 'pollo']
  };
  var IDS_PASILLOS = ['almacen', 'lacteos', 'panaderia', 'carnes'];
  // Ícono de producto que representa a cada pasillo en el cartel.
  var ICONO_PASILLO = { almacen: 'bolsa', lacteos: 'carton', panaderia: 'pan', carnes: 'carne' };

  // Nivel 1: elegir el paso que sigue. Nivel 2: ordenar un tramo. Nivel 3: mini-súper con lista.
  var TRAMO_ORDENAR = { 1: 4, 2: 4, 3: 5 };

  function producto(id) {
    return Datos.PRODUCTOS.filter(function (p) { return p.id === id; })[0];
  }

  function pasilloDe(idProducto) {
    for (var k = 0; k < IDS_PASILLOS.length; k++) {
      if (PASILLOS[IDS_PASILLOS[k]].indexOf(idProducto) !== -1) return IDS_PASILLOS[k];
    }
    return null;
  }

  // Cuántos números de arranque distintos hay para el nivel 1 (un paso que sigue a cada uno de los 9 primeros).
  function generarSiguiente(cantidad, rng) {
    var arranques = [];
    for (var i = 1; i < PASOS.length; i++) arranques.push(i);
    var elegidos = L.sorteoSinRepetir(arranques, cantidad, rng);
    return elegidos.map(function (n) {
      var correcto = PASOS[n];
      var otros = L.mezclar(PASOS.filter(function (p) { return p !== correcto && PASOS.indexOf(p) !== n - 1; }), rng).slice(0, 2);
      return {
        tipo: 'siguiente',
        hechos: PASOS.slice(Math.max(0, n - 3), n),   // se muestran hasta los 3 últimos pasos hechos
        correcto: correcto,
        opciones: L.mezclar([correcto].concat(otros), rng)
      };
    });
  }

  // Un tramo de pasos consecutivos, mezclados. Nunca llega ya ordenado.
  function generarOrdenar(nivel, cantidad, rng) {
    var largo = TRAMO_ORDENAR[nivel] || 4;
    var inicios = [];
    for (var i = 0; i + largo <= PASOS.length; i++) inicios.push(i);
    return L.sorteoSinRepetir(inicios, cantidad, rng).map(function (ini) {
      var orden = PASOS.slice(ini, ini + largo);
      var mezcla = L.mezclar(orden, rng);
      var intentos = 0;
      while (mezcla.join() === orden.join() && intentos++ < 20) mezcla = L.mezclar(orden, rng);
      return { tipo: 'ordenar', orden: orden, mezcla: mezcla };
    });
  }

  // Opciones para "¿cuánto es en total?": el total, uno con un cero de más y uno cercano.
  function opcionesTotal(total, rng) {
    var cercano = total + 500 <= 99999 ? total + 500 : total - 500;
    var valores = [total, total * 10, cercano];
    var unicos = [];
    valores.forEach(function (v) { if (v > 0 && unicos.indexOf(v) === -1) unicos.push(v); });
    return L.mezclar(unicos, rng);
  }

  // Una compra: lista de 3 productos de pasillos distintos; cada uno con su estante (los productos de ese pasillo).
  // Cada compra termina pagando: el medio (efectivo, tarjeta, QR o transferencia) cambia de una compra a otra.
  function generarMiniSuper(cantidad, rng) {
    var viajes = [];
    var ultimos = [];
    var medios = L.sorteoSinRepetir(M.MEDIOS, cantidad, rng);
    for (var v = 0; v < cantidad; v++) {
      var pasillos = L.mezclar(IDS_PASILLOS, rng).slice(0, 3);
      var lista = pasillos.map(function (pas) {
        var cand = PASILLOS[pas].filter(function (id) { return ultimos.indexOf(id) === -1; });
        if (!cand.length) cand = PASILLOS[pas];
        var id = L.mezclar(cand, rng)[0];
        return { producto: producto(id), pasillo: pas, estante: L.mezclar(PASILLOS[pas], rng) };
      });
      ultimos = lista.map(function (it) { return it.producto.id; });
      var total = L.sumar(lista.map(function (it) { return it.producto.precio; }));
      viajes.push({
        tipo: 'minisuper',
        lista: L.mezclar(lista, rng),
        pasillos: IDS_PASILLOS.slice(),
        total: total,
        pago: medios[v],
        opcionesTotal: opcionesTotal(total, rng)
      });
    }
    return viajes;
  }

  // Nivel 3: un viaje por cada 3 ejercicios elegidos (5 → 2, 8 → 3, 10 → 4).
  function viajesDe(cantidad) { return Math.max(1, Math.ceil(cantidad / 3)); }

  function generarSuper(nivel, cantidad, rng) {
    var n = [1, 2, 3].indexOf(nivel) === -1 ? 1 : nivel;
    if (n === 1) return generarSiguiente(cantidad, rng);
    if (n === 2) return generarOrdenar(2, cantidad, rng);
    return generarMiniSuper(viajesDe(cantidad), rng);
  }

  // Ordenar: el próximo paso correcto, dado lo que ya se colocó.
  function proximoCorrecto(orden, colocados) {
    return colocados.length < orden.length ? orden[colocados.length] : null;
  }

  return {
    PASOS: PASOS,
    PASILLOS: PASILLOS,
    IDS_PASILLOS: IDS_PASILLOS,
    ICONO_PASILLO: ICONO_PASILLO,
    pasilloDe: pasilloDe,
    producto: producto,
    generarSiguiente: generarSiguiente,
    generarOrdenar: generarOrdenar,
    generarMiniSuper: generarMiniSuper,
    generarSuper: generarSuper,
    opcionesTotal: opcionesTotal,
    proximoCorrecto: proximoCorrecto,
    viajesDe: viajesDe
  };
});
