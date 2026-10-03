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

  // Lista corta de emails de staff — hoy es uno solo. Determina si se
  // MUESTRA el link al panel (solo eso, es cosmético). Se decidió así, en
  // vez de preguntarle a la función soy_staff() de la base en cada carga,
  // porque esa llamada mostró un resultado inconsistente en vivo (devolvió
  // true para una cuenta que no es staff, y segundos después, llamada a
  // mano desde la consola, devolvió false correctamente) — algo
  // transitorio del lado de Supabase/el pooler de conexiones, no
  // reproducible a pedido. La seguridad real NO depende de esto:
  // admin/dashboard.html vuelve a chequear soy_staff() del lado del
  // servidor antes de mostrar cualquier contenido, y las funciones de
  // datos (panel_staff_colecciones, etc.) son security definer y chequean
  // staff_dismascapacidad por su cuenta. Si se suma más gente al staff,
  // agregar su email acá.
  var EMAILS_STAFF = ["dismascapacidad@gmail.com"];

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

      document.querySelector("[data-logout]").addEventListener("click", function () {
        EpeAuth.signOut().then(function () {
          window.location.href = "login.html";
        });
      });

      initTabs();

      // Mostrar/ocultar el link al panel de staff: decisión puramente
      // cosmética contra la lista fija EMAILS_STAFF (ver comentario arriba).
      // El acceso real sigue protegido del lado del servidor
      // (admin/dashboard.html chequea soy_staff() de nuevo, y las funciones
      // de datos son security definer) — esto es solo para no mostrar un
      // link que de todas formas va a rechazar.
      try {
        var linkAdmin = document.querySelector("[data-link-admin]");
        if (linkAdmin) {
          linkAdmin.hidden = EMAILS_STAFF.indexOf((session.user.email || "").toLowerCase()) === -1;
        }
      } catch (e) {
        // No debería pasar, pero por si acaso no bloqueamos el resto del dashboard.
      }

      aplicarPerfilPendienteSiCorresponde(session.user.email).then(function () {
        EpePerfil.init(document.querySelector("[data-panel='perfil']"), session.user.email);
        EpeCasos.init(document.querySelector("[data-panel='casos']"));
        EpeDispositivos.init(document.querySelector("[data-panel='dispositivos']"));
        EpeMiInstitucion.init(document.querySelector("[data-tab-mi-institucion]"), document.querySelector("[data-mi-institucion-lista]"));

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
