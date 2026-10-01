/**
 * dashboard.js (admin)
 * Orquesta el panel de staff de dis+capacidad: exige sesión real (igual
 * que el espacio personal) y chequea soy_staff() en la base antes de
 * mostrar nada — esto es solo para no renderizar contenido de más si no
 * corresponde; la seguridad real la siguen dando las funciones
 * security definer y RLS (ver supabase/010_instituciones_y_staff.sql),
 * no este chequeo del lado del cliente.
 *
 * Script clásico. Punto de entrada de admin/dashboard.html, cargado
 * último.
 */

(function () {
  document.addEventListener("DOMContentLoaded", function () {
    EpeAuth.requireSession().then(function (session) {
      if (!session) return; // requireSession ya mandó a login.html

      var emailEl = document.querySelector("[data-sesion-email]");
      if (emailEl) emailEl.textContent = session.user.email;

      EpeTheme.initThemeToggle(document.getElementById("theme-toggle"));

      document.querySelector("[data-logout]").addEventListener("click", function () {
        EpeAuth.signOut().then(function () {
          window.location.href = "../espacio-personal/login.html";
        });
      });

      EpeAdminStore.soyStaff()
        .then(function (esStaff) {
          if (!esStaff) {
            document.querySelector("[data-sin-acceso]").hidden = false;
            return;
          }
          document.querySelector("[data-admin-contenido]").hidden = false;
          initTabs();
          EpeAdminPanel.init(document.querySelector('[data-admin-panel="colecciones"]'));
          EpeAdminInstituciones.init(document.querySelector('[data-admin-panel="instituciones"]'));
          EpeAdminPendientes.init(document.querySelector('[data-admin-panel="pendientes"]'));
        })
        .catch(function () {
          document.querySelector("[data-sin-acceso]").hidden = false;
        });
    });
  });

  function initTabs() {
    var tabs = document.querySelectorAll("[data-admin-tab]");
    var paneles = document.querySelectorAll("[data-admin-panel]");

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var destino = tab.getAttribute("data-admin-tab");
        tabs.forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", String(t === tab));
        });
        paneles.forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-admin-panel") !== destino;
        });
      });
    });
  }
})();
