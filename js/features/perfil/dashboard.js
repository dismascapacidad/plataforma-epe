/**
 * dashboard.js
 * Orquesta el dashboard del espacio personal: exige sesión REAL (Supabase
 * Auth), maneja el cambio entre las tres pestañas (Perfil / Gestión de
 * casos / Mis dispositivos) e inicializa cada sección. Punto de entrada de
 * dashboard.html, cargado último.
 *
 * requireSession() ahora es async (habla con Supabase) — todo el arranque
 * queda adentro de ese .then().
 *
 * Script clásico, sin type="module" (ver theme.js).
 */

(function () {
  var CLAVE_PERFIL_PENDIENTE = "epePerfilPendiente";

  // Si la persona cargó datos de perfil al crear la cuenta (ver login.js),
  // pero en ese momento no había sesión todavía (Confirm email activado en
  // Supabase), quedaron guardados en localStorage. Acá, ya con sesión real,
  // los aplicamos una sola vez y los borramos — así no hay que volver a
  // tipearlos. Si falla (p.ej. sin conexión) los dejamos para reintentar la
  // próxima vez.
  function aplicarPerfilPendienteSiCorresponde(email) {
    var crudo;
    try {
      crudo = window.localStorage.getItem(CLAVE_PERFIL_PENDIENTE);
    } catch (e) {
      return Promise.resolve();
    }
    if (!crudo) return Promise.resolve();

    var pendiente;
    try {
      pendiente = JSON.parse(crudo);
    } catch (e) {
      try {
        window.localStorage.removeItem(CLAVE_PERFIL_PENDIENTE);
      } catch (e2) {
        /* nada más para hacer acá */
      }
      return Promise.resolve();
    }

    if (!pendiente || !pendiente.email || pendiente.email !== email.toLowerCase()) return Promise.resolve();

    return EpeStore.saveProfile(pendiente.datos)
      .then(function () {
        try {
          window.localStorage.removeItem(CLAVE_PERFIL_PENDIENTE);
        } catch (e) {
          /* nada más para hacer acá */
        }
      })
      .catch(function () {
        // No se pudo guardar — lo dejamos en localStorage para la próxima.
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    EpeAuth.requireSession().then(function (session) {
      if (!session) return; // requireSession ya redirigió a login.html

      var emailEl = document.querySelector("[data-sesion-email]");
      if (emailEl) emailEl.textContent = session.user.email;

      EpeTheme.initThemeToggle(document.getElementById("theme-toggle"));

      // Solo le mostramos el link al panel de staff a las cuentas que
      // están en staff_dismascapacidad — para el resto de los
      // profesionales no tiene sentido (y admin/dashboard.html de
      // cualquier forma se los bloquea del lado del servidor).
      EpeAdminStore.soyStaff()
        .then(function (esStaff) {
          var linkAdmin = document.querySelector("[data-link-admin]");
          if (linkAdmin) linkAdmin.hidden = !esStaff;
        })
        .catch(function () {
          // Si falla la consulta lo dejamos oculto, no es crítico.
        });

      document.querySelector("[data-logout]").addEventListener("click", function () {
        EpeAuth.signOut().then(function () {
          window.location.href = "login.html";
        });
      });

      initTabs();

      aplicarPerfilPendienteSiCorresponde(session.user.email).then(function () {
        EpePerfil.init(document.querySelector("[data-panel='perfil']"), session.user.email);
        EpeCasos.init(document.querySelector("[data-panel='casos']"));
        EpeDispositivos.init(document.querySelector("[data-panel='dispositivos']"));

        console.info("[EpE] Espacio personal — dashboard cargado (Supabase)");
      });
    });
  });

  function initTabs() {
    var tabs = document.querySelectorAll("[data-tab]");
    var paneles = document.querySelectorAll("[data-panel]");

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var destino = tab.getAttribute("data-tab");

        tabs.forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", String(t === tab));
        });
        paneles.forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-panel") !== destino;
        });
      });
    });
  }
})();
