/* Lógica pura del módulo "¿Cómo pago?": medios de pago, situaciones y pasos de cada flujo (sin DOM).
   Se puede probar con node. Todo lo que se muestra es de práctica: comercios, alias y titulares son inventados. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./logica.js'), require('./datos.js'));
  else root.EpeMedios = factory(root.EpeDineroLogica, root.EpeDineroDatos);
})(typeof self !== 'undefined' ? self : this, function (L, Datos) {
  'use strict';

  var MEDIOS = ['efectivo', 'debito', 'qr', 'transferencia'];

  // Qué hace falta llevar encima para usar cada medio. QR y transferencia se hacen con el celular.
  var PORTADOR = { efectivo: 'billetes', debito: 'tarjeta', qr: 'celular', transferencia: 'celular' };
  var PORTADORES = ['billetes', 'tarjeta', 'celular'];

  // Nivel 1: 3 medios, 2 opciones. Nivel 2: 4 medios, 3 opciones. Nivel 3: 4 medios, todas las opciones y a veces hay 2 válidas.
  var NIVELES = {
    1: { pool: ['efectivo', 'debito', 'qr'], opciones: 2, validos: [1, 1] },
    2: { pool: MEDIOS, opciones: 3, validos: [1, 1] },
    3: { pool: MEDIOS, opciones: 4, validos: [1, 2] }
  };

  // Comercios inventados. El alias es de práctica y no corresponde a ninguna cuenta real.
  var COMERCIOS = [
    { id: 'donpepe', nombre: 'Almacén Don Pepe', alias: 'almacen.donpepe' },
    { id: 'estrella', nombre: 'Kiosco Estrella', alias: 'kiosco.estrella' },
    { id: 'esquina', nombre: 'Almacén La Esquina', alias: 'almacen.laesquina' },
    { id: 'sol', nombre: 'Mini Mercado Sol', alias: 'minimercado.sol' },
    { id: 'luna', nombre: 'Despensa Luna', alias: 'despensa.luna' },
    { id: 'norte', nombre: 'Autoservicio Norte', alias: 'autoservicio.norte' }
  ];

  // Pasos de cada flujo. Los textos salen de i18n con la clave f.<medio>.<id>.titulo y f.<medio>.<id>.btn.
  //   tocar     un botón que avanza
  //   arrastrar un objeto que se arrastra a una zona (o se toca: es lo mismo)
  //   espera    avanza solo
  //   sino      dos botones: Sí / No
  //   alias     elegir el alias del cartel entre varios
  //   importe   elegir el importe correcto entre varios
  // En el modo "Hago los gestos", `gesto` dice cómo se hace el paso: tocando el dispositivo simulado ('dispositivo'),
  // con un teclado numérico ('clave', 'importe'), armando el alias en dos partes ('partes'), eligiendo qué decir ('frases'),
  // sacando billetes de la billetera ('billetera') o contando el vuelto ('vuelto').
  var FLUJOS = {
    efectivo: [
      { id: 'sacar', tipo: 'tocar', vista: 'ef-billetes', gesto: 'billetera' },
      { id: 'entregar', tipo: 'arrastrar', objeto: 'billetes', zona: 'dispositivo', vista: 'ef-vendedor' },
      { id: 'vuelto', tipo: 'tocar', vista: 'ef-vuelto', gesto: 'vuelto' },
      { id: 'ticket', tipo: 'tocar', vista: 'ticket', gesto: 'dispositivo' }
    ],
    debito: [
      { id: 'avisar', tipo: 'tocar', vista: 'vendedor-pregunta', gesto: 'frases' },
      { id: 'acercar', tipo: 'arrastrar', objeto: 'tarjeta', zona: 'dispositivo', vista: 'posnet-total' },
      { id: 'clave', tipo: 'tocar', vista: 'posnet-clave', gesto: 'clave' },
      { id: 'espera', tipo: 'espera', ms: 1800, vista: 'posnet-espera' },
      { id: 'retirar', tipo: 'tocar', vista: 'posnet-ok', gesto: 'dispositivo' }
    ],
    qr: [
      { id: 'abrir', tipo: 'tocar', vista: 'cel-inicio', gesto: 'dispositivo' },
      { id: 'menu', tipo: 'tocar', vista: 'app-menu', destacar: 'qr', gesto: 'dispositivo' },
      { id: 'escanear', tipo: 'arrastrar', objeto: 'celular', zona: 'qr', vista: 'cel-camara' },
      { id: 'revisar', tipo: 'sino', sino: 'qr', vista: 'qr-datos' },
      { id: 'confirmar', tipo: 'tocar', vista: 'qr-datos', gesto: 'dispositivo' },
      { id: 'comprobante', tipo: 'tocar', vista: 'comprobante', gesto: 'dispositivo' }
    ],
    transferencia: [
      { id: 'abrir', tipo: 'tocar', vista: 'cel-inicio', gesto: 'dispositivo' },
      { id: 'menu', tipo: 'tocar', vista: 'app-menu', destacar: 'transferencia', gesto: 'dispositivo' },
      { id: 'alias', tipo: 'alias', vista: 'tr-alias', gesto: 'partes' },
      { id: 'verificar', tipo: 'sino', sino: 'verificar', vista: 'tr-verificar' },
      { id: 'importe', tipo: 'importe', vista: 'tr-importe', gesto: 'importe' },
      { id: 'confirmar', tipo: 'tocar', vista: 'tr-resumen', gesto: 'dispositivo' },
      { id: 'comprobante', tipo: 'tocar', vista: 'comprobante', gesto: 'dispositivo' }
    ]
  };

  function azar(rng) { return (rng || Math.random)(); }

  function enOrdenDeMedios(lista) { return MEDIOS.filter(function (m) { return lista.indexOf(m) !== -1; }); }

  // Medios que se pueden usar: el comercio los acepta Y la persona lleva lo necesario.
  function mediosValidos(acepta, lleva) {
    return enOrdenDeMedios(acepta).filter(function (m) { return lleva.indexOf(PORTADOR[m]) !== -1; });
  }

  // Por qué un medio no sirve en esta situación: 'no-acepta' (el cartel no lo dice) o 'no-lleva' (no lo tenés encima).
  function motivoRechazo(medio, acepta, lleva) {
    if (acepta.indexOf(medio) === -1) return 'no-acepta';
    if (lleva.indexOf(PORTADOR[medio]) === -1) return 'no-lleva';
    return null;
  }

  function armarSituacion(nivel, objetivo, rng) {
    var cfg = NIVELES[nivel];
    for (var intento = 0; intento < 300; intento++) {
      var acepta = cfg.pool.filter(function (m) { return m === objetivo || azar(rng) < 0.5; });
      var lleva = PORTADORES.filter(function (p) { return p === PORTADOR[objetivo] || azar(rng) < 0.55; });
      var validos = mediosValidos(acepta, lleva);
      if (validos.indexOf(objetivo) !== -1 && validos.length >= cfg.validos[0] && validos.length <= cfg.validos[1]) {
        return { acepta: enOrdenDeMedios(acepta), lleva: PORTADORES.filter(function (p) { return lleva.indexOf(p) !== -1; }), validos: validos };
      }
    }
    // Respaldo que siempre cumple: el comercio acepta solo el medio buscado.
    return { acepta: [objetivo], lleva: PORTADORES.slice(), validos: [objetivo] };
  }

  function armarOpciones(nivel, validos, objetivo, rng) {
    var cfg = NIVELES[nivel];
    if (cfg.opciones >= cfg.pool.length) return L.mezclar(cfg.pool, rng);
    var invalidos = cfg.pool.filter(function (m) { return validos.indexOf(m) === -1; });
    var elegidos = L.mezclar(invalidos, rng).slice(0, cfg.opciones - 1);
    return L.mezclar([objetivo].concat(elegidos), rng);
  }

  // El alias correcto y dos de otros comercios. Si se elige uno de otro comercio, el titular que muestra la app no coincide con el cartel.
  function opcionesAlias(comercio, rng) {
    var otros = L.mezclar(COMERCIOS.filter(function (c) { return c.id !== comercio.id; }), rng).slice(0, 2);
    return L.mezclar([comercio].concat(otros), rng).map(function (c) { return { alias: c.alias, titular: c.nombre }; });
  }

  // El importe correcto, uno con un cero de más y otro cercano. Sirve para enseñar a mirar bien los montos.
  function opcionesImporte(precio, rng) {
    var alterno = precio >= 1000 ? precio / 10 : precio + 500;
    var lista = [precio, precio * 10, alterno];
    var unicos = lista.filter(function (v, i) { return lista.indexOf(v) === i; });
    return L.mezclar(unicos, rng);
  }

  // Lo que la persona debe responder cuando mira si todo coincide.
  //   qr: los datos del QR siempre son los del comercio. verificar: depende del alias que eligió.
  function respuestaVerificar(comercio, aliasElegido) {
    return aliasElegido === comercio.alias ? 'si' : 'no';
  }

  function titularDeAlias(alias) {
    for (var i = 0; i < COMERCIOS.length; i++) if (COMERCIOS[i].alias === alias) return COMERCIOS[i].nombre;
    return null;
  }

  // Clave de práctica del posnet. Se muestra en la ventana de inicio. Nunca es una clave real.
  var PIN_PRACTICA = '4729';

  // El alias se arma con dos partes (rubro.nombre): por ejemplo "almacen" + "donpepe".
  function aliasPartes(alias) {
    var p = alias.split('.');
    return { primera: p[0], segunda: p[1] };
  }

  // Tres opciones para cada parte: la correcta y dos de otros comercios. Combinarlas mal puede dar un alias de otro comercio o uno que no existe.
  function opcionesAliasPartes(comercio, rng) {
    var correcta = aliasPartes(comercio.alias);
    var otros = L.mezclar(COMERCIOS.filter(function (c) { return c.id !== comercio.id; }), rng);
    function tres(clave) {
      var valores = [correcta[clave]];
      otros.forEach(function (c) {
        var v = aliasPartes(c.alias)[clave];
        if (valores.length < 3 && valores.indexOf(v) === -1) valores.push(v);
      });
      return L.mezclar(valores, rng);
    }
    return { primeras: tres('primera'), segundas: tres('segunda') };
  }

  // Lo que responde la app al buscar un alias: existe (con su titular) o no existe.
  function resolverAlias(primera, segunda) {
    var alias = primera + '.' + segunda;
    var titular = titularDeAlias(alias);
    return { alias: alias, titular: titular, existe: titular !== null };
  }

  // Frases para decirle al vendedor cómo se va a pagar: la correcta y dos de otros medios.
  function opcionesFrases(objetivo, rng) {
    var otros = L.mezclar(MEDIOS.filter(function (m) { return m !== objetivo; }), rng).slice(0, 2);
    return L.mezclar([objetivo].concat(otros), rng);
  }

  // Billetes de la billetera para pagar en efectivo: los justos y uno grande que obliga a pedir vuelto si se usa solo.
  function billeteraEfectivo(precio, rng) {
    var necesarios = L.descomponer(precio, [20000, 10000, 2000, 1000, 500, 200, 100]) || [];
    // A veces un billete chico se paga con billetes de $50 (dos de $50 son $100).
    if (rng && rng() < 0.5) {
      var partes = { 100: [50, 50], 200: [100, 50, 50], 500: [200, 200, 50, 50] };
      for (var k = 0; k < necesarios.length; k++) {
        if (partes[necesarios[k]]) { necesarios = necesarios.slice(0, k).concat(partes[necesarios[k]], necesarios.slice(k + 1)); break; }
      }
    }
    var extra = [1000, 2000, 10000, 20000].filter(function (v) { return v > precio; })[0] || null;
    return { necesarios: necesarios, extra: extra, billetes: L.mezclar(necesarios.concat(extra ? [extra] : []), rng) };
  }

  // Teclado numérico guiado: qué tecla falta para llegar al número buscado.
  //   devuelve un dígito, 'borrar' (lo escrito no coincide con el objetivo) o null (ya está completo).
  function siguienteTecla(objetivo, ingresado) {
    if (objetivo.indexOf(ingresado) !== 0) return 'borrar';
    if (ingresado.length === objetivo.length) return null;
    return objetivo.charAt(ingresado.length);
  }

  // Ronda de pago que continúa una compra del súper: el comercio es el del súper, se paga el total de la compra
  // y el medio ya viene definido (no se elige). Sirve para "Ir al súper" nivel 3.
  function armarRondaPago(total, medio, rng) {
    var comercio = COMERCIOS.filter(function (c) { return c.id === 'norte'; })[0];
    return {
      fijo: true,
      objetivo: medio,
      comercio: comercio,
      producto: { id: 'compra', nombre: 'tus compras', icono: 'bolsa' },
      precio: total,
      acepta: MEDIOS.slice(),
      lleva: PORTADORES.slice(),
      validos: [medio],
      opciones: [medio],
      aliasOpciones: opcionesAlias(comercio, rng),
      aliasPartes: opcionesAliasPartes(comercio, rng),
      importeOpciones: opcionesImporte(total, rng),
      frases: opcionesFrases(medio, rng),
      billetera: billeteraEfectivo(total, rng)
    };
  }

  function generarMedios(nivel, cantidad, rng) {
    var n = NIVELES[nivel] ? nivel : 1;
    var cfg = NIVELES[n];
    var objetivos = L.sorteoSinRepetir(cfg.pool, cantidad, rng);
    var comercios = L.sorteoSinRepetir(COMERCIOS.map(function (c) { return c.id; }), cantidad, rng);
    var productos = L.sorteoSinRepetir(Datos.PRODUCTOS.map(function (p) { return p.id; }), cantidad, rng);
    return objetivos.map(function (objetivo, i) {
      var comercio = COMERCIOS.filter(function (c) { return c.id === comercios[i]; })[0];
      var producto = Datos.PRODUCTOS.filter(function (p) { return p.id === productos[i]; })[0];
      var sit = armarSituacion(n, objetivo, rng);
      return {
        objetivo: objetivo,
        comercio: comercio,
        producto: producto,
        precio: producto.precio,
        acepta: sit.acepta,
        lleva: sit.lleva,
        validos: sit.validos,
        opciones: armarOpciones(n, sit.validos, objetivo, rng),
        aliasOpciones: opcionesAlias(comercio, rng),
        aliasPartes: opcionesAliasPartes(comercio, rng),
        importeOpciones: opcionesImporte(producto.precio, rng),
        frases: opcionesFrases(objetivo, rng),
        billetera: billeteraEfectivo(producto.precio, rng)
      };
    });
  }

  return {
    MEDIOS: MEDIOS, PORTADOR: PORTADOR, PORTADORES: PORTADORES, NIVELES: NIVELES, COMERCIOS: COMERCIOS, FLUJOS: FLUJOS,
    mediosValidos: mediosValidos, motivoRechazo: motivoRechazo, armarSituacion: armarSituacion,
    opcionesAlias: opcionesAlias, opcionesImporte: opcionesImporte, respuestaVerificar: respuestaVerificar,
    titularDeAlias: titularDeAlias, generarMedios: generarMedios, armarRondaPago: armarRondaPago,
    PIN_PRACTICA: PIN_PRACTICA, aliasPartes: aliasPartes, opcionesAliasPartes: opcionesAliasPartes, resolverAlias: resolverAlias,
    opcionesFrases: opcionesFrases, billeteraEfectivo: billeteraEfectivo, siguienteTecla: siguienteTecla
  };
});
