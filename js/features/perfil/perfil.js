/**
 * perfil.js
 * Sección "Perfil" del dashboard: nombre, profesión, institución.
 * Lee y guarda a través de EpeStore — no toca localStorage directamente.
 *
 * Script clásico. Namespace: EpePerfil.
 */

var EpePerfil = (function () {
  function init(root) {
    if (!root) return;

    var form = root.querySelector("[data-perfil-form]");
    var status = root.querySelector("[data-perfil-status]");
    if (!form) return;

    var datos = EpeStore.getProfile();
    form.elements.nombre.value = datos.nombre || "";
    form.elements.profesion.value = datos.profesion || "";
    form.elements.institucion.value = datos.institucion || "";

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      EpeStore.saveProfile({
        nombre: form.elements.nombre.value.trim(),
        profesion: form.elements.profesion.value.trim(),
        institucion: form.elements.institucion.value.trim(),
      });
      if (status) {
        status.textContent = "Guardado.";
        window.clearTimeout(status._epeTimeout);
        status._epeTimeout = window.setTimeout(function () {
          status.textContent = "";
        }, 2000);
      }
    });
  }

  return { init: init };
})();
