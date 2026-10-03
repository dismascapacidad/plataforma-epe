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
          EpeAdminSolicitudes.init(document.querySelector('[data-admin-panel="solicitudes-admin"]'));
          actualizarAvisoPendientes();
          actualizarAvisoSolicitudesAdmin();
        })
        .catch(function () {
          document.querySelector("[data-sin-acceso]").hidden = false;
        });
    });
  });

  // Número en la pestaña "Pendientes" — a diferencia del punto de
  // "Colecciones compartidas", acá la cantidad sí importa para decidir si
  // conviene entrar ahora (ver css/components/aviso.css). v1 simple: se
  // calcula una vez al entrar al panel, no se refresca solo mientras está
  // abierto (igual que el resto de este panel — ver panel.js).
  function actualizarAvisoPendientes() {
    var avisoTab = document.querySelector("[data-aviso-pendientes]");
    if (!avisoTab) return;
    EpeAdminStore.pendientes()
      .then(function (lista) {
        if (lista.length === 0) {
          avisoTab.hidden = true;
          return;
        }
        avisoTab.hidden = false;
        avisoTab.innerHTML = "";
        avisoTab.appendChild(document.createTextNode(String(lista.length)));
        var sr = document.createElement("span");
        sr.className = "epe-sr-only";
        sr.textContent = " pendientes de resolver";
        avisoTab.appendChild(sr);
      })
      .catch(function () {
        avisoTab.hidden = true;
      });
  }

  // Mismo criterio que actualizarAvisoPendientes: se calcula una vez al
  // entrar al panel, no se refresca solo mientras está abierto.
  function actualizarAvisoSolicitudesAdmin() {
    var avisoTab = document.querySelector("[data-aviso-solicitudes-admin]");
    if (!avisoTab) return;
    EpeAdminStore.listarSolicitudesAdmin()
      .then(function (lista) {
        if (lista.length === 0) {
          avisoTab.hidden = true;
          return;
        }
        avisoTab.hidden = false;
        avisoTab.innerHTML = "";
        avisoTab.appendChild(document.createTextNode(String(lista.length)));
        var sr = document.createElement("span");
        sr.className = "epe-sr-only";
        sr.textContent = " solicitudes de admin pendientes";
        avisoTab.appendChild(sr);
      })
      .catch(function () {
        avisoTab.hidden = true;
      });
  }

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
