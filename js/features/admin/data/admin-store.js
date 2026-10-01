/**
 * admin-store.js
 * Capa de datos del panel de staff de dis+capacidad. Todo pasa por
 * funciones de Postgres (security definer) creadas en
 * supabase/010_instituciones_y_staff.sql — cada una chequea por su
 * cuenta que quien llama esté en staff_dismascapacidad (no hace falta
 * duplicar ese chequeo acá: si no sos staff, la base devuelve vacío o
 * rechaza la acción).
 *
 * Depende de supabase-client.js. Script clásico (ver theme.js).
 * Namespace: EpeAdminStore.
 */

var EpeAdminStore = (function () {
  function lanzarSiError(res) {
    if (res.error) throw res.error;
    return res;
  }

  function soyStaff() {
    return EpeSupabase.rpc("soy_staff").then(function (res) {
      lanzarSiError(res);
      return !!res.data;
    });
  }

  function panelColecciones() {
    return EpeSupabase.rpc("panel_staff_colecciones").then(function (res) {
      lanzarSiError(res);
      return res.data || [];
    });
  }

  function pendientes() {
    return EpeSupabase.rpc("directorio_pendientes_staff").then(function (res) {
      lanzarSiError(res);
      return res.data || [];
    });
  }

  function listarInstituciones() {
    return EpeSupabase.rpc("listar_instituciones_staff").then(function (res) {
      lanzarSiError(res);
      return res.data || [];
    });
  }

  // Promise<{ id, nombre, codigo_acceso }>.
  function crearInstitucion(nombre) {
    return EpeSupabase.rpc("crear_institucion", { p_nombre: nombre }).then(function (res) {
      lanzarSiError(res);
      return (res.data && res.data[0]) || null;
    });
  }

  // Promise<string> (el código nuevo).
  function regenerarCodigo(institucionId) {
    return EpeSupabase.rpc("regenerar_codigo_institucion", { p_institucion_id: institucionId }).then(function (res) {
      lanzarSiError(res);
      return res.data;
    });
  }

  function verificarManual(profileId, institucionId) {
    return EpeSupabase.rpc("verificar_institucion_manual", {
      p_profile_id: profileId,
      p_institucion_id: institucionId,
    }).then(function (res) {
      lanzarSiError(res);
    });
  }

  return {
    soyStaff: soyStaff,
    panelColecciones: panelColecciones,
    pendientes: pendientes,
    listarInstituciones: listarInstituciones,
    crearInstitucion: crearInstitucion,
    regenerarCodigo: regenerarCodigo,
    verificarManual: verificarManual,
  };
})();
