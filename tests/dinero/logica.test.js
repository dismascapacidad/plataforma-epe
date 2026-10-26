// @ts-nocheck - usa módulos de Node (fs, path, assert), que el typecheck del navegador no incluye.
/* Pruebas de la lógica de «Aprendo con dinero» (módulo: logica). */
import assert from 'node:assert';
import { cargar } from './_cargar.js';
const L = cargar('logica.js');
const D = cargar('datos.js');

test('cada producto se puede pagar con billetes de práctica y tiene nivel', function () {
  D.PRODUCTOS.forEach(function (p) {
    assert.ok(L.descomponer(p.precio, L.NIVELES_PAGAR[3].bandeja), 'sin descomposición: ' + p.id);
    assert.ok([1, 2, 3].indexOf(L.nivelDeProducto(p)) !== -1, 'sin nivel: ' + p.id);
  });
});

test('cada nivel de pago tiene al menos 4 productos y solo usa billetes de su bandeja', function () {
  [1, 2, 3].forEach(function (n) {
    var lista = L.productosDeNivel(n);
    assert.ok(lista.length >= 4, 'nivel ' + n + ' tiene ' + lista.length);
    lista.forEach(function (p) {
      var d = L.descomponer(p.precio, L.NIVELES_PAGAR[n].bandeja);
      assert.ok(d, 'nivel ' + n + ' no puede pagar ' + p.id);
    });
  });
});

test('nivel 1 se paga con 1 billete y nivel 2 con 2', function () {
  L.productosDeNivel(1).forEach(function (p) {
    assert.strictEqual(L.descomponer(p.precio, L.NIVELES_PAGAR[1].bandeja).length, 1);
  });
  L.productosDeNivel(2).forEach(function (p) {
    assert.strictEqual(L.descomponer(p.precio, L.NIVELES_PAGAR[2].bandeja).length, 2);
  });
});

test('reconocer: la opción correcta siempre está, sin repetidos y sin objetivos seguidos iguales', function () {
  [1, 2, 3].forEach(function (nivel) {
    [5, 8, 10, 25].forEach(function (cant) {
      for (var semilla = 1; semilla <= 60; semilla++) {
        var rng = L.crearRng(semilla);
        var rondas = L.generarReconocer(nivel, cant, rng);
        assert.strictEqual(rondas.length, cant);
        rondas.forEach(function (r, i) {
          assert.strictEqual(r.opciones.length, L.NIVELES_RECONOCER[nivel].opciones);
          assert.ok(r.opciones.indexOf(r.objetivo) !== -1);
          assert.strictEqual(new Set(r.opciones).size, r.opciones.length);
          if (i) assert.notStrictEqual(r.objetivo, rondas[i - 1].objetivo, 'repetido seguido');
        });
      }
    });
  });
});

test('pagar: no repite producto seguido y respeta la cantidad', function () {
  [1, 2, 3].forEach(function (nivel) {
    [5, 8, 10, 25].forEach(function (cant) {
      for (var semilla = 1; semilla <= 60; semilla++) {
        var rondas = L.generarPagar(nivel, cant, L.crearRng(semilla));
        assert.strictEqual(rondas.length, cant);
        rondas.forEach(function (r, i) {
          if (i) assert.notStrictEqual(r.producto.id, rondas[i - 1].producto.id);
        });
      }
    });
  });
});

test('evaluarPago', function () {
  assert.strictEqual(L.evaluarPago(0, 500).estado, 'vacio');
  assert.deepStrictEqual(L.evaluarPago(500, 500), { estado: 'justo', diferencia: 0 });
  assert.deepStrictEqual(L.evaluarPago(300, 500), { estado: 'falta', diferencia: 200 });
  assert.deepStrictEqual(L.evaluarPago(700, 500), { estado: 'vuelto', diferencia: 200 });
});

test('ayuda graduada', function () {
  var bandeja = L.NIVELES_PAGAR[3].bandeja;
  assert.deepStrictEqual(L.siguienteAyuda(3500, [], bandeja), { accion: 'agregar', valor: 2000 });
  assert.deepStrictEqual(L.siguienteAyuda(3500, [2000], bandeja), {
    accion: 'agregar',
    valor: 1000,
  });
  assert.deepStrictEqual(L.siguienteAyuda(3500, [2000, 1000], bandeja), {
    accion: 'agregar',
    valor: 500,
  });
  assert.deepStrictEqual(L.siguienteAyuda(3500, [2000, 1000, 500], bandeja), { accion: 'listo' });
  assert.deepStrictEqual(L.siguienteAyuda(700, [1000], bandeja), { accion: 'listo' }); // pagar de más es válido
  // Con billetes ya puestos de otra forma, igual guía hacia el resto.
  assert.deepStrictEqual(L.siguienteAyuda(500, [200, 200], bandeja), {
    accion: 'agregar',
    valor: 100,
  });
});

