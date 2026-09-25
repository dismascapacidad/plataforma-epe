/**
 * catalogo-actividades.js
 * "Tienda de apps" de actividades vinculables a un caso: hoy son las Apps
 * EpE propias, pero está pensado para crecer con apps de terceros
 * (AsTeRICS, Cboard, lo que sea) sin cambiar cómo el resto de la
 * plataforma lo consume.
 *
 * "Vincular" una actividad a un caso NUNCA instancia ni copia la app: solo
 * guarda una referencia a una entrada de este catálogo (ver
 * caso_actividades en data/store.js). Por eso el catálogo es de
 * solo-lectura desde la UI por ahora — es la fuente de verdad de qué apps
 * existen "para todo el mundo", no datos del usuario.
 *
 * Dos tipos de entrada, campo `tipo`:
 * - "app-epe": las Apps EpE propias (apps-epe/*.html). Se abren directo
 *   con "Abrir" — no necesitan indicaciones, la app se explica sola.
 * - "tercero": un link a un recurso externo (ej. un proyecto de
 *   MakeyMakey). Suman `instrucciones` (cómo se usa) y `configuracion`
 *   (qué hace falta armar en el dispositivo para que funcione) — se
 *   muestran en un modal de detalle antes de abrir el link externo (ver
 *   casos.js). Las de acá son GLOBALES y curadas por dis+capacidad — para
 *   una app de terceros que un profesional arma para un caso puntual y
 *   solo ese caso ve, ver caso_apps_terceros en data/store.js: mismo
 *   shape de datos, pero vive aparte porque no es pública.
 *
 * MIGRADO a Supabase (tabla catalogo_actividades, ver
 * supabase/001_schema_inicial.sql): esto ya no es un array fijo, se trae
 * por red. Por eso getAll()/getById() devuelven Promises — quien llama
 * tiene que usar .then()/await (ver casos.js y apps-terceros.js). Se
 * cachea en memoria después del primer fetch porque el catálogo cambia
 * poco y varias pantallas lo piden seguido; recargar la página limpia la
 * caché.
 *
 * Depende de que supabase-client.js ya haya corrido. Es de lectura
 * PÚBLICA (funciona sin login: la usa apps-terceros/index.html, que no
 * pide sesión) — ver la policy "catalogo: lectura publica" en
 * supabase/002_patches.sql.
 *
 * Script clásico (ver theme.js). Namespace: EpeCatalogo.
 */

var EpeCatalogo = (function () {
  // Mismos íconos que usa apps-epe/index.html, para que una actividad se
  // vea igual en la tienda del caso y en la página de Apps EpE. La DB solo
  // guarda la CLAVE (icono_key); el SVG en sí sigue viviendo acá.
  var ICONOS = {
    piano:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>',
    barrido:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.5" /></svg>',
    "vincular-imagen":
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>',
    "lado-correcto":
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 7 5 12l5 5" /><path d="M5 12h7" /><path d="M14 7l5 5-5 5" /><path d="M19 12h-7" /></svg>',
    "duracion-pulsacion":
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="12" height="4" rx="2" /><circle cx="20" cy="12" r="1.6" /><path d="M17.5 8.5a5 5 0 0 1 0 7" /></svg>',
    hanoi:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v17" /><rect x="9" y="9" width="6" height="3" rx="1.5" /><rect x="6" y="13.5" width="12" height="3" rx="1.5" /><rect x="3" y="18" width="18" height="2.4" rx="1.2" /></svg>',
    nback:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>',
    stroop:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="5" /><circle cx="15" cy="15" r="5" /></svg>',
    generico:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h6v6H9z" /></svg>',
    externo:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>',
  };

  var cache = null; // null hasta el primer fetch exitoso; después, array en memoria.

  function mapRow(row) {
    return {
      id: row.id,
      tipo: row.tipo,
      nombre: row.nombre,
      descripcion: row.descripcion,
      categoria: row.categoria,
      autor: row.autor,
      instrucciones: row.instrucciones,
      configuracion: row.configuracion,
      url: row.url,
      icono: ICONOS[row.icono_key] || ICONOS.generico,
    };
  }

  // Promise<array>. Copia nueva en cada llamada (igual que antes con
  // .slice()) para que nadie mute la caché interna por accidente.
  function getAll() {
    if (cache) return Promise.resolve(cache.slice());
    return EpeSupabase.from("catalogo_actividades")
      .select("*")
      .order("creado_en", { ascending: true })
      .then(function (res) {
        if (res.error) throw res.error;
        cache = (res.data || []).map(mapRow);
        return cache.slice();
      });
  }

  // Promise<objeto|null>.
  function getById(id) {
    return getAll().then(function (lista) {
      return (
        lista.find(function (a) {
          return a.id === id;
        }) || null
      );
    });
  }

  return {
    getAll: getAll,
    getById: getById,
    // Ícono genérico para links externos: lo usa también casos.js para las
    // apps de terceros privadas de un caso (no tienen entrada acá, pero
    // son visualmente del mismo tipo "tercero").
    ICONO_EXTERNO: ICONOS.externo,
  };
})();
