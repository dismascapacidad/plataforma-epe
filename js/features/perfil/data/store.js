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

  // "institucion" (texto libre) ya no existe — ver
  // supabase/010_instituciones_y_staff.sql. getProfile trae el nombre de la
  // institución vía el embed de supabase-js (instituciones(nombre)), que
  // funciona solo porque profiles.institucion_id es una FK real a
  // instituciones.id.
  function getProfile() {
    return EpeSupabase.auth.getUser().then(function (userRes) {
      if (userRes.error) throw userRes.error;
      var uid = userRes.data.user.id;
      return EpeSupabase.from("profiles")
        .select(
          "nombre, profesion, telefono, localidad, email_contacto, institucion_id, institucion_pendiente, institucion_verificada, institucion_verificada_metodo, instituciones(nombre)"
        )
        .eq("id", uid)
        .maybeSingle()
        .then(function (res) {
          lanzarSiError(res);
          var datos = res.data || {};
          return {
            nombre: datos.nombre || "",
            profesion: datos.profesion || "",
            telefono: datos.telefono || "",
            localidad: datos.localidad || "",
            email_contacto: datos.email_contacto || "",
            institucion_id: datos.institucion_id || null,
            institucion_nombre: (datos.instituciones && datos.instituciones.nombre) || "",
            institucion_pendiente: datos.institucion_pendiente || "",
            institucion_verificada: !!datos.institucion_verificada,
            institucion_verificada_metodo: datos.institucion_verificada_metodo || "",
          };
        });
    });
  }

  // Solo los campos "de siempre" del formulario de Perfil — institución se
  // guarda aparte (ver elegirInstitucionSinVerificar/setInstitucionPendiente/
  // verificarInstitucion más abajo): es una afirmación de pertenencia, no un
  // dato de texto más, así que tiene su propia acción en la interfaz en vez
  // de mezclarse con el botón "Guardar" general.
  function saveProfile(datos) {
    return EpeSupabase.auth.getUser().then(function (userRes) {
      if (userRes.error) throw userRes.error;
      var uid = userRes.data.user.id;
      return EpeSupabase.from("profiles")
        .update({
          nombre: datos.nombre,
          profesion: datos.profesion,
          telefono: datos.telefono,
          localidad: datos.localidad,
          email_contacto: datos.email_contacto,
          actualizado_en: new Date().toISOString(),
        })
        .eq("id", uid)
        .select("nombre, profesion, telefono, localidad, email_contacto")
        .single()
        .then(function (res) {
          lanzarSiError(res);
          return res.data;
        });
    });
  }

  // ── Institución (entidad propia, ver ADR en el proyecto) ─────────────
  // Tres acciones posibles desde el formulario de Perfil: elegir una
  // institución existente (con o sin código a mano), o avisar que la
  // institución todavía no está en el catálogo.

  function getInstituciones() {
    return EpeSupabase.from("instituciones")
      .select("id, nombre")
      .order("nombre", { ascending: true })
      .then(function (res) {
        lanzarSiError(res);
        return res.data || [];
      });
  }

  // El código se valida DENTRO de la función de Postgres (security
  // definer) — nunca viaja a este cliente para compararlo acá. true/false
  // según si coincidió; si coincidió, la base ya dejó institucion_id y
  // institucion_verificada actualizados, no hace falta un segundo viaje.
  function verificarInstitucion(institucionId, codigo) {
    return EpeSupabase.rpc("verificar_institucion", {
      p_institucion_id: institucionId,
      p_codigo: codigo,
    }).then(function (res) {
      lanzarSiError(res);
      return !!res.data;
    });
  }

  // Elegir una institución del catálogo SIN código (o con uno que no
  // coincidió) — queda registrada la elección, pero institucion_verificada
  // en false, visible para el staff en la pestaña Pendientes.
  function elegirInstitucionSinVerificar(institucionId) {
    return EpeSupabase.auth.getUser().then(function (userRes) {
      if (userRes.error) throw userRes.error;
      var uid = userRes.data.user.id;
      return EpeSupabase.from("profiles")
        .update({
          institucion_id: institucionId,
          institucion_pendiente: null,
          institucion_verificada: false,
          institucion_verificada_en: null,
          institucion_verificada_metodo: null,
        })
        .eq("id", uid)
        .then(function (res) {
          lanzarSiError(res);
        });
    });
  }

  // "Mi institución no está en la lista" — queda el texto tal cual lo
  // escribió la persona, para que el staff la dé de alta desde el panel
  // (pestaña Pendientes) y recién ahí quede con un institucion_id real.
  function setInstitucionPendiente(texto) {
    return EpeSupabase.auth.getUser().then(function (userRes) {
      if (userRes.error) throw userRes.error;
      var uid = userRes.data.user.id;
      return EpeSupabase.from("profiles")
        .update({
          institucion_id: null,
          institucion_pendiente: texto,
          institucion_verificada: false,
          institucion_verificada_en: null,
          institucion_verificada_metodo: null,
        })
        .eq("id", uid)
        .then(function (res) {
          lanzarSiError(res);
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

  // ── Comentarios ─────────────────────────────────────────────────────
  // A diferencia de entradas/actividades, esto SÍ acepta insert de
  // cualquiera con acceso al caso (dueño o compartido) — ver
  // supabase/004_comentarios.sql. Es el canal para que un colega
  // compartido le deje un mensaje al dueño sin tocar la documentación
  // clínica del caso.

  // Promise<uuid>. Se usa en la UI para distinguir "mi comentario" (con
  // opción de borrar) de los de otras personas.
  function getUserId() {
    return EpeSupabase.auth.getUser().then(function (userRes) {
      if (userRes.error) throw userRes.error;
      return userRes.data.user.id;
    });
  }

  function listComentarios(casoId) {
    return EpeSupabase.from("caso_comentarios")
      .select("*")
      .eq("caso_id", casoId)
      .order("creado_en", { ascending: true })
      .then(function (res) {
        lanzarSiError(res);
        return res.data || [];
      });
  }

  function addComentario(casoId, contenido) {
    return getUserId().then(function (uid) {
      return EpeSupabase.from("caso_comentarios")
        .insert({ caso_id: casoId, autor_id: uid, contenido: contenido || "" })
        .select("*")
        .single()
        .then(function (res) {
          lanzarSiError(res);
          return res.data;
        });
    });
  }

  function removeComentario(comentarioId) {
    return EpeSupabase.from("caso_comentarios")
      .delete()
      .eq("id", comentarioId)
      .then(function (res) {
        lanzarSiError(res);
      });
  }

  // ── Avisos de mensajes sin leer (ver supabase/012_comentarios_vistos.sql) ─
  // Misma marca de "visto" para el espacio personal y para el panel de
  // staff (ver EpeAdminStore.getNoLeidosStaff) — cada usuario tiene la
  // suya, independiente de la de los demás.

  // Se llama al abrir el Espacio compartido de una colección (ver
  // casos.js y admin/panel.js). upsert: la primera vez inserta, las
  // siguientes actualiza la misma fila (caso_id, usuario_id).
  function marcarComentariosVistos(casoId) {
    return getUserId().then(function (uid) {
      return EpeSupabase.from("caso_comentarios_vistos")
        .upsert({ caso_id: casoId, usuario_id: uid, visto_en: new Date().toISOString() }, { onConflict: "caso_id,usuario_id" })
        .then(function (res) {
          lanzarSiError(res);
        });
    });
  }

  // Promise<{ [casoId]: cantidadNoLeidos }> — solo trae las colecciones
  // que SÍ tienen algo sin leer (ver la función en Postgres), así que un
  // caso ausente del mapa significa "nada pendiente", no cero explícito.
  function getNoLeidos() {
    return EpeSupabase.rpc("mis_casos_no_leidos").then(function (res) {
      lanzarSiError(res);
      var mapa = {};
      (res.data || []).forEach(function (fila) {
        mapa[fila.caso_id] = fila.no_leidos;
      });
      return mapa;
    });
  }

  return {
    getProfile: getProfile,
    saveProfile: saveProfile,
    getInstituciones: getInstituciones,
    verificarInstitucion: verificarInstitucion,
    elegirInstitucionSinVerificar: elegirInstitucionSinVerificar,
    setInstitucionPendiente: setInstitucionPendiente,
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
    getUserId: getUserId,
    listComentarios: listComentarios,
    addComentario: addComentario,
    removeComentario: removeComentario,
    marcarComentariosVistos: marcarComentariosVistos,
    getNoLeidos: getNoLeidos,
  };
})();
