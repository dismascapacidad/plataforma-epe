// @ts-nocheck - usa módulos de Node (fs, path, assert), que el typecheck del navegador no incluye.
/* Pruebas de la lógica de «Aprendo con dinero» (módulo: medios). */
import assert from 'node:assert';
import { cargar } from './_cargar.js';
const L = cargar('logica.js');
const M = cargar('medios.js');

test('cada ronda tiene al menos un medio válido y el objetivo siempre está entre las opciones', function () {
  [1, 2, 3].forEach(function (nivel) {
    [5, 8, 10, 25].forEach(function (cant) {
      for (var semilla = 1; semilla <= 80; semilla++) {
        var rondas = M.generarMedios(nivel, cant, L.crearRng(semilla));
        assert.strictEqual(rondas.length, cant);
        rondas.forEach(function (r) {
          assert.ok(r.validos.length >= 1, 'sin válidos');
          assert.ok(r.validos.indexOf(r.objetivo) !== -1);
          assert.deepStrictEqual(r.validos, M.mediosValidos(r.acepta, r.lleva));
          assert.ok(r.opciones.indexOf(r.objetivo) !== -1);
          assert.strictEqual(new Set(r.opciones).size, r.opciones.length);
          // Hay al menos una opción que no sirve, para que elegir tenga sentido.
          assert.ok(
            r.opciones.some(function (m) {
              return r.validos.indexOf(m) === -1;
            }),
            'todas servían',
          );
        });
      }
    });
  });
});

test('niveles: cantidad de opciones y de válidas', function () {
  for (var semilla = 1; semilla <= 80; semilla++) {
    M.generarMedios(1, 10, L.crearRng(semilla)).forEach(function (r) {
      assert.strictEqual(r.opciones.length, 2);
      assert.strictEqual(r.validos.length, 1);
      assert.ok(r.opciones.indexOf('transferencia') === -1, 'nivel 1 no incluye transferencia');
      assert.ok(r.acepta.indexOf('transferencia') === -1);
    });
    M.generarMedios(2, 10, L.crearRng(semilla)).forEach(function (r) {
      assert.strictEqual(r.opciones.length, 3);
      assert.strictEqual(r.validos.length, 1);
    });
    M.generarMedios(3, 10, L.crearRng(semilla)).forEach(function (r) {
      assert.strictEqual(r.opciones.length, 4);
      assert.ok(r.validos.length >= 1 && r.validos.length <= 2);
    });
  }
});

test('los medios objetivo, comercios y productos no se repiten seguidos y se recorren todos', function () {
  [2, 3].forEach(function (nivel) {
    for (var semilla = 1; semilla <= 40; semilla++) {
      var rondas = M.generarMedios(nivel, 8, L.crearRng(semilla));
      rondas.forEach(function (r, i) {
        if (!i) return;
        assert.notStrictEqual(r.objetivo, rondas[i - 1].objetivo);
        assert.notStrictEqual(r.comercio.id, rondas[i - 1].comercio.id);
        assert.notStrictEqual(r.producto.id, rondas[i - 1].producto.id);
      });
      assert.strictEqual(
        new Set(
          rondas.map(function (r) {
            return r.objetivo;
          }),
        ).size,
        4,
        'faltó algún medio',
      );
    }
  });
});

test('motivo de rechazo', function () {
  assert.strictEqual(M.motivoRechazo('qr', ['efectivo'], ['billetes', 'celular']), 'no-acepta');
  assert.strictEqual(M.motivoRechazo('debito', ['efectivo', 'debito'], ['billetes']), 'no-lleva');
  assert.strictEqual(M.motivoRechazo('efectivo', ['efectivo'], ['billetes']), null);
  // QR y transferencia comparten el celular.
  assert.deepStrictEqual(M.mediosValidos(['qr', 'transferencia'], ['celular']), [
    'qr',
    'transferencia',
  ]);
  assert.deepStrictEqual(M.mediosValidos(['qr', 'transferencia'], ['tarjeta']), []);
});

test('alias: el correcto está una sola vez y los otros son de otros comercios', function () {
  M.COMERCIOS.forEach(function (c) {
    for (var semilla = 1; semilla <= 30; semilla++) {
      var op = M.opcionesAlias(c, L.crearRng(semilla));
      assert.strictEqual(op.length, 3);
      assert.strictEqual(
        new Set(
          op.map(function (o) {
            return o.alias;
          }),
        ).size,
        3,
      );
      assert.strictEqual(
        op.filter(function (o) {
          return o.alias === c.alias;
        }).length,
        1,
      );
      op.forEach(function (o) {
        assert.strictEqual(M.titularDeAlias(o.alias), o.titular);
      });
      assert.strictEqual(M.respuestaVerificar(c, c.alias), 'si');
      op.filter(function (o) {
        return o.alias !== c.alias;
      }).forEach(function (o) {
        assert.strictEqual(M.respuestaVerificar(c, o.alias), 'no');
      });
    }
  });
});

test('importes: el precio está, sin repetidos, y todos son enteros positivos', function () {
  cargar('datos.js').PRODUCTOS.forEach(function (p) {
    var op = M.opcionesImporte(p.precio, L.crearRng(p.precio));
    assert.ok(op.indexOf(p.precio) !== -1);
    assert.strictEqual(new Set(op).size, op.length);
    assert.ok(op.length >= 2);
    op.forEach(function (v) {
      assert.ok(Number.isInteger(v) && v > 0, p.id + ' ' + v);
    });
  });
});

