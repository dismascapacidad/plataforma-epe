/**
 * solicitudes-admin.js
 * Pestaña "Solicitudes de admin" del panel de staff: profesionales que
 * pidieron ser administradores de su institución (autosolicitud), o que
 * un administrador saliente sugirió como su reemplazo (sugerencia) —
 * ver supabase/016_admin_institucion.sql. dis+capacidad confirma a la
 * persona por fuera de la plataforma (mensaje + teléfono) antes de
 * aprobar.
 *
 * Mismo patrón que pendientes.js: lista + acciones por fila.
 * Script clásico (ver theme.js). Namespace: EpeAdminSolicitudes.
 */

var EpeAdminSolicitudes = (function () {
  var root;

  function init(rootEl) {
    root = rootEl;
    if (!root) return;
    cargar();
  }

  function cargar() {
    var ul = root.querySelector("[data-admin-solicitudes-lista]");
    var vacio = root.querySelector("[data-admin-solicitudes-vacio]");
    ul.innerHTML = '<li class="epe-vacio">Cargando…</li>';

    EpeAdminStore.listarSolicitudesAdmin()
      .then(function (solicitudes) {
        ul.innerHTML = "";
        vacio.hidden = solicitudes.length > 0;
        solicitudes.forEach(function (sol) {
          ul.appendChild(construirItem(sol));
        });
      })
      .catch(function () {
        ul.innerHTML = '<li class="epe-vacio">No se pudieron cargar las solicitudes.</li>';
      });
  }

  function construirItem(sol) {
    var li = document.createElement("li");
    li.className = "epe-compartir-item";

    var texto = document.createElement("span");
    var origenTexto =
      sol.origen === "sugerencia"
        ? "sugerido/a por " + (sol.sugerido_por_nombre || "otro administrador") + " como reemplazo al irse"
        : "pidió ser administrador/a";
    texto.textContent = (sol.profile_nombre || sol.profile_email) + " — " + origenTexto + ' de "' + sol.institucion_nombre + '"';
    li.appendChild(texto);

    if (sol.mensaje) {
      var mensaje = document.createElement("p");
      mensaje.className = "epe-panel-sub";
      mensaje.textContent = '"' + sol.mensaje + '"';
      li.appendChild(mensaje);
    }
    if (sol.telefono) {
      var telefono = document.createElement("p");
      telefono.className = "epe-panel-sub";
      telefono.textContent = "Teléfono de contacto: " + sol.telefono;
      li.appendChild(telefono);
    }

    var aprobar = document.createElement("button");
    aprobar.type = "button";
    aprobar.className = "epe-btn-acc epe-btn-sm";
    aprobar.textContent = "Aprobar";
    aprobar.addEventListener("click", function () {
      aprobar.disabled = true;
      EpeAdminStore.aprobarAdmin(sol.id)
        .then(function () {
          cargar();
        })
        .catch(function (err) {
          window.alert("No se pudo aprobar." + (err && err.message ? " (" + err.message + ")" : ""));
          aprobar.disabled = false;
        });
    });
    li.appendChild(aprobar);

    var rechazar = document.createElement("button");
    rechazar.type = "button";
    rechazar.className = "epe-btn-ghost epe-btn-sm";
    rechazar.textContent = "Rechazar";
    rechazar.addEventListener("click", function () {
      var motivo = window.prompt("Motivo del rechazo (opcional, no lo ve el profesional desde la plataforma):", "");
      if (motivo === null) return; // canceló
      rechazar.disabled = true;
      EpeAdminStore.rechazarAdmin(sol.id, motivo)
        .then(function () {
          cargar();
        })
        .catch(function (err) {
          window.alert("No se pudo rechazar." + (err && err.message ? " (" + err.message + ")" : ""));
          rechazar.disabled = false;
        });
    });
    li.appendChild(rechazar);

    return li;
  }

  return { init: init };
})();
