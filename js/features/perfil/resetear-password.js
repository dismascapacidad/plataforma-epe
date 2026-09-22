/**
 * resetear-password.js
 * Punto de entrada de espacio-personal/resetear-password.html. Solo se
 * llega acá desde el link del mail de "recuperar contraseña" (ver
 * EpeAuth.resetPasswordForEmail en login.js) — el SDK de Supabase detecta
 * solo el token que viene en la URL y dispara el evento
 * "PASSWORD_RECOVERY" (ver EpeAuth.onPasswordRecovery).
 *
 * Si alguien entra a esta página directo (sin pasar por el link del mail),
 * el evento nunca llega y se queda mostrando el mensaje de "verificando" —
 * después de unos segundos le avisamos que el link no es válido.
 *
 * Script clásico. Depende de auth.js (EpeAuth).
 */

(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var sub = document.querySelector("[data-reset-sub]");
    var form = document.querySelector("[data-reset-form]");
    var status = document.querySelector("[data-reset-status]");

    var timeoutId = window.setTimeout(function () {
      sub.textContent = "Este link no es válido o ya venció. Pedí uno nuevo desde la pantalla de ingreso.";
    }, 4000);

    EpeAuth.onPasswordRecovery(function () {
      window.clearTimeout(timeoutId);
      sub.textContent = "Elegí una contraseña nueva.";
      form.hidden = false;
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var boton = form.querySelector("button[type=submit]");
      var password = form.elements.password.value;
      if (!password) return;

      boton.disabled = true;
      status.textContent = "Guardando…";

      EpeAuth.updatePassword(password)
        .then(function () {
          status.textContent = "Contraseña actualizada. Ya podés ingresar.";
          window.setTimeout(function () {
            window.location.href = "login.html";
          }, 1500);
        })
        .catch(function (err) {
          status.textContent = (err && err.message) || "No se pudo guardar. Probá de nuevo.";
          boton.disabled = false;
        });
    });
  });
})();
