/**
 * schema.js
 * Constantes compartidas del espacio personal: los mismos enums y formas
 * que van a existir como columnas reales en Supabase (ver
 * plataforma-epe/README.md, sección "Espacio personal (local, pre-Supabase)").
 * Un solo lugar para estos strings — nada de "nota" escrito a mano en otro
 * archivo.
 *
 * Script clásico, sin import/export (ver theme.js para la razón: file://).
 */

var EpeSchema = (function () {
  var ENTRADA_TIPOS = {
    NOTA: "nota",
    EVALUACION: "evaluacion",
    SESION: "sesion",
  };

  var ENTRADA_TIPO_LABELS = {
    nota: "Nota",
    evaluacion: "Evaluación",
    sesion: "Sesión",
  };

  // Coincide con caso_shares.tipo en el modelo de Supabase. "dismascapacidad"
  // reemplaza lo que en un borrador anterior se llamaba "mentor": no es un
  // rol jerárquico, es una opción más de para quién se hace visible el caso.
  var SHARE_TIPOS = {
    INSTITUCION: "institucion",
    COLEGA: "colega",
    DISMASCAPACIDAD: "dismascapacidad",
  };

  var SHARE_TIPO_LABELS = {
    institucion: "Institución",
    colega: "Colega",
    dismascapacidad: "dis+capacidad",
  };

  function nuevoId() {
    // Alcanza para local: no necesita ser un UUID real todavía. Cuando
    // migremos, Supabase genera los id (uuid) y esta función deja de usarse.
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  return {
    ENTRADA_TIPOS: ENTRADA_TIPOS,
    ENTRADA_TIPO_LABELS: ENTRADA_TIPO_LABELS,
    SHARE_TIPOS: SHARE_TIPOS,
    SHARE_TIPO_LABELS: SHARE_TIPO_LABELS,
    nuevoId: nuevoId,
  };
})();
