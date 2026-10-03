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
    // epe-institucion-item además de la base compartida: alinea nombre /
    // aviso de admin / botón en columnas (ver css/features/admin/dashboard.css)
    // — solo afecta esta lista, no a pendientes.js ni a la de admins anidada.
    li.className = "epe-compartir-item epe-institucion-item";

    var texto = document.createElement("span");
    texto.className = "epe-institucion-nombre";
    texto.textContent = inst.nombre + " — código: " + inst.codigo_acceso;
    li.appendChild(texto);

    // Aviso si nadie confirmó todavía el rol de administrador para esta
    // institución (ver supabase/016_admin_institucion.sql) — ayuda al
    // staff a saber dónde falta resolver una solicitud o, directamente,
    // dónde todavía no la pidió nadie.
    if (!inst.cantidad_admins_activos) {
      var aviso = document.createElement("span");
      aviso.className = "epe-field-hint-aviso";
      aviso.textContent = "Sin administrador confirmado";
      li.appendChild(aviso);
    }

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

    // Administradores: plegado por defecto (ver_admins_institucion_staff
    // en supabase/016_admin_institucion.sql) — solo quitar el ROL, nunca
    // la pertenencia a la institución (eso lo hace un admin activo, o la
    // propia persona desde su perfil).
    var detalleAdmins = document.createElement("details");
    var resumenAdmins = document.createElement("summary");
    resumenAdmins.textContent = "Administradores";
    detalleAdmins.appendChild(resumenAdmins);
    var listaAdmins = document.createElement("ul");
    listaAdmins.className = "epe-compartir-lista";
    detalleAdmins.appendChild(listaAdmins);
    detalleAdmins.addEventListener(
      "toggle",
      function () {
        if (!detalleAdmins.open) return;
        cargarAdmins(inst, listaAdmins);
      },
      { once: true }
    );
    li.appendChild(detalleAdmins);

    return li;
  }

  function cargarAdmins(inst, listaAdmins) {
    listaAdmins.innerHTML = '<li class="epe-vacio">Cargando…</li>';
    EpeAdminStore.listarAdminsInstitucion(inst.id)
      .then(function (admins) {
        listaAdmins.innerHTML = "";
        if (admins.length === 0) {
          listaAdmins.innerHTML = '<li class="epe-vacio">Sin administradores confirmados.</li>';
          return;
        }
        admins.forEach(function (admin) {
          var li = document.createElement("li");
          li.className = "epe-compartir-item";
          var texto = document.createElement("span");
          texto.textContent = (admin.nombre || admin.email) + (admin.estado === "congelado" ? " (dejando la institución)" : "");
          li.appendChild(texto);

          var quitar = document.createElement("button");
          quitar.type = "button";
          quitar.className = "epe-btn-ghost epe-btn-sm";
          quitar.textContent = "Quitar rol de admin";
          quitar.addEventListener("click", function () {
            if (!window.confirm("¿Sacarle el rol de administrador a " + (admin.nombre || admin.email) + "? Sigue siendo profesional de la institución, solo deja de administrarla.")) return;
            quitar.disabled = true;
            EpeAdminStore.quitarAdmin(inst.id, admin.profile_id)
              .then(function () {
                cargarAdmins(inst, listaAdmins);
                cargar();
              })
              .catch(function (err) {
                window.alert("No se pudo quitar el rol." + (err && err.message ? " (" + err.message + ")" : ""));
                quitar.disabled = false;
              });
          });
          li.appendChild(quitar);
          listaAdmins.appendChild(li);
        });
      })
      .catch(function () {
        listaAdmins.innerHTML = '<li class="epe-vacio">No se pudieron cargar los administradores.</li>';
      });
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
