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
  document.addEventListener("DOMContentLoaded", function () {
    EpeAuth.requireSession().then(function (session) {
      if (!session) return; // requireSession ya redirigió a login.html

      var emailEl = document.querySelector("[data-sesion-email]");
      if (emailEl) emailEl.textContent = session.user.email;

      EpeTheme.initThemeToggle(document.getElementById("theme-toggle"));

      document.querySelector("[data-logout]").addEventListener("click", function () {
        EpeAuth.signOut().then(function () {
          window.location.href = "login.html";
        });
      });

      initTabs();

      EpePerfil.init(document.querySelector("[data-panel='perfil']"), session.user.email);
      EpeCasos.init(document.querySelector("[data-panel='casos']"));
      EpeDispositivos.init(document.querySelector("[data-panel='dispositivos']"));

      console.info("[EpE] Espacio personal — dashboard cargado (Supabase)");
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
