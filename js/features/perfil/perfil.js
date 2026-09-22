/**
 * perfil.js
 * Sección "Perfil" del dashboard: una card de resumen (avatar con
 * iniciales + nombre/profesión/institución) arriba del formulario de
 * edición. Lee y guarda a través de EpeStore — no toca Supabase
 * directamente. Todo acá es async: EpeStore habla por red (ver
 * data/store.js).
 *
 * Script clásico. Namespace: EpePerfil.
 */

var EpePerfil = (function () {
  function iniciales(nombre, email) {
    var base = (nombre || "").trim();
    if (base) {
      var partes = base.split(/\s+/);
      var letras = partes[0].charAt(0) + (partes[1] ? partes[1].charAt(0) : "");
      return letras.toUpperCase();
    }
    return (email || "?").charAt(0).toUpperCase();
  }

  function actualizarResumen(root, datos, email) {
    var avatar = root.querySelector("[data-perfil-avatar]");
    var nombreEl = root.querySelector("[data-perfil-resumen-nombre]");
    var detalleEl = root.querySelector("[data-perfil-resumen-detalle]");

    avatar.textContent = iniciales(datos.nombre, email);

    var nombre = (datos.nombre || "").trim();
    nombreEl.textContent = nombre || email || "Tu perfil";

    var detalle = [datos.profesion, datos.institucion]
      .map(function (v) {
        return (v || "").trim();
      })
      .filter(Boolean)
      .join(" · ");
    detalleEl.textContent = detalle || email || "";
  }

  // email: el de la sesión (dashboard.js ya lo tiene, evita pedirlo de
  // nuevo acá) — se usa como respaldo cuando todavía no hay nombre
  // cargado en el perfil.
  function init(root, email) {
    if (!root) return;

    var form = root.querySelector("[data-perfil-form]");
    var status = root.querySelector("[data-perfil-status]");
    if (!form) return;

    actualizarResumen(root, { nombre: "", profesion: "", institucion: "" }, email);

    status.textContent = "Cargando…";
    EpeStore.getProfile()
      .then(function (datos) {
        form.elements.nombre.value = datos.nombre || "";
        form.elements.profesion.value = datos.profesion || "";
        form.elements.institucion.value = datos.institucion || "";
        actualizarResumen(root, datos, email);
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

      var datos = {
        nombre: form.elements.nombre.value.trim(),
        profesion: form.elements.profesion.value.trim(),
        institucion: form.elements.institucion.value.trim(),
      };

      EpeStore.saveProfile(datos)
        .then(function () {
          actualizarResumen(root, datos, email);
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
