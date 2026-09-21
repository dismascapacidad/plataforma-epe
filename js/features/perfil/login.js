/**
 * login.js
 * Punto de entrada de espacio-personal/login.html. Si ya hay sesión mock,
 * va directo al dashboard; si no, atiende el submit del formulario.
 *
 * Script clásico. No valida nada de verdad — ver auth-mock.js.
 */

(function () {
  document.addEventListener("DOMContentLoaded", function () {
    if (EpeAuthMock.getSession()) {
      window.location.href = "dashboard.html";
      return;
    }

    var form = document.querySelector("[data-login-form]");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = form.elements.email.value.trim();
      if (!email) return;
      EpeAuthMock.login(email);
      window.location.href = "dashboard.html";
    });
  });
})();
