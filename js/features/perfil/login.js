/**
 * login.js
 * Punto de entrada de espacio-personal/login.html. Un mismo formulario
 * sirve para "Ingresar" y "Crear cuenta" (ver data-login-toggle en el
 * HTML) — antes solo existía login mock, ahora que hay Auth real hace
 * falta poder registrarse de verdad.
 *
 * El modo "signup" además pide los datos del perfil (nombre, profesión,
 * institución y los de contacto opcionales — ver data-signup-fields en el
 * HTML), para que "Crear cuenta" deje a la persona con el perfil cargado
 * en el mismo paso, sin tener que repetir esos datos en la pestaña Perfil.
 *
 * Con "Confirm email" activado en Supabase (nuestro caso), crear cuenta NO
 * deja una sesión activa al toque: hay que confirmar el mail primero, y sin
 * sesión no se puede guardar el perfil (EpeStore.saveProfile necesita
 * auth.uid()). Por eso el perfil cargado se guarda temporalmente en
 * localStorage y es dashboard.js quien lo aplica solo, la primera vez que
 * la persona entra ya con sesión real (ver aplicarPerfilPendienteSiCorresponde
 * en dashboard.js) — así no hay que volver a tipearlo.
 *
 * Script clásico. Depende de auth.js (EpeAuth) y data/store.js (EpeStore).
 */

(function () {
  var CLAVE_PERFIL_PENDIENTE = "epePerfilPendiente";

  function guardarPerfilPendiente(email, datosPerfil) {
    try {
      window.localStorage.setItem(CLAVE_PERFIL_PENDIENTE, JSON.stringify({ email: email.toLowerCase(), datos: datosPerfil }));
    } catch (e) {
      // localStorage puede fallar (modo privado, cuota llena) — no es
      // crítico, la persona puede cargar estos datos a mano en Perfil.
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var card = document.querySelector(".epe-login-card");
    var form = document.querySelector("[data-login-form]");
    var camposSignup = document.querySelector("[data-signup-fields]");
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
      camposSignup.hidden = modo !== "signup";
      card.classList.toggle("is-signup", modo === "signup");
      submitBtn.textContent = modo === "login" ? "Ingresar" : "Crear cuenta";
      toggle.textContent = modo === "login" ? "¿No tenés cuenta? Creá una" : "¿Ya tenés cuenta? Ingresá";
      status.textContent = "";
    }

    // "Crear cuenta" en la página principal linkea acá con ?modo=signup
    // para abrir directo en modo registro.
    if (new URLSearchParams(window.location.search).get("modo") === "signup") {
      setModo("signup");
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

      if (modo === "login") {
        status.textContent = "Ingresando…";
        EpeAuth.signIn(email, password)
          .then(function () {
            window.location.href = "dashboard.html";
          })
          .catch(function (err) {
            status.textContent = traducirError(err);
            submitBtn.disabled = false;
          });
        return;
      }

      // modo === "signup"
      var datosPerfil = {
        nombre: form.elements.nombre.value.trim(),
        profesion: form.elements.profesion.value.trim(),
        institucion: form.elements.institucion.value.trim(),
        telefono: form.elements.telefono.value.trim(),
        localidad: form.elements.localidad.value.trim(),
        email_contacto: form.elements.email_contacto.value.trim(),
      };

      status.textContent = "Creando cuenta…";
      EpeAuth.signUp(email, password)
        .then(function (resultado) {
          if (resultado.session) {
            // "Confirm email" desactivado: ya hay sesión, guardamos el
            // perfil directo y entramos al espacio personal.
            return EpeStore.saveProfile(datosPerfil).then(function () {
              window.location.href = "dashboard.html";
            });
          }
          // Sin sesión todavía: guardamos el perfil para que dashboard.js lo
          // aplique solo la primera vez que la persona confirme el mail y
          // entre.
          guardarPerfilPendiente(email, datosPerfil);
          status.textContent = "Cuenta creada. Revisá tu email para confirmarla — cuando ingreses, tu perfil ya va a estar cargado.";
          submitBtn.disabled = false;
          setModo("login");
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
