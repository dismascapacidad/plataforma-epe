/**
 * catalogo-materiales.js
 * Catálogo del "Material de consulta": PDF alojados en Google Drive y videos
 * de un canal de YouTube de dis+capacidad. Ni los PDF ni los videos viven en
 * el repo ni en Supabase: acá solo está la ficha de cada material.
 *
 * Cada material tiene:
 * - id: estable y único. Es lo que, más adelante, va a guardar una colección
 *   del espacio personal para vincular el material (igual que caso_actividades
 *   guarda el id de una entrada de EpeCatalogo). Una vez publicado, NO se
 *   cambia.
 * - tipo: "pdf" | "video".
 * - titulo, descripcion, categoria: texto para la card.
 * - acceso: "publico" (lo ve cualquiera) | "logueado" (la card se ve siempre,
 *   pero el material solo se abre con sesión iniciada).
 *   OJO: es un incentivo para crear cuenta, NO un mecanismo de seguridad. El
 *   PDF de Drive tiene acceso por link y este archivo es público, así que
 *   cualquiera que lo lea puede llegar al link. Nada sensible va acá.
 * - driveId (pdf): el id del archivo en Drive, la parte entre /d/ y /view de
 *   https://drive.google.com/file/d/ID/view
 * - youtubeId (video): el id de 11 caracteres de https://youtu.be/ID
 *   No se guardan URLs enteras: se arman en urlsDe() a partir del id ya
 *   validado, así nunca se abre un link que no sea de Drive o YouTube.
 * - modulo (opcional): id de un módulo de MODULOS (que a su vez pertenece a un
 *   curso de CURSOS). Agrupa el material; no afecta a los vínculos.
 * - imagen (opcional): ruta de una captura propia (assets/img/materiales/...,
 *   relativa a la raíz del sitio, sin "../"). Sin imagen, la card usa el ícono.
 *   Los cursos también pueden tener `imagen` (su portada).
 * - ejemplo (opcional): true mientras el material sea de prueba (sin archivo real).
 *
 * Hoy es un array fijo. getAll() ya devuelve una Promise, igual que
 * EpeCatalogo, para que el día que pase a una tabla de Supabase no cambie
 * cómo lo consume el resto de la plataforma.
 *
 * Script clásico (ver theme.js). Namespace: EpeCatalogoMateriales.
 */

