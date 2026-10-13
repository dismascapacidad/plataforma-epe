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
 * - ejemplo: true mientras el material sea de prueba (sin archivo real).
 *
 * Hoy es un array fijo. getAll() ya devuelve una Promise, igual que
 * EpeCatalogo, para que el día que pase a una tabla de Supabase no cambie
 * cómo lo consume el resto de la plataforma.
 *
 * Script clásico (ver theme.js). Namespace: EpeCatalogoMateriales.
 */

var EpeCatalogoMateriales = (function () {
  // MATERIALES DE EJEMPLO: reemplazar por los reales cuando existan.
  // Para probar con uno real, completar driveId / youtubeId y sacar `ejemplo`.
  var MATERIALES = [
    {
      id: "mat-ejemplo-pdf-publico",
      tipo: "pdf",
      titulo: "Ejemplo: guía rápida de inicio",
      descripcion: "Material de ejemplo (PDF abierto a todo el mundo). Todavía no tiene archivo asignado.",
      categoria: "Guías",
      acceso: "publico",
      driveId: null,
      ejemplo: true,
    },
    {
      id: "mat-ejemplo-pdf-logueado-1",
      tipo: "pdf",
      titulo: "Ejemplo: manual completo de dispositivos",
      descripcion: "Material de ejemplo (PDF para quienes tienen cuenta). Todavía no tiene archivo asignado.",
      categoria: "Manuales",
      acceso: "logueado",
      driveId: null,
      ejemplo: true,
    },
    {
      id: "mat-ejemplo-pdf-logueado-2",
      tipo: "pdf",
      titulo: "Ejemplo: bibliografía comentada",
      descripcion: "Material de ejemplo (PDF para quienes tienen cuenta). Todavía no tiene archivo asignado.",
      categoria: "Bibliografía",
      acceso: "logueado",
      driveId: null,
      ejemplo: true,
    },
    {
      id: "mat-ejemplo-video-publico",
      tipo: "video",
      titulo: "Ejemplo: tutorial en video",
      descripcion: "Material de ejemplo (video abierto a todo el mundo). Todavía no tiene video asignado.",
      categoria: "Tutoriales",
      acceso: "publico",
      youtubeId: null,
      ejemplo: true,
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

  function getById(id) {
    var hallado = MATERIALES.filter(function (m) {
      return m.id === id;
    })[0];
    return Promise.resolve(hallado || null);
  }

  return { getAll: getAll, getById: getById, urlsDe: urlsDe };
})();
