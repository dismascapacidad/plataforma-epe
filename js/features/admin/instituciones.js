/**
 * instituciones.js
 * Pestaña "Instituciones" del panel de staff: alta de instituciones
 * (genera el código de acceso solo) y lista de las existentes con su
 * código, para poder reenviarlo o regenerarlo si se pierde o se filtra.
 *
 * Script clásico (ver theme.js). Namespace: EpeAdminInstituciones.
 */

var EpeAdminInstituciones = (function () {
  var root;

  function init(rootEl) {
    root = rootEl;
    if (!root) return;

    root.querySelector("[data-admin-institucion-form]").addEventListener("submit", onCrear);
    cargar();
  }

  function cargar() {
    var ul = root.querySelector("[data-admin-instituciones-lista]");
    ul.innerHTML = '<li class="epe-vacio">Cargando…</li>';

    EpeAdminStore.listarInstituciones()
      .then(function (instituciones) {
        ul.innerHTML = "";
        if (instituciones.length === 0) {
          ul.innerHTML = '<li class="epe-vacio">Todavía no hay instituciones cargadas.</li>';
          return;
        }
        instituciones.forEach(function (inst) {
          ul.appendChild(construirItem(inst));
        });
      })
      .catch(function () {
        ul.innerHTML = '<li class="epe-vacio">No se pudieron cargar las instituciones.</li>';
      });
  }

  function construirItem(inst) {
    var li = document.createElement("li");
    li.className = "epe-compartir-item";

    var texto = document.createElement("span");
    texto.textContent = inst.nombre + " — código: " + inst.codigo_acceso;
    li.appendChild(texto);

    var regenerar = document.createElement("button");
    regenerar.type = "button";
    regenerar.className = "epe-btn-ghost epe-btn-sm";
    regenerar.textContent = "Regenerar código";
    regenerar.addEventListener("click", function () {
      if (!window.confirm('¿Regenerar el código de "' + inst.nombre + '"? El código viejo deja de servir.')) return;
      regenerar.disabled = true;
      EpeAdminStore.regenerarCodigo(inst.id)
        .then(function () {
          cargar();
        })
        .catch(function () {
          window.alert("No se pudo regenerar el código.");
          regenerar.disabled = false;
        });
    });
    li.appendChild(regenerar);

    return li;
  }

  function onCrear(ev) {
    ev.preventDefault();
    var form = ev.target;
    var nombre = form.elements.nombre.value.trim();
    if (!nombre) return;

    var status = root.querySelector("[data-admin-institucion-status]");
    var boton = form.querySelector("button[type=submit]");
    boton.disabled = true;
    status.textContent = "Creando…";

    EpeAdminStore.crearInstitucion(nombre)
      .then(function () {
        form.reset();
        status.textContent = "Creada.";
        window.setTimeout(function () {
          status.textContent = "";
        }, 2000);
        cargar();
      })
      .catch(function (err) {
        var msg = err && err.message ? " (" + err.message + ")" : "";
        status.textContent = "No se pudo crear." + msg;
      })
      .finally(function () {
        boton.disabled = false;
      });
  }

  return { init: init };
})();
