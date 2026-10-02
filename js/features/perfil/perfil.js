/**
 * perfil.js
 * Sección "Perfil" del dashboard: una card de resumen (avatar con
 * iniciales + nombre/profesión/institución) arriba del formulario de
 * edición. Lee y guarda a través de EpeStore — no toca Supabase
 * directamente. Todo acá es async: EpeStore habla por red (ver
 * data/store.js).
 *
 * Script clásico. Namespace: EpePerfil.
 */

var EpePerfil = (function () {
  function iniciales(nombre, email) {
    var base = (nombre || "").trim();
    if (base) {
      var partes = base.split(/\s+/);
      var letras = partes[0].charAt(0) + (partes[1] ? partes[1].charAt(0) : "");
      return letras.toUpperCase();
    }
    return (email || "?").charAt(0).toUpperCase();
  }

  // Saludo de la parte de arriba del dashboard ("Hola, Gon") — no es parte
  // del panel Perfil en sí (vive en el <h1> de .epe-intro), pero se actualiza
  // acá porque es este módulo el que primero tiene el nombre cargado. Usa
  // solo el nombre de pila: más natural que el nombre completo en un saludo.
  function actualizarSaludo(datos) {
    var saludo = document.querySelector("[data-saludo]");
    if (!saludo) return;
    var nombrePila = (datos.nombre || "").trim().split(/\s+/)[0];
    saludo.textContent = nombrePila ? "Hola, " + nombrePila : "Tu espacio personal";
  }

  function actualizarResumen(root, datos, email) {
    var avatar = root.querySelector("[data-perfil-avatar]");
    var nombreEl = root.querySelector("[data-perfil-resumen-nombre]");
    var detalleEl = root.querySelector("[data-perfil-resumen-detalle]");

    avatar.textContent = iniciales(datos.nombre, email);

    var nombre = (datos.nombre || "").trim();
    nombreEl.textContent = nombre || email || "Tu perfil";

    var detalle = [datos.profesion, datos.institucion_nombre || datos.institucion_pendiente]
      .map(function (v) {
        return (v || "").trim();
      })
      .filter(Boolean)
      .join(" · ");
    detalleEl.textContent = detalle || email || "";
  }

  // ── Institución (entidad propia) ──────────────────────────────────────
  // Separada del formulario principal a propósito: elegir/verificar una
  // institución es una afirmación de pertenencia, no un campo de texto más
  // (ver EpeStore y supabase/010_instituciones_y_staff.sql). Vuelve a leer
  // EpeStore.getProfile() después de cada acción en vez de armar el estado
  // a mano acá, para no duplicar la lógica de qué significa cada
  // combinación de institucion_id/institucion_pendiente/verificada.
  function initInstitucion(root) {
    var select = root.querySelector("[data-institucion-select]");
    var campoPendiente = root.querySelector("[data-institucion-pendiente-campo]");
    var inputPendiente = root.querySelector("#perfil-institucion-pendiente");
    var campoCodigo = root.querySelector("[data-institucion-codigo-campo]");
    var inputCodigo = root.querySelector("#perfil-institucion-codigo");
    var estado = root.querySelector("[data-institucion-estado]");
    var status = root.querySelector("[data-institucion-status]");
    var boton = root.querySelector("[data-institucion-guardar]");
    var botonDejar = root.querySelector("[data-institucion-dejar]");
    if (!select) return Promise.resolve(); // página vieja sin este bloque todavía

    function actualizarCampos() {
      var esOtra = select.value === "_otra";
      campoPendiente.hidden = !esOtra;
      campoCodigo.hidden = !select.value || esOtra;
    }

    // "aviso" (cuestión a resolver, ver css/components/form-field.css) solo
    // para los dos estados que también ve el staff en la pestaña
    // Pendientes del panel — no para "todavía no elegiste", que no es un
    // trámite trabado, es simplemente algo que no hiciste todavía.
    function actualizarEstado(datos) {
      if (datos.institucion_id && datos.institucion_verificada) {
        estado.textContent = "Institución verificada: " + datos.institucion_nombre + ".";
        estado.classList.remove("epe-field-hint-aviso");
      } else if (datos.institucion_id) {
        estado.textContent = "Elegiste " + datos.institucion_nombre + ", todavía sin verificar — pedile el código a dis+capacidad para confirmarla.";
        estado.classList.add("epe-field-hint-aviso");
      } else if (datos.institucion_pendiente) {
        estado.textContent = 'Avisaste "' + datos.institucion_pendiente + '" — dis+capacidad la va a dar de alta pronto.';
        estado.classList.add("epe-field-hint-aviso");
      } else {
        estado.textContent = "Todavía no elegiste tu institución.";
        estado.classList.remove("epe-field-hint-aviso");
      }
    }

    function cargar() {
      return Promise.all([EpeStore.getInstituciones(), EpeStore.getProfile()]).then(function (resultados) {
        var instituciones = resultados[0];
        var datos = resultados[1];

        select.innerHTML = "";
        var vacia = document.createElement("option");
        vacia.value = "";
        vacia.textContent = "Elegí tu institución…";
        select.appendChild(vacia);
        instituciones.forEach(function (inst) {
          var option = document.createElement("option");
          option.value = inst.id;
          option.textContent = inst.nombre;
          select.appendChild(option);
        });
        var otra = document.createElement("option");
        otra.value = "_otra";
        otra.textContent = "Mi institución no está en la lista";
        select.appendChild(otra);

        select.value = datos.institucion_id || (datos.institucion_pendiente ? "_otra" : "");
        inputPendiente.value = datos.institucion_pendiente || "";
        inputCodigo.value = "";
        actualizarCampos();
        actualizarEstado(datos);
        botonDejar.hidden = !datos.institucion_id && !datos.institucion_pendiente;
        return datos;
      });
    }

    select.addEventListener("change", actualizarCampos);

    boton.addEventListener("click", function () {
      boton.disabled = true;
      status.textContent = "Guardando…";

      var promesa;
      if (select.value === "_otra") {
        var texto = inputPendiente.value.trim();
        promesa = EpeStore.setInstitucionPendiente(texto);
      } else if (select.value) {
        var codigo = inputCodigo.value.trim();
        promesa = codigo
          ? EpeStore.verificarInstitucion(select.value, codigo).then(function (coincide) {
              if (coincide) return;
              // El código no coincidió: igual queda elegida, sin verificar
              // (no bloquea el uso de la plataforma — ver ADR).
              return EpeStore.elegirInstitucionSinVerificar(select.value).then(function () {
                status.textContent = "El código no coincide — guardado igual, sin verificar.";
              });
            })
          : EpeStore.elegirInstitucionSinVerificar(select.value);
      } else {
        boton.disabled = false;
        return;
      }

      promesa
        .then(function () {
          return cargar();
        })
        .then(function (datos) {
          actualizarResumen(root, datos, "");
          if (!status.textContent || status.textContent === "Guardando…") status.textContent = "Guardado.";
          window.clearTimeout(status._epeTimeout);
          status._epeTimeout = window.setTimeout(function () {
            status.textContent = "";
          }, 3000);
        })
        .catch(function (err) {
          status.textContent = "No se pudo guardar." + (err && err.message ? " (" + err.message + ")" : "");
        })
        .finally(function () {
          boton.disabled = false;
        });
    });

    // Dejar la institución: acción separada de "Guardar" porque, a
    // diferencia de elegir una, esto tiene una consecuencia hacia el
    // resto de tus colecciones (deja de verse lo compartido con ella, y
    // dejás de ver lo que compartieron con vos) — se avisa en el propio
    // confirm en vez de un modal aparte.
    botonDejar.addEventListener("click", function () {
      if (
        !window.confirm(
          "¿Dejar tu institución actual? Vos vas a dejar de ver lo que tus colegas compartieron con la institución, y ellos van a dejar de ver lo que vos compartiste con ella."
        )
      ) {
        return;
      }
      botonDejar.disabled = true;
      status.textContent = "Guardando…";

      EpeStore.dejarInstitucion()
        .then(function () {
          return cargar();
        })
        .then(function (datos) {
          actualizarResumen(root, datos, "");
          status.textContent = "Listo — ya no pertenecés a ninguna institución.";
          window.clearTimeout(status._epeTimeout);
          status._epeTimeout = window.setTimeout(function () {
            status.textContent = "";
          }, 3000);
        })
        .catch(function (err) {
          status.textContent = "No se pudo completar." + (err && err.message ? " (" + err.message + ")" : "");
        })
        .finally(function () {
          botonDejar.disabled = false;
        });
    });

    return cargar();
  }

  // email: el de la sesión (dashboard.js ya lo tiene, evita pedirlo de
  // nuevo acá) — se usa como respaldo cuando todavía no hay nombre
  // cargado en el perfil.
  function init(root, email) {
    if (!root) return;

    var form = root.querySelector("[data-perfil-form]");
    var status = root.querySelector("[data-perfil-status]");
    if (!form) return;

    actualizarResumen(root, { nombre: "", profesion: "", institucion_nombre: "" }, email);
    initInstitucion(root);

    status.textContent = "Cargando…";
    EpeStore.getProfile()
      .then(function (datos) {
        form.elements.nombre.value = datos.nombre || "";
        form.elements.profesion.value = datos.profesion || "";
        form.elements.telefono.value = datos.telefono || "";
        form.elements.localidad.value = datos.localidad || "";
        form.elements.email_contacto.value = datos.email_contacto || "";
        actualizarResumen(root, datos, email);
        actualizarSaludo(datos);
        status.textContent = "";
      })
      .catch(function () {
        status.textContent = "No se pudo cargar el perfil. Recargá la página.";
      });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var boton = form.querySelector("button[type=submit]");
      boton.disabled = true;
      status.textContent = "Guardando…";

      var datos = {
        nombre: form.elements.nombre.value.trim(),
        profesion: form.elements.profesion.value.trim(),
        telefono: form.elements.telefono.value.trim(),
        localidad: form.elements.localidad.value.trim(),
        email_contacto: form.elements.email_contacto.value.trim(),
      };

      EpeStore.saveProfile(datos)
        .then(function () {
          // Se vuelve a pedir el perfil completo (en vez de usar el `datos`
          // de arriba tal cual) porque éste no incluye institución — así el
          // resumen de arriba no "pierde" la institución al guardar los
          // demás campos.
          return EpeStore.getProfile();
        })
        .then(function (datosCompletos) {
          actualizarResumen(root, datosCompletos, email);
          actualizarSaludo(datosCompletos);
          status.textContent = "Guardado.";
          window.clearTimeout(status._epeTimeout);
          status._epeTimeout = window.setTimeout(function () {
            status.textContent = "";
          }, 2000);
        })
        .catch(function () {
          status.textContent = "No se pudo guardar. Revisá tu conexión e intentá de nuevo.";
        })
        .finally(function () {
          boton.disabled = false;
        });
    });
  }

  return { init: init };
})();