var EpeCatalogoMateriales = (function () {
  // Cursos y módulos: organizan los materiales. La página pública muestra UNA
  // card por curso (al abrirla, sus PDF agrupados por módulo); los selectores de
  // las colecciones agrupan por módulo. Un material pertenece a un módulo con
  // `modulo: "<id>"` y cada módulo a un curso con `curso: "<id>"`. Un material
  // sin módulo (o con un módulo sin curso) se muestra suelto, como card propia.
  // El orden de estos arrays es el orden en pantalla. Es solo presentación: lo
  // que una colección guarda sigue siendo el id del material, así que
  // reorganizar cursos o módulos no rompe ningún vínculo.
  // `imagen` (opcional): portada del curso, ver rutaImagen().
  var CURSOS = [
    {
      id: "ta-epe",
      titulo: "Curso TA + EpE",
      descripcion: "Curso de tecnología asistiva y Equipar para Equipar, en cuatro bloques con sus anexos.",
    },
  ];

  var MODULOS = [
    { id: "ta-epe-b1", curso: "ta-epe", titulo: "Bloque 1 · Introducción" },
    { id: "ta-epe-b2", curso: "ta-epe", titulo: "Bloque 2 · Acceso indirecto" },
    { id: "ta-epe-b3", curso: "ta-epe", titulo: "Bloque 3 · Acceso directo" },
    { id: "ta-epe-b4", curso: "ta-epe", titulo: "Bloque 4 · Comunicación alternativa aumentativa" },
  ];

  // Curso TA + EpE. Los PDF están en Drive con acceso por link (versiones con
  // marca de agua). Para sumar uno: copiar el id del link de Drive, elegir módulo
  // y, si hay captura, guardarla en assets/img/materiales/<id>.webp (640×480) y
  // poner `imagen`. Sin `imagen` la card muestra el ícono del tipo.
  var MATERIALES = [
    {
      id: "ta-epe-b1-introduccion",
      modulo: "ta-epe-b1",
      tipo: "pdf",
      titulo: "Introducción general",
      descripcion: "Presentación del curso de tecnología asistiva y de la plataforma Equipar para Equipar.",
      categoria: "Curso",
      acceso: "publico",
      driveId: "1PHisBV8aAmqiOLbZSBc3igpqpY-3ds44",
    },
    {
      id: "ta-epe-b2-acceso-indirecto",
      modulo: "ta-epe-b2",
      tipo: "pdf",
      titulo: "Acceso indirecto",
      descripcion: "Contenido del Bloque 2 del curso: acceso indirecto a dispositivos.",
      categoria: "Curso",
      acceso: "logueado",
      driveId: "1BTbmh-noQW9FtrRLWcEcNzhQtQxGDY_I",
    },
    {
      id: "ta-epe-b2-anexo-android-ios",
      modulo: "ta-epe-b2",
      tipo: "pdf",
      titulo: "Anexo: acceso indirecto en Android e iOS",
      descripcion: "Anexo del Bloque 2: cómo configurar el acceso indirecto en celulares y tablets.",
      categoria: "Anexo",
      acceso: "logueado",
      driveId: "1M8VWAkh65HsbfS7la8KUj375m-Dgs4P8",
    },
    {
      id: "ta-epe-b2-anexo-windows-macos",
      modulo: "ta-epe-b2",
      tipo: "pdf",
      titulo: "Anexo: acceso indirecto en Windows y macOS",
      descripcion: "Anexo del Bloque 2: cómo configurar el acceso indirecto en computadoras.",
      categoria: "Anexo",
      acceso: "logueado",
      driveId: "13VKv9DEMUYJtXcqNUSkxEBDtdbCzDL5W",
    },
    {
      id: "ta-epe-b3-acceso-directo",
      modulo: "ta-epe-b3",
      tipo: "pdf",
      titulo: "Acceso directo",
      descripcion: "Contenido del Bloque 3 del curso: acceso directo a dispositivos.",
      categoria: "Curso",
      acceso: "logueado",
      driveId: "1J9h6ySWkCurP_ORd0W1LBIPG97sR-XTl",
    },
    {
      id: "ta-epe-b3-anexo-dismouse",
      modulo: "ta-epe-b3",
      tipo: "pdf",
      titulo: "Anexo: manual del disMouse",
      descripcion: "Anexo del Bloque 3: manual de uso del disMouse.",
      categoria: "Anexo",
      acceso: "logueado",
      driveId: "1ZAHQ5HAqDHVgVJigNEVOMlVfcYZV8Q-o",
    },
    {
      id: "ta-epe-b3-anexo-configurador-web",
      modulo: "ta-epe-b3",
      tipo: "pdf",
      titulo: "Anexo: manual del configurador web",
      descripcion: "Anexo del Bloque 3: manual del configurador web de dispositivos.",
      categoria: "Anexo",
      acceso: "logueado",
      driveId: "1yAWQLGtvrUHjOkeM-WWcWs9Ppyo-c3E5",
    },
    {
      id: "ta-epe-b4-caa",
      modulo: "ta-epe-b4",
      tipo: "pdf",
      titulo: "Comunicación alternativa aumentativa",
      descripcion: "Contenido del Bloque 4 del curso: comunicación alternativa aumentativa.",
      categoria: "Curso",
      acceso: "logueado",
      driveId: "12O6iOdRkIT2Bh2Nxj7eMnP7Y87V_wVE8",
    },
    {
      id: "ta-epe-b4-anexo-asterics-grid",
      modulo: "ta-epe-b4",
      tipo: "pdf",
      titulo: "Anexo: AsTeRICS Grid",
      descripcion: "Anexo del Bloque 4: uso de AsTeRICS Grid para armar tableros de comunicación.",
      categoria: "Anexo",
      acceso: "logueado",
      driveId: "1nmdLtLmyz2LSGVG5VBDWgGN7OZgyMtUW",
    },
  ];

  var ID_DRIVE = /^[A-Za-z0-9_-]{10,}$/;
  var ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

  /**
   * URLs de un material, o null si todavía no tiene archivo (o el id no es
   * válido). pdf → { ver }. video → { embed, ver }.
   * `embed` usa youtube-nocookie.com (modo de privacidad ampliada).
   */
  function urlsDe(m) {
    if (!m) return null;
    if (m.tipo === "pdf" && typeof m.driveId === "string" && ID_DRIVE.test(m.driveId)) {
      return { ver: "https://drive.google.com/file/d/" + m.driveId + "/view" };
    }
    if (m.tipo === "video" && typeof m.youtubeId === "string" && ID_YOUTUBE.test(m.youtubeId)) {
      return {
        embed: "https://www.youtube-nocookie.com/embed/" + m.youtubeId + "?rel=0",
        ver: "https://www.youtube.com/watch?v=" + m.youtubeId,
      };
    }
    return null;
  }

  function getAll() {
    return Promise.resolve(MATERIALES.slice());
  }

  var RUTA_IMAGEN = /^assets\/img\/materiales\/[a-z0-9._-]+\.(webp|png|jpg)$/;

  /**
   * Ruta de la captura del material (relativa a la raíz del sitio) o null.
   * Solo se aceptan archivos de assets/img/materiales/: quien la use antepone
   * "../" desde las páginas que están una carpeta adentro.
   */
  function rutaImagen(m) {
    return m && typeof m.imagen === "string" && RUTA_IMAGEN.test(m.imagen) ? m.imagen : null;
  }

  function getModulos() {
    return Promise.resolve(MODULOS.slice());
  }

  function getCursos() {
    return Promise.resolve(CURSOS.slice());
  }

  function cursoDeModulo(moduloId) {
    var mod = MODULOS.filter(function (x) {
      return x.id === moduloId;
    })[0];
    if (!mod) return null;
    return (
      CURSOS.filter(function (c) {
        return c.id === mod.curso;
      })[0] || null
    );
  }

  /** Los materiales de `lista` que pertenecen al curso. */
  function materialesDeCurso(cursoId, lista) {
    return lista.filter(function (m) {
      var c = cursoDeModulo(m.modulo);
      return !!c && c.id === cursoId;
    });
  }

  /** Los materiales de `lista` que no pertenecen a ningún curso. */
  function sinCurso(lista) {
    return lista.filter(function (m) {
      return !cursoDeModulo(m.modulo);
    });
  }

  /**
   * Agrupa una lista de materiales por módulo, en el orden de MODULOS.
   * Devuelve [{ modulo: {id, curso, titulo} | null, materiales: [...] }]; el grupo
   * sin módulo (modulo: null) va al final y solo si hay materiales sueltos.
   * Los grupos vacíos no se devuelven.
   */
  function agruparPorModulo(lista) {
    var grupos = MODULOS.map(function (mod) {
      return {
        modulo: mod,
        materiales: lista.filter(function (m) {
          return m.modulo === mod.id;
        }),
      };
    });
    var sueltos = lista.filter(function (m) {
      return !MODULOS.some(function (mod) {
        return mod.id === m.modulo;
      });
    });
    grupos.push({ modulo: null, materiales: sueltos });
    return grupos.filter(function (g) {
      return g.materiales.length > 0;
    });
  }

  function getById(id) {
    var hallado = MATERIALES.filter(function (m) {
      return m.id === id;
    })[0];
    return Promise.resolve(hallado || null);
  }

  return { getAll: getAll, getById: getById, getModulos: getModulos, getCursos: getCursos, cursoDeModulo: cursoDeModulo, materialesDeCurso: materialesDeCurso, sinCurso: sinCurso, rutaImagen: rutaImagen, agruparPorModulo: agruparPorModulo, urlsDe: urlsDe };
})();
