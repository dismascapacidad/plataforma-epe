/**
 * login.js
 * Punto de entrada de espacio-personal/login.html. Un mismo formulario
 * sirve para "Ingresar" y "Crear cuenta" (ver data-login-toggle en el
 * HTML) — antes solo existía login mock, ahora que hay Auth real hace
 * falta poder registrarse de verdad.
 *
 * Con "Confirm email" activado en Supabase (nuestro caso), crear cuenta NO
 * deja una sesión activa al toque: hay que confirmar el mail primero. Por
 * eso signUp() puede terminar sin sesión — ahí se lo avisamos a la persona
 * en vez de mandarla al dashboard.
 *
 * Script clásico. Depende de auth.js (EpeAuth).
 */

(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.querySelector("[data-login-form]");
    var toggle = document.querySelector("[data-login-toggle]");
    var olvide = document.querySelector("[data-login-olvide]");
    var status = document.querySelector("[data-login-status]");
    var submitBtn = form.querySelector("button[type=submit]");
    var modo = "login";

    EpeAuth.getSession().then(function (session) {
      if (session) window.location.href = "dashboard.html";
    });

    function setModo(nuevo) {
      modo = nuevo;
      submitBtn.textContent = modo === "login" ? "Ingresar" : "Crear cuenta";
      toggle.textContent = modo === "login" ? "¿No tenés cuenta? Creá una" : "¿Ya tenés cuenta? Ingresá";
      status.textContent = "";
    }

    toggle.addEventListener("click", function (ev) {
      ev.preventDefault();
      setModo(modo === "login" ? "signup" : "login");
    });

    olvide.addEventListener("click", function (ev) {
      ev.preventDefault();
      var email = form.elements.email.value.trim();
      if (!email) {
        status.textContent = "Escribí tu email arriba y volvé a tocar el link.";
        return;
      }
      status.textContent = "Enviando mail de recuperación…";
      var redirectTo = window.location.origin + window.location.pathname.replace("login.html", "resetear-password.html");
      EpeAuth.resetPasswordForEmail(email, redirectTo)
        .then(function () {
          status.textContent = "Listo, revisá tu email para poner una contraseña nueva.";
        })
        .catch(function (err) {
          status.textContent = traducirError(err);
        });
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = form.elements.email.value.trim();
      var password = form.elements.password.value;
      if (!email || !password) return;

      submitBtn.disabled = true;
      status.textContent = modo === "login" ? "Ingresando…" : "Creando cuenta…";

      var accion = modo === "login" ? EpeAuth.signIn(email, password) : EpeAuth.signUp(email, password);

      accion
        .then(function (resultado) {
          if (modo === "signup" && !resultado.session) {
            status.textContent = "Cuenta creada. Revisá tu email para confirmarla y después ingresá.";
            submitBtn.disabled = false;
            setModo("login");
            return;
          }
          window.location.href = "dashboard.html";
        })
        .catch(function (err) {
          status.textContent = traducirError(err);
          submitBtn.disabled = false;
        });
    });

    function traducirError(err) {
      var msg = (err && err.message) || "";
      if (msg.indexOf("Invalid login credentials") !== -1) return "Email o contraseña incorrectos.";
      if (msg.indexOf("User already registered") !== -1) return "Ya existe una cuenta con ese email — probá ingresar.";
      if (msg.indexOf("Password should be at least") !== -1) return "La contraseña tiene que tener al menos 6 caracteres.";
      if (msg.indexOf("Email not confirmed") !== -1) return "Todavía no confirmaste tu email — revisá tu casilla.";
      return msg || "Ocurrió un error. Probá de nuevo.";
    }
  });
})();
