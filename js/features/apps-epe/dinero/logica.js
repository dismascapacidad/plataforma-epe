/* Lógica pura de los ejercicios (sin DOM): se puede probar con node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./datos.js'));
  else root.EpeDineroLogica = factory(root.EpeDineroDatos);
})(typeof self !== 'undefined' ? self : this, function (Datos) {
  'use strict';

  var VALORES_BILLETES = Datos.BILLETES.map(function (b) { return b.valor; });

  // Todos los billetes aparecen en todos los niveles: lo que sube de nivel es la cantidad de opciones (reconocer)
  // y el precio del producto (pagar). Solo hay billetes: los 8 que circulan.
  var NIVELES_RECONOCER = {
    1: { pool: VALORES_BILLETES.slice(), opciones: 2 },
    2: { pool: VALORES_BILLETES.slice(), opciones: 3 },
    3: { pool: VALORES_BILLETES.slice(), opciones: 4 }
  };

  var NIVELES_PAGAR = {
    1: { bandeja: VALORES_BILLETES.slice() },
    2: { bandeja: VALORES_BILLETES.slice() },
    3: { bandeja: VALORES_BILLETES.slice() }
  };

  var MAX_BILLETES_MOSTRADOR = 8;

  function crearRng(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mezclar(lista, rng) {
    var r = rng || Math.random;
    var copia = lista.slice();
    for (var i = copia.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = copia[i]; copia[i] = copia[j]; copia[j] = tmp;
    }
    return copia;
  }

  // Sorteo con "bolsa": recorre todo el conjunto antes de repetir y evita repetir seguido.
  function sorteoSinRepetir(pool, cantidad, rng) {
    var res = [];
    var bolsa = [];
    while (res.length < cantidad) {
      if (!bolsa.length) bolsa = mezclar(pool, rng);
      var ultimo = res.length ? res[res.length - 1] : null;
      var idx = bolsa.length - 1;
      if (bolsa[idx] === ultimo && bolsa.length > 1) idx = 0;
      res.push(bolsa.splice(idx, 1)[0]);
    }
    return res;
  }

  function generarReconocer(nivel, cantidad, rng) {
    var cfg = NIVELES_RECONOCER[nivel] || NIVELES_RECONOCER[1];
    var objetivos = sorteoSinRepetir(cfg.pool, cantidad, rng);
    return objetivos.map(function (objetivo) {
      var distractores = mezclar(cfg.pool.filter(function (v) { return v !== objetivo; }), rng)
        .slice(0, cfg.opciones - 1);
      return { objetivo: objetivo, opciones: mezclar([objetivo].concat(distractores), rng) };
    });
  }

  // Descomposición exacta con la menor cantidad de billetes (sirve para este sistema de valores).
  function descomponer(precio, bandeja) {
    var orden = bandeja.slice().sort(function (a, b) { return b - a; });
    var resto = precio;
    var res = [];
    for (var i = 0; i < orden.length; i++) {
      while (resto >= orden[i]) { res.push(orden[i]); resto -= orden[i]; }
    }
    return resto === 0 ? res : null;
  }

  function nivelDeProducto(producto) {
    var d = descomponer(producto.precio, NIVELES_PAGAR[3].bandeja);
    if (!d) return null;
    if (d.indexOf(10000) !== -1 || d.length >= 3) return 3;
    if (d.length === 2) return 2;
    return 1;
  }

  function productosDeNivel(nivel) {
    return Datos.PRODUCTOS.filter(function (p) { return nivelDeProducto(p) === nivel; });
  }

  function generarPagar(nivel, cantidad, rng) {
    var n = NIVELES_PAGAR[nivel] ? nivel : 1;
    var productos = productosDeNivel(n);
    var ids = sorteoSinRepetir(productos.map(function (p) { return p.id; }), cantidad, rng);
    return ids.map(function (id) {
      var producto = productos.filter(function (p) { return p.id === id; })[0];
      return { producto: producto, bandeja: NIVELES_PAGAR[n].bandeja.slice() };
    });
  }

  function sumar(lista) {
    return lista.reduce(function (acc, v) { return acc + v; }, 0);
  }

  function evaluarPago(total, precio) {
    if (total === 0) return { estado: 'vacio', diferencia: precio };
    if (total === precio) return { estado: 'justo', diferencia: 0 };
    if (total < precio) return { estado: 'falta', diferencia: precio - total };
    return { estado: 'vuelto', diferencia: total - precio };
  }

  // Billetes del vuelto, con la menor cantidad posible. Todos los valores y precios son múltiplos de 100.
  function calcularVuelto(total, precio) {
    var resto = total - precio;
    if (resto <= 0) return [];
    return descomponer(resto, VALORES_BILLETES) || [];
  }

  // Ayuda graduada: qué billete conviene agregar, o si hay que sacar uno.
  function siguienteAyuda(precio, colocados, bandeja) {
    var total = sumar(colocados);
    if (total >= precio) return { accion: 'listo' };
    var resto = precio - total;
    var orden = bandeja.slice().sort(function (a, b) { return b - a; });
    for (var i = 0; i < orden.length; i++) {
      if (orden[i] <= resto) return { accion: 'agregar', valor: orden[i] };
    }
    return { accion: 'sacar' };
  }

  function resumen(rondas) {
    var total = rondas.length;
    var aPrimera = rondas.filter(function (r) { return r.errores === 0 && r.ayudas === 0; }).length;
    var errores = sumar(rondas.map(function (r) { return r.errores; }));
    var ayudas = sumar(rondas.map(function (r) { return r.ayudas; }));
    var ms = total ? Math.round(sumar(rondas.map(function (r) { return r.ms; })) / total) : 0;
    return { total: total, aPrimera: aPrimera, errores: errores, ayudas: ayudas, msPromedio: ms };
  }

  function formatearDinero(n, formato) {
    var f = formato || { simbolo: '$', miles: '.' };
    return f.simbolo + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, f.miles);
  }

  return {
    NIVELES_RECONOCER: NIVELES_RECONOCER,
    NIVELES_PAGAR: NIVELES_PAGAR,
    MAX_BILLETES_MOSTRADOR: MAX_BILLETES_MOSTRADOR,
    crearRng: crearRng,
    mezclar: mezclar,
    sorteoSinRepetir: sorteoSinRepetir,
    generarReconocer: generarReconocer,
    generarPagar: generarPagar,
    descomponer: descomponer,
    nivelDeProducto: nivelDeProducto,
    productosDeNivel: productosDeNivel,
    sumar: sumar,
    evaluarPago: evaluarPago,
    calcularVuelto: calcularVuelto,
    siguienteAyuda: siguienteAyuda,
    resumen: resumen,
    formatearDinero: formatearDinero
  };
});
