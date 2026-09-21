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
 * Las dos entradas "tercero" de abajo son EJEMPLO/placeholder para
 * prototipar la interfaz (marcadas explícitamente) — reemplazar por
 * recursos reales curados cuando se decida qué sumar al catálogo público.
 *
 * HOY esto es un array fijo a mano. El día que haya Supabase, este mismo
 * archivo se reemplaza por una tabla `catalogo_actividades` (mismas
 * columnas que los objetos de abajo) con un endpoint de lectura —
 * casos.js y store.js no deberían necesitar cambios, solo este archivo.
 * Para sumar una app de terceros al catálogo público a mano mientras
 * tanto, alcanza con agregar un objeto nuevo al array ENTRADAS de abajo.
 *
 * Script clásico (ver theme.js). Namespace: EpeCatalogo.
 */

var EpeCatalogo = (function () {
  // Mismos íconos que usa apps-epe/index.html, para que una actividad se
  // vea igual en la tienda del caso y en la página de Apps EpE.
  var ICONOS = {
    piano:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>',
    barrido:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.5" /></svg>',
    "vincular-imagen":
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>',
    generico:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h6v6H9z" /></svg>',
    externo:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>',
  };

  // autor: "dis+capacidad" para las Apps EpE propias; el nombre del
  // tercero (ej. "MakeyMakey") para las entradas tipo "tercero". La UI usa
  // este campo para distinguir "propia" de "de terceros" en el badge.
  var ENTRADAS = [
    {
      id: "app-epe-piano",
      tipo: "app-epe",
      nombre: "Piano",
      descripcion: "7 notas con teclado o puntero, para practicar acceso por switch.",
      categoria: "Música y sonido",
      autor: "dis+capacidad",
      url: "../apps-epe/piano.html",
      icono: ICONOS.piano,
    },
    {
      id: "app-epe-barrido",
      tipo: "app-epe",
      nombre: "Barrido",
      descripcion: "Entrenador de barrido por tiempo o por 2 pulsadores, copiando una palabra.",
      categoria: "Acceso por switch",
      autor: "dis+capacidad",
      url: "../apps-epe/barrido.html",
      icono: ICONOS.barrido,
    },
    {
      id: "app-epe-vincular-imagen",
      tipo: "app-epe",
      nombre: "Vincular imagen",
      descripcion: "De 1 a 8 casilleros con imagen propia, texto a voz y tecla asignable.",
      categoria: "Comunicación",
      autor: "dis+capacidad",
      url: "../apps-epe/vincular-imagen.html",
      icono: ICONOS["vincular-imagen"],
    },
    // ── Apps de terceros (catálogo público, curado) ──────────────────
    // Las dos de abajo son EJEMPLO para prototipar el picker y el modal
    // de detalle — reemplazar `url` por el proyecto real cuando se elija
    // cuál sumar de verdad al catálogo.
    {
      id: "tercero-makeymakey-piano-frutas",
      tipo: "tercero",
      nombre: "Piano de frutas (MakeyMakey + Scratch)",
      descripcion: "Ejemplo — reemplazar por el recurso real: tocar frutas conectadas al MakeyMakey suena como teclas de piano en un proyecto de Scratch.",
      categoria: "Música y sonido",
      autor: "MakeyMakey",
      instrucciones:
        "Conectá cada objeto conductor (frutas, plastilina conductora, papel aluminio) a una de las entradas de flecha o espacio del MakeyMakey con un cable caimán, y otro cable de la entrada \"EARTH\" a la mano o el cuerpo de la persona (o a una superficie que esté tocando). Al tocar el objeto conductor mientras se toca tierra, se cierra el circuito y se presiona esa tecla en el proyecto.",
      configuracion:
        "MakeyMakey conectado por USB, configurado como teclado (modo por defecto). No requiere ningún dispositivo dismascapacidad adicional. Conviene revisar antes que el objeto elegido conduzca electricidad razonablemente bien (fruta fresca, no seca).",
      url: "https://makeymakey.com/",
      icono: ICONOS.externo,
    },
    {
      id: "tercero-makeymakey-comunicador",
      tipo: "tercero",
      nombre: "Comunicador básico (MakeyMakey + Scratch)",
      descripcion: "Ejemplo — reemplazar por el recurso real: entradas grandes que emulan teclas de flecha/espacio para armar un comunicador simple en Scratch.",
      categoria: "Comunicación",
      autor: "MakeyMakey",
      instrucciones:
        "Cada pulsador o superficie conductora conectada a una entrada del MakeyMakey dispara una tecla del proyecto de Scratch elegido. Conviene definir antes con qué mensaje o imagen va a asociarse cada entrada disponible.",
      configuracion:
        "MakeyMakey como teclado (modo por defecto), USB. Si se usan pulsadores externos en vez de tocar directo el MakeyMakey, hace falta un cable caimán por pulsador hacia cada entrada usada, más el cable de tierra común.",
      url: "https://makeymakey.com/",
      icono: ICONOS.externo,
    },
  ];

  function getAll() {
    return ENTRADAS.slice();
  }

  function getById(id) {
    return (
      ENTRADAS.find(function (a) {
        return a.id === id;
      }) || null
    );
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
