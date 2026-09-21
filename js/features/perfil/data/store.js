/**
 * store.js
 * Capa de datos del espacio personal. HOY guarda todo en localStorage;
 * mañana esto se reemplaza por llamadas a Supabase. Por eso la regla de
 * este archivo es estricta: nada fuera de acá debe leer o escribir
 * localStorage directamente para casos/actividades/entradas/shares, y
 * cada función expone la firma que va a tener su equivalente en Supabase
 * (ver plataforma-epe/README.md). El día de la migración, este archivo se
 * reescribe entero y el resto de la app (casos.js, perfil.js, dashboard.js)
 * no debería necesitar cambios.
 *
 * Script clásico (ver theme.js). Namespace: EpeStore.
 */

var EpeStore = (function () {
  var KEYS = {
    PROFILE: "epe-profile",
    CASOS: "epe-casos",
    ACTIVIDADES: "epe-actividades",
    APPS_TERCEROS: "epe-apps-terceros",
    ENTRADAS: "epe-entradas",
    SHARES: "epe-shares",
  };

  function read(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Sin storage disponible (modo privado, cuota llena): se pierde el
      // cambio en memoria en el próximo reload. No hay fallback local a esto.
    }
  }

  function readList(key) {
    var v = read(key);
    return Array.isArray(v) ? v : [];
  }

  // ── Perfil ──────────────────────────────────────────────────────────
  // Futuro Supabase: select/update sobre profiles donde id = auth.uid().

  function getProfile() {
    return (
      read(KEYS.PROFILE) || {
        nombre: "",
        profesion: "",
        institucion: "",
      }
    );
  }

  function saveProfile(datos) {
    var actual = getProfile();
    var next = {
      nombre: datos.nombre != null ? datos.nombre : actual.nombre,
      profesion: datos.profesion != null ? datos.profesion : actual.profesion,
      institucion: datos.institucion != null ? datos.institucion : actual.institucion,
    };
    write(KEYS.PROFILE, next);
    return next;
  }

  // ── Casos ───────────────────────────────────────────────────────────
  // Futuro Supabase: tabla casos, RLS por dueño_id = auth.uid() (+ shares).

  function getCasos() {
    return readList(KEYS.CASOS).slice().sort(function (a, b) {
      return (b.actualizado_en || "").localeCompare(a.actualizado_en || "");
    });
  }

  function getCaso(id) {
    return readList(KEYS.CASOS).find(function (c) {
      return c.id === id;
    }) || null;
  }

  function createCaso(datos) {
    var now = new Date().toISOString();
    var caso = {
      id: EpeSchema.nuevoId(),
      nombre: (datos && datos.nombre) || "Caso sin nombre",
      creado_en: now,
      actualizado_en: now,
    };
    var casos = readList(KEYS.CASOS);
    casos.push(caso);
    write(KEYS.CASOS, casos);
    return caso;
  }

  function updateCaso(id, datos) {
    var casos = readList(KEYS.CASOS);
    var idx = casos.findIndex(function (c) {
      return c.id === id;
    });
    if (idx === -1) return null;
    casos[idx] = Object.assign({}, casos[idx], datos, {
      actualizado_en: new Date().toISOString(),
    });
    write(KEYS.CASOS, casos);
    return casos[idx];
  }

  function deleteCaso(id) {
    write(
      KEYS.CASOS,
      readList(KEYS.CASOS).filter(function (c) {
        return c.id !== id;
      })
    );
    // Al borrar un caso se van con él sus actividades, entradas y shares:
    // igual que un ON DELETE CASCADE en la migración real.
    write(
      KEYS.ACTIVIDADES,
      readList(KEYS.ACTIVIDADES).filter(function (a) {
        return a.caso_id !== id;
      })
    );
    write(
      KEYS.APPS_TERCEROS,
      readList(KEYS.APPS_TERCEROS).filter(function (t) {
        return t.caso_id !== id;
      })
    );
    write(
      KEYS.ENTRADAS,
      readList(KEYS.ENTRADAS).filter(function (e) {
        return e.caso_id !== id;
      })
    );
    write(
      KEYS.SHARES,
      readList(KEYS.SHARES).filter(function (s) {
        return s.caso_id !== id;
      })
    );
  }

  // ── Actividades vinculadas a un caso ───────────────────────────────
  // "Vincular" una actividad NO instancia la app: guarda una referencia
  // (catalogo_id) a una entrada de js/data/catalogo-actividades.js. En
  // Supabase, caso_actividades sería (id, caso_id, catalogo_id,
  // agregado_en) — catalogo_id referenciando una tabla catalogo_actividades
  // en vez del array estático de hoy.

  function listActividades(casoId) {
    return readList(KEYS.ACTIVIDADES)
      .filter(function (a) {
        return a.caso_id === casoId;
      })
      .sort(function (a, b) {
        return (a.agregado_en || "").localeCompare(b.agregado_en || "");
      });
  }

  function hasActividad(casoId, catalogoId) {
    return readList(KEYS.ACTIVIDADES).some(function (a) {
      return a.caso_id === casoId && a.catalogo_id === catalogoId;
    });
  }

  function addActividad(casoId, catalogoId) {
    if (hasActividad(casoId, catalogoId)) return null; // no duplicar (ver casos.js)
    var actividad = {
      id: EpeSchema.nuevoId(),
      caso_id: casoId,
      catalogo_id: catalogoId,
      agregado_en: new Date().toISOString(),
    };
    var lista = readList(KEYS.ACTIVIDADES);
    lista.push(actividad);
    write(KEYS.ACTIVIDADES, lista);
    return actividad;
  }

  function removeActividad(actividadId) {
    write(
      KEYS.ACTIVIDADES,
      readList(KEYS.ACTIVIDADES).filter(function (a) {
        return a.id !== actividadId;
      })
    );
  }

  // ── Apps de terceros propias de un caso (privadas, NO van al catálogo) ─
  // A diferencia de caso_actividades (que referencia el catálogo público
  // EpeCatalogo), esto guarda los datos completos de la app inline: el
  // profesional la arma para ESTE caso puntual y solo quien vea este caso
  // la ve — nunca aparece en el picker de otro caso ni la ve nadie más.
  // Futuro Supabase: tabla caso_apps_terceros con RLS por caso_id (mismas
  // reglas de visibilidad que el resto del caso: dueño + shares).

  function listAppsTerceros(casoId) {
    return readList(KEYS.APPS_TERCEROS)
      .filter(function (t) {
        return t.caso_id === casoId;
      })
      .sort(function (a, b) {
        return (a.creado_en || "").localeCompare(b.creado_en || "");
      });
  }

  function addAppTercero(casoId, datos) {
    var app = {
      id: EpeSchema.nuevoId(),
      caso_id: casoId,
      nombre: (datos && datos.nombre) || "",
      descripcion: (datos && datos.descripcion) || "",
      instrucciones: (datos && datos.instrucciones) || "",
      configuracion: (datos && datos.configuracion) || "",
      url: (datos && datos.url) || "",
      creado_en: new Date().toISOString(),
    };
    var lista = readList(KEYS.APPS_TERCEROS);
    lista.push(app);
    write(KEYS.APPS_TERCEROS, lista);
    return app;
  }

  function removeAppTercero(appId) {
    write(
      KEYS.APPS_TERCEROS,
      readList(KEYS.APPS_TERCEROS).filter(function (t) {
        return t.id !== appId;
      })
    );
  }

  // ── Entradas del caso: nota / evaluación / sesión, tabla unificada ──

  function listEntradas(casoId) {
    return readList(KEYS.ENTRADAS)
      .filter(function (e) {
        return e.caso_id === casoId;
      })
      .sort(function (a, b) {
        return (b.creado_en || "").localeCompare(a.creado_en || "");
      });
  }

  function addEntrada(casoId, datos) {
    var entrada = {
      id: EpeSchema.nuevoId(),
      caso_id: casoId,
      tipo: (datos && datos.tipo) || EpeSchema.ENTRADA_TIPOS.NOTA,
      contenido: (datos && datos.contenido) || "",
      creado_en: new Date().toISOString(),
    };
    var lista = readList(KEYS.ENTRADAS);
    lista.push(entrada);
    write(KEYS.ENTRADAS, lista);
    return entrada;
  }

  function removeEntrada(entradaId) {
    write(
      KEYS.ENTRADAS,
      readList(KEYS.ENTRADAS).filter(function (e) {
        return e.id !== entradaId;
      })
    );
  }

  // ── Compartir (MOCK, no funcional) ─────────────────────────────────
  // Sin backend no hay a quién compartírselo de verdad: esto solo guarda
  // el estado del toggle en el propio navegador, para poder probar la UI.
  // compartido_con_user_id queda siempre null acá; en Supabase sería el
  // uuid del colega para tipo "colega" (para "institucion" y
  // "dismascapacidad" no apunta a un usuario puntual, es un flag de
  // visibilidad — ver el modelo en el README).

  function getShares(casoId) {
    return readList(KEYS.SHARES).filter(function (s) {
      return s.caso_id === casoId;
    });
  }

  function setShare(casoId, tipo, activo) {
    var shares = readList(KEYS.SHARES);
    var existente = shares.find(function (s) {
      return s.caso_id === casoId && s.tipo === tipo;
    });
    if (activo && !existente) {
      shares.push({
        id: EpeSchema.nuevoId(),
        caso_id: casoId,
        tipo: tipo,
        compartido_con_user_id: null,
        creado_en: new Date().toISOString(),
      });
    } else if (!activo && existente) {
      shares = shares.filter(function (s) {
        return s !== existente;
      });
    }
    write(KEYS.SHARES, shares);
    return getShares(casoId);
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
  };
})();
