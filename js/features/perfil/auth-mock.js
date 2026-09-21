/**
 * auth-mock.js
 * Login FALSO. No valida contraseña contra nada — cualquier email/password
 * no vacíos "entran". Solo existe para poder probar el flujo de
 * login → dashboard → logout antes de tener Supabase Auth de verdad.
 * Reemplazar entero por Supabase Auth cuando migremos (ver README).
 *
 * Script clásico. Namespace: EpeAuthMock.
 */

var EpeAuthMock = (function () {
  var SESSION_KEY = "epe-auth-mock-session";

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function login(email) {
    var session = { email: email, iniciado_en: new Date().toISOString() };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      // sin storage: la sesión no sobrevive un reload, pero no rompe el flujo.
    }
    return session;
  }

  function logout() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  // Llamar al principio de dashboard.html: si no hay sesión, manda a login.
  function requireSession() {
    var session = getSession();
    if (!session) {
      window.location.href = "login.html";
    }
    return session;
  }

  return {
    getSession: getSession,
    login: login,
    logout: logout,
    requireSession: requireSession,
  };
})();
