// @ts-nocheck - usa módulos de Node (fs, path, assert), que el typecheck del navegador no incluye.
/* Pruebas de la lógica de «Aprendo con dinero» (módulo: super). */
import assert from 'node:assert';
import { cargar } from './_cargar.js';
const L = cargar('logica.js');
const S = cargar('supermercado.js');
const Datos = cargar('datos.js');

test('nivel 1: el paso que sigue está entre las opciones, sin repetidos, y es el siguiente de lo último hecho', function () {
  [5, 8, 10].forEach(function (cant) {
    for (var semilla = 1; semilla <= 60; semilla++) {
      var rondas = S.generarSuper(1, cant, L.crearRng(semilla));
      assert.strictEqual(rondas.length, cant);
      rondas.forEach(function (r, i) {
        assert.strictEqual(r.tipo, 'siguiente');
        assert.strictEqual(r.opciones.length, 3);
        assert.strictEqual(new Set(r.opciones).size, 3);
        assert.ok(r.opciones.indexOf(r.correcto) !== -1);
        var ultimo = r.hechos[r.hechos.length - 1];
        assert.strictEqual(S.PASOS.indexOf(r.correcto), S.PASOS.indexOf(ultimo) + 1);
        assert.ok(r.hechos.length >= 1 && r.hechos.length <= 3);
        // El paso ya hecho más reciente no es una opción: evita una respuesta ambigua.
        assert.ok(r.opciones.indexOf(ultimo) === -1);
        if (i) assert.notStrictEqual(r.correcto, rondas[i - 1].correcto);
      });
    }
  });
});

test('nivel 2: tramos consecutivos, mezclados y nunca ya ordenados', function () {
  for (var semilla = 1; semilla <= 60; semilla++) {
    S.generarSuper(2, 8, L.crearRng(semilla)).forEach(function (r) {
      assert.strictEqual(r.orden.length, 4);
      var ini = S.PASOS.indexOf(r.orden[0]);
      assert.deepStrictEqual(r.orden, S.PASOS.slice(ini, ini + 4));
      assert.strictEqual(r.mezcla.slice().sort().join(), r.orden.slice().sort().join());
      assert.notStrictEqual(r.mezcla.join(), r.orden.join());
      // Ordenando uno por uno se llega al final.
      var colocados = [];
      for (var k = 0; k < r.orden.length; k++) {
        var p = S.proximoCorrecto(r.orden, colocados);
        assert.strictEqual(p, r.orden[k]);
        colocados.push(p);
      }
      assert.strictEqual(S.proximoCorrecto(r.orden, colocados), null);
    });
  }
});

test('nivel 3: viajes (5→2, 8→3, 10→4), 3 productos de pasillos distintos, estantes y total coherentes', function () {
  assert.strictEqual(S.viajesDe(5), 2);
  assert.strictEqual(S.viajesDe(8), 3);
  assert.strictEqual(S.viajesDe(10), 4);
  [5, 8, 10].forEach(function (cant) {
    for (var semilla = 1; semilla <= 60; semilla++) {
      var viajes = S.generarSuper(3, cant, L.crearRng(semilla));
      assert.strictEqual(viajes.length, S.viajesDe(cant));
      viajes.forEach(function (v) {
        assert.strictEqual(v.tipo, 'minisuper');
        assert.strictEqual(v.lista.length, 3);
        assert.strictEqual(
          new Set(
            v.lista.map(function (it) {
              return it.pasillo;
            }),
          ).size,
          3,
        );
        v.lista.forEach(function (it) {
          assert.strictEqual(S.pasilloDe(it.producto.id), it.pasillo);
          assert.ok(it.estante.indexOf(it.producto.id) !== -1, 'el producto está en su estante');
          assert.ok(it.estante.length >= 2);
          assert.strictEqual(new Set(it.estante).size, it.estante.length);
        });
        assert.strictEqual(
          v.total,
          L.sumar(
            v.lista.map(function (it) {
              return it.producto.precio;
            }),
          ),
        );
        assert.ok(v.opcionesTotal.indexOf(v.total) !== -1);
        assert.strictEqual(new Set(v.opcionesTotal).size, v.opcionesTotal.length);
        assert.ok(v.opcionesTotal.length >= 2);
        v.opcionesTotal.forEach(function (o) {
          assert.ok(Number.isInteger(o) && o > 0);
        });
      });
    }
  });
});

test('datos: todos los productos de los pasillos existen y cada pasillo tiene un ícono', function () {
  S.IDS_PASILLOS.forEach(function (p) {
    assert.ok(S.ICONO_PASILLO[p]);
    S.PASILLOS[p].forEach(function (id) {
      assert.ok(
        Datos.PRODUCTOS.some(function (x) {
          return x.id === id;
        }),
        id,
      );
    });
  });
  // Ningún producto está en dos pasillos.
  var todos = [].concat.apply(
    [],
    S.IDS_PASILLOS.map(function (p) {
      return S.PASILLOS[p];
    }),
  );
  assert.strictEqual(new Set(todos).size, todos.length);
});

test('cada compra del mini-súper tiene un medio de pago y el pago usa el total real', function () {
  const S = cargar('supermercado.js');
  const M = cargar('medios.js');
  const L = cargar('logica.js');
  const viajes = S.generarMiniSuper(4, L.crearRng(7));
  assert.strictEqual(viajes.length, 4);
  viajes.forEach(function (v, k) {
    assert.ok(M.MEDIOS.indexOf(v.pago) !== -1, 'medio inválido');
    if (k > 0) assert.notStrictEqual(v.pago, viajes[k - 1].pago, 'mismo medio seguido');
    const r = M.armarRondaPago(v.total, v.pago, L.crearRng(k));
    assert.strictEqual(r.precio, v.total);
    assert.strictEqual(r.objetivo, v.pago);
    assert.deepStrictEqual(r.validos, [v.pago]);
    assert.strictEqual(r.fijo, true);
    assert.strictEqual(r.comercio.id, 'norte');
    assert.ok(r.importeOpciones.indexOf(v.total) !== -1, 'el importe correcto no está');
    assert.strictEqual(L.sumar(r.billetera.necesarios), v.total, 'la billetera no suma el total');
  });
});
