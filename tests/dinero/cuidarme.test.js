// @ts-nocheck - usa módulos de Node (fs, path, assert), que el typecheck del navegador no incluye.
/* Pruebas de la lógica de «Aprendo con dinero» (módulo: cuidarme). */
import assert from 'node:assert';
import { cargar, cargarTextos } from './_cargar.js';
const L = cargar('logica.js');
const C = cargar('cuidarme.js');

test('escenas por nivel: 3, 6 y 8, y todas usan una de las 3 reglas', function () {
  assert.strictEqual(C.escenasDeNivel(1).length, 3);
  assert.strictEqual(C.escenasDeNivel(2).length, 6);
  assert.strictEqual(C.escenasDeNivel(3).length, 8);
  assert.deepStrictEqual(
    C.escenasDeNivel(1).map(function (e) {
      return e.id;
    }),
    ['clave', 'llamada', 'nombre'],
  );
  C.ESCENAS.forEach(function (e) {
    assert.ok(C.REGLAS.indexOf(e.regla) !== -1, e.id);
    assert.ok(e.icono);
  });
  assert.strictEqual(
    new Set(
      C.ESCENAS.map(function (e) {
        return e.id;
      }),
    ).size,
    C.ESCENAS.length,
  );
});

test('rondas: solo escenas del nivel, sin repetir seguidas, 3 opciones (bien, dudosa, mal) y pista salvo en el nivel 3', function () {
  [1, 2, 3].forEach(function (nivel) {
    [5, 8, 10].forEach(function (cant) {
      for (var semilla = 1; semilla <= 40; semilla++) {
        var rondas = C.generarCuidarme(nivel, cant, L.crearRng(semilla));
        assert.strictEqual(rondas.length, cant);
        var permitidas = C.escenasDeNivel(nivel).map(function (e) {
          return e.id;
        });
        rondas.forEach(function (r, i) {
          assert.ok(permitidas.indexOf(r.escena.id) !== -1);
          assert.deepStrictEqual(r.opciones.slice().sort(), ['bien', 'dudosa', 'mal']);
          assert.strictEqual(r.conPista, nivel < 3);
          if (i) assert.notStrictEqual(r.escena.id, rondas[i - 1].escena.id);
        });
      }
    });
  });
});

test('el nivel 1 con 3 ejercicios recorre las 3 escenas', function () {
  var ids = C.generarCuidarme(1, 3, L.crearRng(7)).map(function (r) {
    return r.escena.id;
  });
  assert.strictEqual(new Set(ids).size, 3);
});

test('textos: cada escena tiene todos los textos en el diccionario', function () {
  const textos = cargarTextos().textos;
  C.ESCENAS.forEach(function (e) {
    ['quien', 'dice', 'bien', 'dudosa', 'mal', 'bien.exp', 'dudosa.exp', 'mal.exp'].forEach(
      function (k) {
        var clave = 'cu.' + e.id + '.' + k;
        assert.ok(textos[clave] && textos[clave].length > 3, 'falta ' + clave);
      },
    );
  });
  C.REGLAS.forEach(function (r) {
    assert.ok(textos['cu.regla.' + r] && textos['cu.regla.' + r + '.sub'], 'falta regla ' + r);
  });
});