test('la ayuda siempre llega a un pago justo siguiendo sus pasos', function () {
  D.PRODUCTOS.forEach(function (p) {
    var n = L.nivelDeProducto(p);
    var bandeja = L.NIVELES_PAGAR[n].bandeja;
    var puestos = [];
    for (var paso = 0; paso < 10; paso++) {
      var a = L.siguienteAyuda(p.precio, puestos, bandeja);
      if (a.accion === 'listo') break;
      assert.strictEqual(a.accion, 'agregar');
      puestos.push(a.valor);
    }
    assert.strictEqual(L.sumar(puestos), p.precio, 'no cierra: ' + p.id);
  });
});

test('vuelto', function () {
  assert.deepStrictEqual(L.calcularVuelto(2500, 2200), [200, 100]);
  assert.deepStrictEqual(L.calcularVuelto(1000, 700), [200, 100]);
  assert.deepStrictEqual(L.calcularVuelto(1000, 100), [500, 200, 200]);
  assert.deepStrictEqual(L.calcularVuelto(500, 500), []);
  assert.deepStrictEqual(L.calcularVuelto(300, 500), []);
  // El vuelto siempre cierra la cuenta para cualquier producto pagado con cualquier billete de más.
  D.PRODUCTOS.forEach(function (p) {
    [100, 200, 500, 1000, 2000, 10000, 20000].forEach(function (extra) {
      var total = p.precio + extra;
      assert.strictEqual(L.sumar(L.calcularVuelto(total, p.precio)), extra, p.id + ' +' + extra);
    });
  });
});

test('resumen', function () {
  var r = L.resumen([
    { errores: 0, ayudas: 0, ms: 1000 },
    { errores: 2, ayudas: 1, ms: 3000 },
    { errores: 0, ayudas: 1, ms: 2000 },
  ]);
  assert.deepStrictEqual(r, { total: 3, aPrimera: 1, errores: 2, ayudas: 2, msPromedio: 2000 });
  assert.deepStrictEqual(L.resumen([]), {
    total: 0,
    aPrimera: 0,
    errores: 0,
    ayudas: 0,
    msPromedio: 0,
  });
});

test('formato de dinero', function () {
  assert.strictEqual(L.formatearDinero(500), '$500');
  assert.strictEqual(L.formatearDinero(1500), '$1.500');
  assert.strictEqual(L.formatearDinero(20000), '$20.000');
  assert.strictEqual(L.formatearDinero(1234567), '$1.234.567');
});

test('todos los billetes de práctica aparecen y dos de $50 pagan $100', function () {
  var todos = D.BILLETES.map(function (b) {
    return b.valor;
  }).sort(function (a, b) {
    return a - b;
  });
  assert.deepStrictEqual(todos, [50, 100, 200, 500, 1000, 2000, 10000, 20000]);
  assert.deepStrictEqual(
    L.NIVELES_PAGAR[3].bandeja.slice().sort(function (a, b) {
      return a - b;
    }),
    todos,
  );
  [1, 2, 3].forEach(function (n) {
    assert.ok(L.NIVELES_RECONOCER[n].pool.indexOf(50) !== -1, '$50 en reconocer nivel ' + n);
    assert.ok(L.NIVELES_PAGAR[n].bandeja.indexOf(50) !== -1, '$50 en pagar nivel ' + n);
  });
  assert.strictEqual(L.evaluarPago(L.sumar([50, 50]), 100).estado, 'justo');
});

test('todos los billetes están en todos los niveles de reconocer y de pagar', function () {
  var todos = D.BILLETES.map(function (b) {
    return b.valor;
  });
  [1, 2, 3].forEach(function (n) {
    todos.forEach(function (v) {
      assert.ok(L.NIVELES_RECONOCER[n].pool.indexOf(v) !== -1, '$' + v + ' en reconocer nivel ' + n);
      assert.ok(L.NIVELES_PAGAR[n].bandeja.indexOf(v) !== -1, '$' + v + ' en pagar nivel ' + n);
    });
  });
});
