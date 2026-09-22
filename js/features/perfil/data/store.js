/**
 * store.js
 * Capa de datos del espacio personal. MIGRADO: ya no guarda en
 * localStorage, cada función habla con Supabase (ver
 * supabase/001_schema_inicial.sql para el esquema y RLS). Este era
 * justamente el objetivo del diseño original — las firmas de acá abajo son
 * casi idénticas a la versión mock, con dos diferencias sistemáticas:
 *
 * 1. Todo devuelve una Promise (antes era todo síncrono vía localStorage).
 *    Quien llama tiene que usar .then()/.catch() o async/await.
 * 2. Los errores de red/RLS ya no quedan en silencio (localStorage nunca
 *    fallaba salvo cuota llena): cada función deja pasar el error de
 *    Supabase para que quien llama decida qué mostrar (ver casos.js).
 *
 * RLS hace la mayor parte del trabajo de seguridad: casos.dueno_id se
 * completa solo con auth.uid() (default en la columna, ver
 * supabase/002_patches.sql) y las tablas hijas se filtran siempre a través
 * del caso al que pertenecen — no hace falta duplicar esos filtros acá.
 *
 * Depende de que supabase-client.js ya haya corrido. Script clásico (ver
 * theme.js). Namespace: EpeStore.
 */

var EpeStore = (function () {
  function lanzarSiError(res) {
    if (res.error) throw res.error;
    return res;
  }

  // ── Perfil ──────────────────────────────────────────────────────────
  // profiles se crea sola (trigger on_auth_user_created) cuando alguien se
  // registra — acá solo leemos/actualizamos la fila propia (RLS: id =
  // auth.uid()).

  function getProfile() {
    return EpeSupabase.auth.getUser().then(function (userRes) {
      if (userRes.error) throw userRes.error;
      var uid = userRes.data.user.id;
      return EpeSupabase.from("profiles")
        .select("nombre, profesion, institucion")
        .eq("id", uid)
        .maybeSingle()
        .then(function (res) {
          lanzarSiError(res);
          return (
            res.data || {
              nombre: "",
              profesion: "",
              institucion: "",
            }
          );
        });
    });
  }

  function saveProfile(datos) {
    return EpeSupabase.auth.getUser().then(function (userRes) {
      if (userRes.error) throw userRes.error;
      var uid = userRes.data.user.id;
      return EpeSupabase.from("profiles")
        .update({
          nombre: datos.nombre,
          profesion: datos.profesion,
          institucion: datos.institucion,
          actualizado_en: new Date().toISOString(),
        })
        .eq("id", uid)
        .select("nombre, profesion, institucion")
        .single()
        .then(function (res) {
          lanzarSiError(res);
          return res.data;
        });
    });
  }

  // ── Casos ───────────────────────────────────────────────────────────

  function getCasos() {
    return EpeSupabase.from("casos")
      .select("*")
      .order("actualizado_en", { ascending: false })
      .then(function (res) {
        lanzarSiError(res);
        return res.data || [];
      });
  }

  function getCaso(id) {
    return EpeSupabase.from("casos")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(function (res) {
        lanzarSiError(res);
        return res.data || null;
      });
  }

  function createCaso(datos) {
    return EpeSupabase.from("casos")
      .insert({ nombre: (datos && datos.nombre) || "Caso sin nombre" })
      .select("*")
      .single()
      .then(function (res) {
        lanzarSiError(res);
        return res.data;
      });
  }

  function updateCaso(id, datos) {
    return EpeSupabase.from("casos")
      .update(datos)
      .eq("id", id)
      .select("*")
      .single()
      .then(function (res) {
        lanzarSiError(res);
        return res.data;
      });
  }

  // ON DELETE CASCADE en la base se encarga de actividades, apps de
  // terceros, entradas y shares del caso — no hace falta borrarlas a mano
  // como en la versión con localStorage.
  function deleteCaso(id) {
    return EpeSupabase.from("casos")
      .delete()
      .eq("id", id)
      .then(function (res) {
        lanzarSiError(res);
      });
  }

  // ── Actividades vinculadas a un caso (referencia al catálogo) ──────

  function listActividades(casoId) {
    return EpeSupabase.from("caso_actividades")
      .select("*")
      .eq("caso_id", casoId)
      .order("agregado_en", { ascending: true })
      .then(function (res) {
        lanzarSiError(res);
        return res.data || [];
      });
  }

  function hasActividad(casoId, catalogoId) {
    return EpeSupabase.from("caso_actividades")
      .select("id", { count: "exact", head: true })
      .eq("caso_id", casoId)
      .eq("catalogo_id", catalogoId)
      .then(function (res) {
        lanzarSiError(res);
        return (res.count || 0) > 0;
      });
  }

  function addActividad(casoId, catalogoId) {
    return hasActividad(casoId, catalogoId).then(function (yaExiste) {
      if (yaExiste) return null; // no duplicar (ver casos.js)
      return EpeSupabase.from("caso_actividades")
        .insert({ caso_id: casoId, catalogo_id: catalogoId })
        .select("*")
        .single()
        .then(function (res) {
          lanzarSiError(res);
          return res.data;
        });
    });
  }

  function removeActividad(actividadId) {
    return EpeSupabase.from("caso_actividades")
      .delete()
      .eq("id", actividadId)
      .then(function (res) {
        lanzarSiError(res);
      });
  }

  // ── Apps de terceros propias de un caso (privadas, NO van al catálogo) ─

  function listAppsTerceros(casoId) {
    return EpeSupabase.from("caso_apps_terceros")
      .select("*")
      .eq("caso_id", casoId)
      .order("creado_en", { ascending: true })
      .then(function (res) {
        lanzarSiError(res);
        return res.data || [];
      });
  }

  function addAppTercero(casoId, datos) {
    return EpeSupabase.from("caso_apps_terceros")
      .insert({
        caso_id: casoId,
        nombre: (datos && datos.nombre) || "",
        descripcion: (datos && datos.descripcion) || "",
        instrucciones: (datos && datos.instrucciones) || "",
        configuracion: (datos && datos.configuracion) || "",
        url: (datos && datos.url) || "",
      })
      .select("*")
      .single()
      .then(function (res) {
        lanzarSiError(res);
        return res.data;
      });
  }

  function removeAppTercero(appId) {
    return EpeSupabase.from("caso_apps_terceros")
      .delete()
      .eq("id", appId)
      .then(function (res) {
        lanzarSiError(res);
      });
  }

  // ── Entradas del caso: nota / evaluación / sesión, tabla unificada ──

  function listEntradas(casoId) {
    return EpeSupabase.from("caso_entradas")
      .select("*")
      .eq("caso_id", casoId)
      .order("creado_en", { ascending: false })
      .then(function (res) {
        lanzarSiError(res);
        return res.data || [];
      });
  }

  function addEntrada(casoId, datos) {
    return EpeSupabase.from("caso_entradas")
      .insert({
        caso_id: casoId,
        tipo: (datos && datos.tipo) || EpeSchema.ENTRADA_TIPOS.NOTA,
        contenido: (datos && datos.contenido) || "",
      })
      .select("*")
      .single()
      .then(function (res) {
        lanzarSiError(res);
        return res.data;
      });
  }

  function removeEntrada(entradaId) {
    return EpeSupabase.from("caso_entradas")
      .delete()
      .eq("id", entradaId)
      .then(function (res) {
        lanzarSiError(res);
      });
  }

  // ── Compartir ───────────────────────────────────────────────────────
  // Funcional de punta a punta desde supabase/003_compartir.sql: la RLS
  // de casos/caso_actividades/caso_apps_terceros/caso_entradas ahora
  // también deja ver (solo lectura, nunca editar) a quien tenga un share
  // que lo alcance — ver public.puede_ver_caso() en ese archivo.
  //
  // "institucion" y "dismascapacidad" son toggles simples (una fila por
  // tipo, sin destinatario puntual). "colega" es distinto: puede haber
  // varios, cada uno con su propio compartido_con_user_id — por eso tiene
  // sus funciones propias en vez de reusar setShare().

  function getShares(casoId) {
    return EpeSupabase.from("caso_shares")
      .select("*")
      .eq("caso_id", casoId)
      .then(function (res) {
        lanzarSiError(res);
        return res.data || [];
      });
  }

  function setShare(casoId, tipo, activo) {
    if (activo) {
      return EpeSupabase.from("caso_shares")
        .insert({ caso_id: casoId, tipo: tipo })
        .then(function (res) {
          lanzarSiError(res);
          return getShares(casoId);
        });
    }
    return EpeSupabase.from("caso_shares")
      .delete()
      .eq("caso_id", casoId)
      .eq("tipo", tipo)
      .then(function (res) {
        lanzarSiError(res);
        return getShares(casoId);
      });
  }

  // Promise<uuid|null>. null significa "nadie con ese email tiene cuenta
  // en la plataforma todavía" — no es un error, es un resultado válido
  // que quien llama tiene que manejar (ver casos.js).
  function findUserIdByEmail(email) {
    return EpeSupabase.rpc("find_user_id_by_email", { p_email: email }).then(function (res) {
      lanzarSiError(res);
      return res.data || null;
    });
  }

  // Promise<fila del share creado | null>. null si el email no
  // corresponde a ninguna cuenta.
  function addShareColega(casoId, email) {
    return findUserIdByEmail(email).then(function (uid) {
      if (!uid) return null;
      return EpeSupabase.from("caso_shares")
        .insert({ caso_id: casoId, tipo: "colega", compartido_con_user_id: uid })
        .select("*")
        .single()
        .then(function (res) {
          lanzarSiError(res);
          return res.data;
        });
    });
  }

  // Borra un share puntual por su id (se usa para sacar a un colega de la
  // lista — institución/dis+capacidad usan setShare(..., false) en vez de
  // esto porque no tienen un id particular que el usuario haya elegido).
  function removeShare(shareId) {
    return EpeSupabase.from("caso_shares")
      .delete()
      .eq("id", shareId)
      .then(function (res) {
        lanzarSiError(res);
      });
  }

  // Promise<string>. Nombre o email de la persona para mostrar en la
  // lista de "compartido con" — nunca se expone su perfil completo (ver
  // etiqueta_colega() en supabase/003_compartir.sql).
  function getColegaLabel(userId) {
    return EpeSupabase.rpc("etiqueta_colega", { p_user_id: userId }).then(function (res) {
      lanzarSiError(res);
      return res.data || "Usuario";
    });
  }

  return {
    getProfile: getProfile,
    saveProfile: saveProfile,
    getCasos: getCasos,
    getCaso: getCaso,
    createCaso: createCaso,
    updateCaso: updateCaso,
    deleteCaso: deleteCaso,
    listActividades: listActividades,
    hasActividad: hasActividad,
    addActividad: addActividad,
    removeActividad: removeActividad,
    listAppsTerceros: listAppsTerceros,
    addAppTercero: addAppTercero,
    removeAppTercero: removeAppTercero,
    listEntradas: listEntradas,
    addEntrada: addEntrada,
    removeEntrada: removeEntrada,
    getShares: getShares,
    setShare: setShare,
    findUserIdByEmail: findUserIdByEmail,
    addShareColega: addShareColega,
    removeShare: removeShare,
    getColegaLabel: getColegaLabel,
  };
})();
