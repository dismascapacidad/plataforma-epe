/**
 * perfil.js
 * Sección "Perfil" del dashboard: nombre, profesión, institución.
 * Lee y guarda a través de EpeStore — no toca Supabase directamente. Todo
 * acá es async ahora: EpeStore habla por red (ver data/store.js).
 *
 * Script clásico. Namespace: EpePerfil.
 */

var EpePerfil = (function () {
  function init(root) {
    if (!root) return;

    var form = root.querySelector("[data-perfil-form]");
    var status = root.querySelector("[data-perfil-status]");
    if (!form) return;

    status.textContent = "Cargando…";
    EpeStore.getProfile()
      .then(function (datos) {
        form.elements.nombre.value = datos.nombre || "";
        form.elements.profesion.value = datos.profesion || "";
        form.elements.institucion.value = datos.institucion || "";
        status.textContent = "";
      })
      .catch(function () {
        status.textContent = "No se pudo cargar el perfil. Recargá la página.";
      });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var boton = form.querySelector("button[type=submit]");
      boton.disabled = true;
      status.textContent = "Guardando…";

      EpeStore.saveProfile({
        nombre: form.elements.nombre.value.trim(),
        profesion: form.elements.profesion.value.trim(),
        institucion: form.elements.institucion.value.trim(),
      })
        .then(function () {
          status.textContent = "Guardado.";
          window.clearTimeout(status._epeTimeout);
          status._epeTimeout = window.setTimeout(function () {
            status.textContent = "";
          }, 2000);
        })
        .catch(function () {
          status.textContent = "No se pudo guardar. Revisá tu conexión e intentá de nuevo.";
        })
        .finally(function () {
          boton.disabled = false;
        });
    });
  }

  return { init: init };
})();
