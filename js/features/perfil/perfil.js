/**
 * perfil.js
 * Sección "Perfil" del dashboard: una card de resumen (avatar con
 * iniciales + nombre/profesión) arriba del formulario de edición, más
 * la lista de instituciones a las que pertenecés. Lee y guarda a través
 * de EpeStore — no toca Supabase directamente. Todo acá es async:
 * EpeStore habla por red (ver data/store.js).
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

  function detalleError(err) {
    return err && err.message ? " (" + err.message + ")" : "";
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

  // cantidadInstituciones es opcional — se pasa solo cuando ya se cargaron
  // (ver cargarInstituciones más abajo), así esta función no tiene que
  // pedirlas ella misma cada vez que se llama (p.ej. al guardar el
  // formulario principal, que no toca instituciones).
  function actualizarResumen(root, datos, email, cantidadInstituciones) {
    var avatar = root.querySelector("[data-perfil-avatar]");
    var nombreEl = root.querySelector("[data-perfil-resumen-nombre]");
    var detalleEl = root.querySelector("[data-perfil-resumen-detalle]");

    avatar.textContent = iniciales(datos.nombre, email);

    var nombre = (datos.nombre || "").trim();
    nombreEl.textContent = nombre || email || "Tu perfil";

    var partes = [(datos.profesion || "").trim()].filter(Boolean);
    if (typeof cantidadInstituciones === "number" && cantidadInstituciones > 0) {
      partes.push(cantidadInstituciones === 1 ? "1 institución" : cantidadInstituciones + " instituciones");
    }
    detalleEl.textContent = partes.join(" · ") || email || "";
  }

  // ── Instituciones (entidad propia, ahora puede haber varias) ─────────
  // Desde supabase/015_instituciones_multiples.sql un profesional puede
  // pertenecer a varias a la vez — ver EpeStore.misInstituciones(). Cada
  // fila trae también si sos admin de esa institución y cuántos admins
  // activos tiene (para avisar "sos el único").
  function initInstitucion(root) {
    var listaEl = root.querySelector("[data-instituciones-lista]");
    var select = root.querySelector("[data-institucion-select]");
    var campoPendiente = root.querySelector("[data-institucion-pendiente-campo]");
    var inputPendiente = root.querySelector("#perfil-institucion-pendiente");
    var campoCodigo = root.querySelector("[data-institucion-codigo-campo]");
    var inputCodigo = root.querySelector("#perfil-institucion-codigo");
    var status = root.querySelector("[data-institucion-status]");
    var boton = root.querySelector("[data-institucion-guardar]");
    if (!select) return Promise.resolve(); // página vieja sin este bloque todavía

    function actualizarCampos() {
      var esOtra = select.value === "_otra";
      campoPendiente.hidden = !esOtra;
      campoCodigo.hidden = !select.value || esOtra;
    }

    function textoEstado(inst) {
      if (inst.institucion_id && inst.verificada) return "Verificada.";
      if (inst.institucion_id) return "Todavía sin verificar — pedile el código a dis+capacidad.";
      return "dis+capacidad la va a dar de alta pronto.";
    }

    function abrirPedidoAdmin(inst) {
      EpeStore.getProfile().then(function (perfil) {
        var contenedor = document.createElement("div");
        var form = document.createElement("form");
        form.className = "epe-form-grid";

        var campoMensaje = document.createElement("div");
        campoMensaje.className = "epe-field";
        var labelMensaje = document.createElement("label");
        labelMensaje.textContent = "Mensaje para el equipo de dis+capacidad";
        var avisoPrivacidad = document.createElement("p");
        avisoPrivacidad.className = "epe-field-hint-privacidad";
        avisoPrivacidad.textContent = "Esto no es un caso clínico: no identifiques a la persona ni incluyas datos sensibles.";
        var textarea = document.createElement("textarea");
        textarea.required = true;
        campoMensaje.appendChild(labelMensaje);
        campoMensaje.appendChild(avisoPrivacidad);
        campoMensaje.appendChild(textarea);

        var campoTelefono = document.createElement("div");
        campoTelefono.className = "epe-field";
        var labelTelefono = document.createElement("label");
        labelTelefono.textContent = "Teléfono de contacto";
        var inputTelefono = document.createElement("input");
        inputTelefono.type = "tel";
        inputTelefono.value = perfil.telefono || "";
        inputTelefono.required = !perfil.telefono;
        campoTelefono.appendChild(labelTelefono);
        campoTelefono.appendChild(inputTelefono);
        if (!perfil.telefono) {
          var hintTelefono = document.createElement("span");
          hintTelefono.className = "epe-field-hint";
          hintTelefono.textContent = "No tenés un teléfono guardado en tu perfil — hace falta uno para esta solicitud.";
          campoTelefono.appendChild(hintTelefono);
        }

        var statusForm = document.createElement("span");
        statusForm.className = "epe-form-status";

        var btnEnviar = document.createElement("button");
        btnEnviar.type = "submit";
        btnEnviar.className = "epe-btn-acc epe-btn-sm";
        btnEnviar.textContent = "Enviar solicitud";

        form.appendChild(campoMensaje);
        form.appendChild(campoTelefono);
        form.appendChild(btnEnviar);
        form.appendChild(statusForm);

        form.addEventListener("submit", function (ev) {
          ev.preventDefault();
          btnEnviar.disabled = true;
          statusForm.textContent = "Enviando…";
          EpeStore.solicitarAdminInstitucion(inst.institucion_id, textarea.value.trim(), inputTelefono.value.trim())
            .then(function () {
              EpeModal.close();
              return cargar();
            })
            .catch(function (err) {
              statusForm.textContent = "No se pudo enviar." + detalleError(err);
              btnEnviar.disabled = false;
            });
        });

        contenedor.appendChild(form);
        EpeModal.open({ titulo: 'Pedir ser administrador de "' + (inst.institucion_nombre || "") + '"', contenido: contenedor });
      });
    }

    function abrirSugerirReemplazo(inst) {
      EpeStore.listarColegasInstitucion(inst.institucion_id)
        .then(function (colegas) {
          if (colegas.length === 0) {
            window.alert("No hay ningún otro profesional verificado en esta institución para sugerir — no debería pasar si la base te dejó llegar hasta acá, avisale a soporte.");
            return;
          }
          var contenedor = document.createElement("div");
          var p = document.createElement("p");
          p.className = "epe-panel-sub";
          p.textContent =
            'Sos el único administrador activo de "' +
            (inst.institucion_nombre || "") +
            '". Elegí quién te va a reemplazar para poder irte — mientras tanto, tu perfil sigue vinculado a la institución (para no perder tus colecciones), pero no vas a poder agregar ni modificar lo compartido con ella.';
          contenedor.appendChild(p);

          var select2 = document.createElement("select");
          colegas.forEach(function (c) {
            var o = document.createElement("option");
            o.value = c.profile_id;
            o.textContent = c.nombre || c.email || "Profesional";
            select2.appendChild(o);
          });
          contenedor.appendChild(select2);

          var statusSug = document.createElement("span");
          statusSug.className = "epe-form-status";

          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "epe-btn-acc epe-btn-sm";
          btn.textContent = "Sugerir y dejar la institución";
          btn.addEventListener("click", function () {
            btn.disabled = true;
            statusSug.textContent = "Guardando…";
            EpeStore.dejarInstitucion(inst.institucion_id, select2.value)
              .then(function () {
                EpeModal.close();
                return cargar();
              })
              .catch(function (err) {
                statusSug.textContent = "No se pudo completar." + detalleError(err);
                btn.disabled = false;
              });
          });
          contenedor.appendChild(btn);
          contenedor.appendChild(statusSug);

          EpeModal.open({ titulo: "Sugerir reemplazo", contenido: contenedor });
        })
        .catch(function (err) {
          window.alert("No se pudieron cargar tus colegas de la institución." + detalleError(err));
        });
    }

    function onDejar(inst) {
      var nombre = inst.institucion_nombre || inst.institucion_pendiente || "esta institución";
      if (
        !window.confirm(
          '¿Dejar "' +
            nombre +
            '"? Vas a perder el acceso a todo lo que estaba compartido con ella. Tus propias colecciones que estaban compartidas con ella pasan a ser del administrador de la institución (si hay uno) — las que no estaban compartidas con ella siguen siendo tuyas.'
        )
      ) {
        return;
      }
      status.textContent = "Guardando…";
      EpeStore.dejarInstitucion(inst.institucion_id)
        .then(function () {
          return cargar();
        })
        .then(function () {
          status.textContent = "Listo.";
          window.clearTimeout(status._epeTimeout);
          status._epeTimeout = window.setTimeout(function () {
            status.textContent = "";
          }, 3000);
        })
        .catch(function (err) {
          if (err && /tenés que sugerir/i.test(err.message || "")) {
            status.textContent = "";
            abrirSugerirReemplazo(inst);
            return;
          }
          status.textContent = "No se pudo completar." + detalleError(err);
        });
    }

    function construirItemInstitucion(inst) {
      var li = document.createElement("li");
      li.className = "epe-compartir-item";

      var info = document.createElement("div");
      var nombre = document.createElement("strong");
      nombre.textContent = inst.institucion_nombre || inst.institucion_pendiente || "Institución";
      info.appendChild(nombre);

      var estado = document.createElement("div");
      estado.className = "epe-field-hint" + (!inst.institucion_id || !inst.verificada ? " epe-field-hint-aviso" : "");
      estado.textContent = textoEstado(inst);
      info.appendChild(estado);

      if (inst.admin_estado === "activo") {
        var badge = document.createElement("div");
        badge.className = "epe-field-hint-aviso";
        badge.textContent = Number(inst.admins_activos) <= 1 ? "Sos administrador — y el único activo de esta institución." : "Sos administrador.";
        info.appendChild(badge);
      } else if (inst.admin_estado === "congelado") {
        var badge2 = document.createElement("div");
        badge2.className = "epe-field-hint-aviso";
        badge2.textContent = "Dejando la institución — esperando que dis+capacidad confirme a quien te reemplace.";
        info.appendChild(badge2);
      }

      li.appendChild(info);

      var acciones = document.createElement("div");

      if (inst.institucion_id && inst.verificada && !inst.admin_estado) {
        var pedirAdmin = document.createElement("button");
        pedirAdmin.type = "button";
        pedirAdmin.className = "epe-btn-ghost epe-btn-sm";
        pedirAdmin.textContent = "Pedir ser administrador";
        pedirAdmin.addEventListener("click", function () {
          abrirPedidoAdmin(inst);
        });
        acciones.appendChild(pedirAdmin);
      }

      if (!inst.institucion_id) {
        var retirar = document.createElement("button");
        retirar.type = "button";
        retirar.className = "epe-btn-ghost epe-btn-sm";
        retirar.textContent = "Retirar aviso";
        retirar.addEventListener("click", function () {
          retirar.disabled = true;
          EpeStore.retirarInstitucionPendiente()
            .then(function () {
              return cargar();
            })
            .catch(function (err) {
              window.alert("No se pudo retirar." + detalleError(err));
              retirar.disabled = false;
            });
        });
        acciones.appendChild(retirar);
      } else {
        var dejar = document.createElement("button");
        dejar.type = "button";
        dejar.className = "epe-btn-ghost epe-btn-sm";
        dejar.textContent = inst.admin_estado === "congelado" ? "Sugerir otro reemplazo" : "Dejar la institución";
        dejar.addEventListener("click", function () {
          onDejar(inst);
        });
        acciones.appendChild(dejar);
      }

      li.appendChild(acciones);
      return li;
    }

    function cargar() {
      return Promise.all([EpeStore.getInstituciones(), EpeStore.misInstituciones()]).then(function (resultados) {
        var catalogo = resultados[0];
        var mias = resultados[1];

        select.innerHTML = "";
        var vacia = document.createElement("option");
        vacia.value = "";
        vacia.textContent = "Elegí una institución…";
        select.appendChild(vacia);
        catalogo.forEach(function (inst) {
          var yaElegida = mias.some(function (m) {
            return m.institucion_id === inst.id;
          });
          if (yaElegida) return;
          var option = document.createElement("option");
          option.value = inst.id;
          option.textContent = inst.nombre;
          select.appendChild(option);
        });
        var otra = document.createElement("option");
        otra.value = "_otra";
        otra.textContent = "Mi institución no está en la lista";
        select.appendChild(otra);

        select.value = "";
        inputPendiente.value = "";
        inputCodigo.value = "";
        actualizarCampos();

        listaEl.innerHTML = "";
        if (mias.length === 0) {
          var vacioLi = document.createElement("li");
          vacioLi.className = "epe-vacio";
          vacioLi.textContent = "Todavía no elegiste ninguna institución.";
          listaEl.appendChild(vacioLi);
        } else {
          mias.forEach(function (inst) {
            listaEl.appendChild(construirItemInstitucion(inst));
          });
        }

        return mias;
      });
    }

    select.addEventListener("change", actualizarCampos);

    boton.addEventListener("click", function () {
      if (!select.value) return;
      if (select.value === "_otra" && !inputPendiente.value.trim()) return;

      boton.disabled = true;
      status.textContent = "Guardando…";

      var promesa;
      if (select.value === "_otra") {
        promesa = EpeStore.setInstitucionPendiente(inputPendiente.value.trim());
      } else {
        var institucionId = select.value;
        var codigo = inputCodigo.value.trim();
        promesa = codigo
          ? EpeStore.verificarInstitucion(institucionId, codigo).then(function (coincide) {
              if (coincide) return;
              return EpeStore.elegirInstitucionSinVerificar(institucionId).then(function () {
                status.textContent = "El código no coincide — guardada igual, sin verificar.";
              });
            })
          : EpeStore.elegirInstitucionSinVerificar(institucionId);
      }

      promesa
        .then(function () {
          return cargar();
        })
        .then(function () {
          if (!status.textContent || status.textContent === "Guardando…") status.textContent = "Guardado.";
          window.clearTimeout(status._epeTimeout);
          status._epeTimeout = window.setTimeout(function () {
            status.textContent = "";
          }, 3000);
        })
        .catch(function (err) {
          status.textContent = "No se pudo guardar." + detalleError(err);
        })
        .finally(function () {
          boton.disabled = false;
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

    actualizarResumen(root, { nombre: "", profesion: "" }, email);
    initInstitucion(root).then(function (mias) {
      actualizarResumen(root, { nombre: form.elements.nombre.value, profesion: form.elements.profesion.value }, email, (mias || []).length);
    });

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
