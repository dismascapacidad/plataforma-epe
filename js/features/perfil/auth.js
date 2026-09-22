/**
 * auth.js
 * Login REAL contra Supabase Auth (reemplaza a auth-mock.js, que ya no
 * existe: aceptaba cualquier email/password sin validar nada).
 *
 * Todo acá es asíncrono (devuelve Promises) porque ahora habla por red con
 * Supabase — a diferencia del mock anterior, que respondía al instante
 * desde localStorage. Quien llama tiene que manejarlo con .then()/.catch()
 * o async/await (ver login.js y dashboard.js).
 *
 * Script clásico (ver theme.js). Depende de que supabase-client.js ya haya
 * corrido. Namespace: EpeAuth.
 */

var EpeAuth = (function () {
  // Devuelve una Promise<session|null>. session viene con session.user
  // (incluye session.user.email) y session.access_token, entre otras cosas.
  function getSession() {
    return EpeSupabase.auth.getSession().then(function (res) {
      if (res.error) throw res.error;
      return (res.data && res.data.session) || null;
    });
  }

  // Promise<session>. Rechaza si el email/password no coinciden.
  function signIn(email, password) {
    return EpeSupabase.auth
      .signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data.session;
      });
  }

  // Promise<{ user, session }>. Con "Confirm email" activado en Supabase
  // (nuestro caso), session viene null hasta que la persona confirma el
  // mail — quien llama tiene que mostrar ese estado (ver login.js).
  function signUp(email, password) {
    return EpeSupabase.auth.signUp({ email: email, password: password }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function signOut() {
    return EpeSupabase.auth.signOut().then(function (res) {
      if (res.error) throw res.error;
    });
  }

  // Llamar al principio de dashboard.html: si no hay sesión, manda a
  // login.html. Promise<session|null> (null solo cuando ya redirigió).
  function requireSession() {
    return getSession().then(function (session) {
      if (!session) {
        window.location.href = "login.html";
        return null;
      }
      return session;
    });
  }

  return {
    getSession: getSession,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    requireSession: requireSession,
  };
})();
