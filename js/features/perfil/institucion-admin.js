/**
 * institucion-admin.js
 * Pestaña "Mi institución" del espacio personal — solo visible para
 * quien es administrador de alguna institución (ver
 * supabase/016_admin_institucion.sql). Un admin tiene los mismos
 * accesos que cualquier profesional; lo único propio de acá es poder
 * sumar/quitar profesionales de SU institución.
 *
 * "Sugerir reemplazo" al dejar la institución vive en perfil.js (es
 * parte de la acción "Dejar la institución" de esa pestaña, no de
 * esta) — acá solo se administra mientras seguís activo.
 *
 * Script clásico. Namespace: EpeMiInstitucion.
 */

var EpeMiInstitucion = (function () {
  function detalleError(err) {
    var msg = err && (err.message || err.error_description || err.msg);
    return msg ? " (" + msg + ")" : "";
  }

  function construirBloqueCongelado(inst) {
    var div = document.createElement("div");
    div.className = "epe-panel";
    var h3 = document.createElement("h3");
    h3.textContent = inst.institucion_nombre;
    var p = document.createElement("p");
    p.className = "epe-field-hint-aviso";
    p.textContent = "Te estás yendo de esta institución — no podés agregar ni quitar profesionales mientras se confirma tu reemplazo (ver la pestaña Perfil).";
    div.appendChild(h3);
    div.appendChild(p);
    return div;
  }

  function construirBloqueActivo(inst, onCambio) {
    var div = document.createElement("div");
    div.className = "epe-panel";

    var h3 = document.createElement("h3");
    h3.textContent = inst.institucion_nombre;
    div.appendChild(h3);

    if (Number(inst.admins_activos) <= 1) {
      var aviso = document.createElement("p");
      aviso.className = "epe-field-hint-aviso";
      aviso.textContent = "Sos el único administrador activo de esta institución.";
      div.appendChild(aviso);
    }

    var listaColegas = document.createElement("ul");
    listaColegas.className = "epe-compartir-lista";
    listaColegas.innerHTML = '<li class="epe-vacio">Cargando…</li>';
    div.appendChild(listaColegas);

    function cargarColegas() {
      EpeStore.listarColegasInstitucion(inst.institucion_id)
        .then(function (colegas) {
          listaColegas.innerHTML = "";
          if (colegas.length === 0) {
            listaColegas.innerHTML = '<li class="epe-vacio">No hay otros profesionales verificados en esta institución.</li>';
            return;
          }
          colegas.forEach(function (colega) {
            var li = document.createElement("li");
            li.className = "epe-compartir-item";

            var texto = document.createElement("span");
            texto.textContent = (colega.nombre || colega.email) + (colega.profesion ? " — " + colega.profesion : "");
            li.appendChild(texto);

            var quitar = document.createElement("button");
            quitar.type = "button";
            quitar.className = "epe-btn-ghost epe-btn-sm";
            quitar.textContent = "Quitar de la institución";
            quitar.addEventListener("click", function () {
              if (
                !window.confirm(
                  "¿Quitar a " +
                    (colega.nombre || colega.email) +
                    ' de "' +
                    inst.institucion_nombre +
                    '"? Sus colecciones compartidas con la institución van a pasar a ser tuyas — las que no estaban compartidas con ella siguen siendo de esa persona.'
                )
              ) {
                return;
              }
              quitar.disabled = true;
              EpeStore.quitarDeInstitucion(inst.institucion_id, colega.profile_id)
                .then(function () {
                  cargarColegas();
                })
                .catch(function (err) {
                  window.alert("No se pudo quitar." + detalleError(err));
                  quitar.disabled = false;
                });
            });
            li.appendChild(quitar);

            listaColegas.appendChild(li);
          });
        })
        .catch(function () {
          listaColegas.innerHTML = '<li class="epe-vacio">No se pudieron cargar los profesionales de la institución.</li>';
        });
    }
    cargarColegas();

    // Agregar por correo: dos pasos (buscar y confirmar) para no sumar a
    // nadie sin que el admin vea antes a quién está agregando.
    var form = document.createElement("form");
    form.className = "epe-inline-form";
    var inputEmail = document.createElement("input");
    inputEmail.type = "email";
    inputEmail.placeholder = "Correo del profesional";
    inputEmail.required = true;
    var btnBuscar = document.createElement("button");
    btnBuscar.type = "submit";
    btnBuscar.className = "epe-btn-ghost epe-btn-sm";
    btnBuscar.textContent = "Buscar";
    var statusBuscar = document.createElement("span");
    statusBuscar.className = "epe-form-status";
    form.appendChild(inputEmail);
    form.appendChild(btnBuscar);
    form.appendChild(statusBuscar);
    div.appendChild(form);

    var resultado = document.createElement("div");
    div.appendChild(resultado);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = inputEmail.value.trim();
      if (!email) return;
      btnBuscar.disabled = true;
      statusBuscar.textContent = "Buscando…";
      resultado.innerHTML = "";
      EpeStore.buscarProfesionalPorEmail(inst.institucion_id, email)
        .then(function (encontrado) {
          statusBuscar.textContent = "";
          if (!encontrado) {
            resultado.textContent = "No hay ninguna cuenta con ese correo en la plataforma.";
            return;
          }
          var p = document.createElement("p");
          p.textContent = (encontrado.nombre || "Sin nombre") + (encontrado.profesion ? " — " + encontrado.profesion : "") + ". ¿Agregarlo a la institución?";
          var btnConfirmar = document.createElement("button");
          btnConfirmar.type = "button";
          btnConfirmar.className = "epe-btn-acc epe-btn-sm";
          btnConfirmar.textContent = "Confirmar y agregar";
          btnConfirmar.addEventListener("click", function () {
            btnConfirmar.disabled = true;
            EpeStore.agregarProfesionalAInstitucion(inst.institucion_id, encontrado.profile_id)
              .then(function () {
                resultado.innerHTML = "";
                form.reset();
                cargarColegas();
                if (onCambio) onCambio();
              })
              .catch(function (err) {
                window.alert("No se pudo agregar." + detalleError(err));
                btnConfirmar.disabled = false;
              });
          });
          resultado.appendChild(p);
          resultado.appendChild(btnConfirmar);
        })
        .catch(function (err) {
          statusBuscar.textContent = "No se pudo buscar." + detalleError(err);
        })
        .finally(function () {
          btnBuscar.disabled = false;
        });
    });

    return div;
  }

  function init(tabBtn, contenedor) {
    if (!contenedor) return Promise.resolve();

    return EpeStore.misInstituciones().then(function (mias) {
      var dondeSoyAdmin = mias.filter(function (m) {
        return m.admin_estado === "activo" || m.admin_estado === "congelado";
      });

      if (tabBtn) tabBtn.hidden = dondeSoyAdmin.length === 0;
      if (dondeSoyAdmin.length === 0) return;

      contenedor.innerHTML = "";
      dondeSoyAdmin.forEach(function (inst) {
        if (inst.admin_estado === "congelado") {
          contenedor.appendChild(construirBloqueCongelado(inst));
        } else {
          contenedor.appendChild(
            construirBloqueActivo(inst, function () {
              init(tabBtn, contenedor);
            })
          );
        }
      });
    });
  }

  return { init: init };
})();
