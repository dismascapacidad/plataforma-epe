/**
 * sesion-ui.js
 * Refleja en el header de CUALQUIER página pública si hay una sesión
 * iniciada: muestra "Ingresar / Crear cuenta" o "Mi espacio / Salir".
 *
 * La sesión en sí ya persiste sola: Supabase la guarda en localStorage del
 * navegador (mismo origen para toda la plataforma) y la renueva. Lo que
 * faltaba es que cada página lo supiera. Para eso cada página tiene que
 * cargar, antes de este archivo: el SDK de Supabase, supabase-client.js y
 * features/perfil/auth.js (EpeAuth).
 *
 * Contrato con el HTML: los elementos del header que dependen de la sesión
 * llevan data-sesion="anon" (se ven sin sesión) o data-sesion="logueada" (se
 * ven con sesión), y arrancan con el atributo `hidden` para no mostrar un
 * estado equivocado mientras se consulta la sesión. Un botón con
 * data-sesion-salir cierra la sesión. El CSS que respeta `hidden` en esos
 * elementos está en css/components/sesion.css.
 *
 * Si Supabase no cargó (sin conexión, CDN caído), la página sigue andando
 * como si no hubiera sesión.
 *
 * Script clásico (ver theme.js). Namespace: EpeSesionUi.
 */

var EpeSesionUi = (function () {
  function pintar(session) {
    var logueada = !!session;
    var elementos = document.querySelectorAll("[data-sesion]");
    for (var i = 0; i < elementos.length; i++) {
      var esLogueada = elementos[i].getAttribute("data-sesion") === "logueada";
      elementos[i].hidden = esLogueada !== logueada;
    }
  }

  // opciones.onCambio(session|null): se llama cuando la sesión cambia (entrar,
  // salir, o salir desde otra pestaña). Se difiere un tick a propósito: el
  // SDK pide no llamarlo de vuelta dentro de su propio callback.
  // Devuelve una Promise<session|null> con el estado inicial.
  function init(opciones) {
    var onCambio = opciones && opciones.onCambio;

    if (!window.EpeAuth || !window.EpeSupabase) {
      pintar(null);
      return Promise.resolve(null);
    }

    var botonesSalir = document.querySelectorAll("[data-sesion-salir]");
    for (var i = 0; i < botonesSalir.length; i++) {
      botonesSalir[i].addEventListener("click", function () {
        window.EpeAuth.signOut().catch(function () {
          // Si falla, el estado no cambia y el botón sigue ahí para reintentar.
        });
      });
    }

    window.EpeSupabase.auth.onAuthStateChange(function (evento, session) {
      pintar(session);
      if (onCambio) {
        setTimeout(function () {
          onCambio(session || null);
        }, 0);
      }
    });

    return window.EpeAuth.getSession()
      .catch(function () {
        return null;
      })
      .then(function (session) {
        pintar(session);
        return session;
      });
  }

  return { init: init };
})();
