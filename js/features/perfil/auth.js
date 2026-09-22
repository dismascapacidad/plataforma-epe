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

  // Dispara el mail de "recuperar contraseña". redirectTo tiene que estar
  // cargado en Supabase → Authentication → URL Configuration → Redirect
  // URLs, si no Supabase rechaza el link por seguridad (no manda a
  // cualquier URL que le pidan). Promise<void>.
  function resetPasswordForEmail(email, redirectTo) {
    return EpeSupabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo }).then(function (res) {
      if (res.error) throw res.error;
    });
  }

  // Para usar DESPUÉS de entrar por el link de recuperación (ver
  // resetear-password.js): la sesión temporal de recuperación ya viene
  // armada por el SDK al detectar el token en la URL, esto solo cambia el
  // password de esa sesión. Promise<void>.
  function updatePassword(nuevaPassword) {
    return EpeSupabase.auth.updateUser({ password: nuevaPassword }).then(function (res) {
      if (res.error) throw res.error;
    });
  }

  // Se dispara con "PASSWORD_RECOVERY" cuando la persona llega desde el
  // link del mail de recuperación (el SDK detecta el token solo, ver
  // supabase-client.js — detectSessionInUrl viene en true por defecto).
  // Devuelve una función para des-suscribirse si hiciera falta.
  function onPasswordRecovery(callback) {
    var sub = EpeSupabase.auth.onAuthStateChange(function (event) {
      if (event === "PASSWORD_RECOVERY") callback();
    });
    return function () {
      sub.data.subscription.unsubscribe();
    };
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
    resetPasswordForEmail: resetPasswordForEmail,
    updatePassword: updatePassword,
    onPasswordRecovery: onPasswordRecovery,
  };
})();