test('flujos: pasos válidos, ids únicos por flujo y transferencia completa', function () {
  var TIPOS = ['tocar', 'arrastrar', 'espera', 'sino', 'alias', 'importe'];
  Object.keys(M.FLUJOS).forEach(function (medio) {
    var ids = M.FLUJOS[medio].map(function (p) {
      return p.id;
    });
    assert.strictEqual(new Set(ids).size, ids.length, medio);
    M.FLUJOS[medio].forEach(function (p) {
      assert.ok(TIPOS.indexOf(p.tipo) !== -1, medio + '.' + p.id);
      assert.ok(p.vista, medio + '.' + p.id + ' sin vista');
      if (p.tipo === 'arrastrar') assert.ok(p.objeto && p.zona);
    });
  });
  assert.deepStrictEqual(
    M.FLUJOS.transferencia.map(function (p) {
      return p.id;
    }),
    ['abrir', 'menu', 'alias', 'verificar', 'importe', 'confirmar', 'comprobante'],
  );
  assert.deepStrictEqual(Object.keys(M.FLUJOS).sort(), M.MEDIOS.slice().sort());
});

test('alias por partes: 3 opciones distintas por parte, y se puede armar el alias correcto', function () {
  M.COMERCIOS.forEach(function (c) {
    for (var semilla = 1; semilla <= 30; semilla++) {
      var op = M.opcionesAliasPartes(c, L.crearRng(semilla));
      var correcta = M.aliasPartes(c.alias);
      assert.strictEqual(op.primeras.length, 3);
      assert.strictEqual(op.segundas.length, 3);
      assert.strictEqual(new Set(op.primeras).size, 3);
      assert.strictEqual(new Set(op.segundas).size, 3);
      assert.ok(
        op.primeras.indexOf(correcta.primera) !== -1 &&
          op.segundas.indexOf(correcta.segunda) !== -1,
      );
      var r = M.resolverAlias(correcta.primera, correcta.segunda);
      assert.ok(r.existe);
      assert.strictEqual(r.alias, c.alias);
      assert.strictEqual(r.titular, c.nombre);
    }
  });
  // Combinaciones: de otro comercio, o que no existe.
  assert.ok(M.resolverAlias('kiosco', 'estrella').existe);
  assert.strictEqual(M.resolverAlias('kiosco', 'donpepe').existe, false);
  assert.strictEqual(M.resolverAlias('kiosco', 'donpepe').titular, null);
});

test('frases: la correcta está y son 3 medios distintos', function () {
  M.MEDIOS.forEach(function (m) {
    for (var semilla = 1; semilla <= 20; semilla++) {
      var f = M.opcionesFrases(m, L.crearRng(semilla));
      assert.strictEqual(f.length, 3);
      assert.strictEqual(new Set(f).size, 3);
      assert.ok(f.indexOf(m) !== -1);
    }
  });
});

test('billetera de efectivo: alcanza justo con los necesarios, y el extra obliga a pedir vuelto', function () {
  cargar('datos.js').PRODUCTOS.forEach(function (p) {
    var b = M.billeteraEfectivo(p.precio, L.crearRng(p.precio));
    assert.strictEqual(L.sumar(b.necesarios), p.precio, p.id);
    assert.strictEqual(b.billetes.length, b.necesarios.length + (b.extra ? 1 : 0));
    if (b.extra) {
      assert.ok(b.extra > p.precio);
      assert.strictEqual(L.sumar(L.calcularVuelto(b.extra, p.precio)), b.extra - p.precio);
    }
  });
});

test('teclado guiado y clave de práctica', function () {
  assert.ok(/^\d{4}$/.test(M.PIN_PRACTICA));
  var pin = M.PIN_PRACTICA;
  var tecleado = '';
  for (var i = 0; i < 4; i++) {
    var sig = M.siguienteTecla(pin, tecleado);
    assert.strictEqual(sig, pin.charAt(i));
    tecleado += sig;
  }
  assert.strictEqual(M.siguienteTecla(pin, tecleado), null);
  assert.strictEqual(M.siguienteTecla(pin, '0'), 'borrar');
  assert.strictEqual(M.siguienteTecla('3500', '35'), '0');
  assert.strictEqual(M.siguienteTecla('3500', '36'), 'borrar');
});

test('pasos con gesto: ids válidos', function () {
  var GESTOS = ['dispositivo', 'billetera', 'vuelto', 'frases', 'clave', 'partes', 'importe'];
  Object.keys(M.FLUJOS).forEach(function (m) {
    M.FLUJOS[m].forEach(function (p) {
      if (p.gesto) assert.ok(GESTOS.indexOf(p.gesto) !== -1, m + '.' + p.id);
    });
  });
  // Todo paso de tipo "tocar" tiene una forma de hacerse con gestos.
  Object.keys(M.FLUJOS).forEach(function (m) {
    M.FLUJOS[m].forEach(function (p) {
      if (p.tipo === 'tocar') assert.ok(p.gesto, m + '.' + p.id + ' sin gesto');
    });
  });
});
