/**
 * pendientes.js
 * Pestaña "Pendientes" del panel de staff: profesionales que eligieron una
 * institución que todavía no existe en el catálogo (institucion_pendiente),
 * o que eligieron una institución real pero no la verificaron con el
 * código.
 *
 * Script clásico (ver theme.js). Namespace: EpeAdminPendientes.
 */

var EpeAdminPendientes = (function () {
  var root;
  var instituciones = [];

  function init(rootEl) {
    root = rootEl;
    if (!root) return;
    cargar();
  }

  function cargar() {
    var ul = root.querySelector("[data-admin-pendientes-lista]");
    var vacio = root.querySelector("[data-admin-pendientes-vacio]");
    ul.innerHTML = '<li class="epe-vacio">Cargando…</li>';

    Promise.all([EpeAdminStore.pendientes(), EpeAdminStore.listarInstituciones()])
      .then(function (resultados) {
        var perfiles = resultados[0];
        instituciones = resultados[1];

        ul.innerHTML = "";
        vacio.hidden = perfiles.length > 0;
        perfiles.forEach(function (perfil) {
          ul.appendChild(construirItem(perfil));
        });
      })
      .catch(function () {
        ul.innerHTML = '<li class="epe-vacio">No se pudieron cargar los pendientes.</li>';
      });
  }

  function construirItem(perfil) {
    var li = document.createElement("li");
    li.className = "epe-compartir-item";

    var texto = document.createElement("span");
    var detalle = perfil.institucion_pendiente
      ? 'pidió "' + perfil.institucion_pendiente + '" (no existe en el catálogo todavía)'
      : "eligió una institución pero no la verificó con el código";
    texto.textContent = (perfil.nombre || perfil.email) + " — " + detalle;
    li.appendChild(texto);

    if (perfil.institucion_pendiente) {
      var darDeAlta = document.createElement("button");
      darDeAlta.type = "button";
      darDeAlta.className = "epe-btn-ghost epe-btn-sm";
      darDeAlta.textContent = "Dar de alta y verificar";
      darDeAlta.addEventListener("click", function () {
        darDeAlta.disabled = true;
        EpeAdminStore.crearInstitucion(perfil.institucion_pendiente)
          .then(function (inst) {
            return EpeAdminStore.verificarManual(perfil.id, inst.id);
          })
          .then(function () {
            cargar();
          })
          .catch(function () {
            window.alert("No se pudo resolver automáticamente (puede que ya exista una institución con ese nombre) — probá desde la pestaña Instituciones.");
            darDeAlta.disabled = false;
          });
      });
      li.appendChild(darDeAlta);
    } else {
      var select = document.createElement("select");
      var optionVacia = document.createElement("option");
      optionVacia.value = "";
      optionVacia.textContent = "Marcar verificado en…";
      select.appendChild(optionVacia);
      instituciones.forEach(function (inst) {
        var option = document.createElement("option");
        option.value = inst.id;
        option.textContent = inst.nombre;
        select.appendChild(option);
      });
      select.addEventListener("change", function () {
        if (!select.value) return;
        select.disabled = true;
        EpeAdminStore.verificarManual(perfil.id, select.value)
          .then(function () {
            cargar();
          })
          .catch(function () {
            window.alert("No se pudo verificar.");
            select.disabled = false;
          });
      });
      li.appendChild(select);
    }

    return li;
  }

  return { init: init };
})();
