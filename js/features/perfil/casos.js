/**
 * casos.js
 * Sección "Gestión de casos": listar/crear/borrar casos, ver el detalle de
 * uno (actividades vinculadas + entradas de nota/evaluación/sesión) y
 * compartir — funcional de punta a punta desde supabase/003_compartir.sql:
 * un colega puntual (por email, solo si ya tiene cuenta), tu institución
 * (comparando el campo de texto libre del perfil) o dis+capacidad (cuenta
 * marcada como admin) pueden VER el caso, nunca editarlo ni borrarlo — eso
 * sigue siendo solo del dueño.
 *
 * MIGRADO a Supabase: todo lo que antes era EpeStore.algo() síncrono ahora
 * devuelve una Promise. El patrón en todo este archivo es el mismo: pedir
 * el dato, y solo si `casoId` sigue siendo el caso seleccionado cuando la
 * respuesta llega, actualizar el DOM — así un cambio rápido de caso no deja
 * pintado el detalle del caso anterior (condición de carrera típica al
 * pasar de sync a async).
 *
 * Script clásico. Namespace: EpeCasos.
 */

var EpeCasos = (function () {
  var root;
  var casoSeleccionadoId = null;

  function init(rootEl) {
    root = rootEl;
    if (!root) return;

    root.querySelector("[data-caso-nuevo]").addEventListener("click", onCrearCaso);
    root.querySelector("[data-actividad-agregar]").addEventListener("click", abrirCatalogo);
    root.querySelector("[data-entrada-form]").addEventListener("submit", onAgregarEntrada);
    root.querySelector("[data-colega-agregar]").addEventListener("click", abrirFormCompartirColega);

    root.querySelectorAll("[data-share-toggle]").forEach(function (toggle) {
      toggle.addEventListener("change", onToggleShare);
    });

    initSubtabs();
    renderListaCasos();
    renderDetalleCaso();
  }

  // ── Sub-pestañas dentro del detalle de un caso ─────────────────────

  function initSubtabs() {
    var tabs = root.querySelectorAll("[data-subtab]");
    var paneles = root.querySelectorAll("[data-subpanel]");

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var destino = tab.getAttribute("data-subtab");

        tabs.forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", String(t === tab));
        });
        paneles.forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-subpanel") !== destino;
        });
      });
    });
  }

  function resetSubtabActividades() {
    var tabs = root.querySelectorAll("[data-subtab]");
    var paneles = root.querySelectorAll("[data-subpanel]");
    tabs.forEach(function (t) {
      var esActividades = t.getAttribute("data-subtab") === "actividades";
      t.classList.toggle("is-active", esActividades);
      t.setAttribute("aria-selected", String(esActividades));
    });
    paneles.forEach(function (p) {
      p.hidden = p.getAttribute("data-subpanel") !== "actividades";
    });
  }

  function mensajeVacio(elemento, texto, tag) {
    elemento.innerHTML = "";
    var p = document.createElement(tag || "p");
    p.className = "epe-vacio";
    p.textContent = texto;
    elemento.appendChild(p);
  }

  // ── Listado de casos ────────────────────────────────────────────────

  function renderListaCasos() {
    var lista = root.querySelector("[data-casos-lista]");
    var vacio = root.querySelector("[data-casos-vacio]");

    EpeStore.getCasos()
      .then(function (casos) {
        lista.innerHTML = "";
        vacio.hidden = casos.length > 0;
        vacio.textContent = "Todavía no creaste ningún caso.";

        casos.forEach(function (caso) {
          var item = document.createElement("li");
          item.className = "epe-caso-card";
          if (caso.id === casoSeleccionadoId) item.classList.add("is-active");

          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "epe-caso-card-btn";
          btn.textContent = caso.nombre;
          btn.addEventListener("click", function () {
            casoSeleccionadoId = caso.id;
            resetSubtabActividades();
            renderListaCasos();
            renderDetalleCaso();
          });

          var del = document.createElement("button");
          del.type = "button";
          del.className = "epe-caso-card-del";
          del.setAttribute("aria-label", "Borrar caso " + caso.nombre);
          del.textContent = "×";
          del.addEventListener("click", function (ev) {
            ev.stopPropagation();
            if (!window.confirm('Borrar el caso "' + caso.nombre + '" y todo su contenido?')) return;
            del.disabled = true;
            EpeStore.deleteCaso(caso.id)
              .then(function () {
                if (casoSeleccionadoId === caso.id) casoSeleccionadoId = null;
                renderListaCasos();
                renderDetalleCaso();
              })
              .catch(function () {
                window.alert("No se pudo borrar el caso. Revisá tu conexión e intentá de nuevo.");
                del.disabled = false;
              });
          });

          item.appendChild(btn);
          item.appendChild(del);
          lista.appendChild(item);
        });
      })
      .catch(function () {
        lista.innerHTML = "";
        vacio.hidden = false;
        vacio.textContent = "No se pudieron cargar tus casos. Recargá la página.";
      });
  }

  function onCrearCaso() {
    var nombre = window.prompt("Nombre del caso (podés usar cualquier criterio: iniciales, tipo de actividad, lo que te sirva a vos):");
    if (nombre === null) return;
    EpeStore.createCaso({ nombre: nombre.trim() || "Caso sin nombre" })
      .then(function (caso) {
        casoSeleccionadoId = caso.id;
        resetSubtabActividades();
        renderListaCasos();
        renderDetalleCaso();
      })
      .catch(function () {
        window.alert("No se pudo crear el caso. Revisá tu conexión e intentá de nuevo.");
      });
  }

  // ── Detalle del caso seleccionado ──────────────────────────────────

  function renderDetalleCaso() {
    var vacio = root.querySelector("[data-detalle-vacio]");
    var detalle = root.querySelector("[data-detalle]");

    if (!casoSeleccionadoId) {
      vacio.hidden = false;
      vacio.textContent = "Elegí un caso de la lista, o creá uno nuevo.";
      detalle.hidden = true;
      return;
    }

    var casoId = casoSeleccionadoId;
    EpeStore.getCaso(casoId)
      .then(function (caso) {
        if (casoId !== casoSeleccionadoId) return; // se cambió de caso mientras esperaba

        if (!caso) {
          vacio.hidden = false;
          vacio.textContent = "Este caso ya no existe.";
          detalle.hidden = true;
          return;
        }

        vacio.hidden = true;
        detalle.hidden = false;
        detalle.querySelector("[data-detalle-nombre]").textContent = caso.nombre;

        renderActividades(caso.id);
        renderEntradas(caso.id);
        renderShares(caso.id);
      })
      .catch(function () {
        if (casoId !== casoSeleccionadoId) return;
        vacio.hidden = false;
        vacio.textContent = "No se pudo cargar el caso. Revisá tu conexión.";
        detalle.hidden = true;
      });
  }

  // Una actividad vinculada viene de una de dos fuentes: una referencia al
  // catálogo público (EpeStore.listActividades → EpeCatalogo.getById, sea
  // tipo "app-epe" o "tercero") o una app de terceros propia de ESTE caso
  // (EpeStore.listAppsTerceros, siempre tipo "tercero", nunca pública).
  // Se combinan acá en una sola forma para no repetir el render.
  function actividadesUnificadas(casoId) {
    var deCatalogo = EpeStore.listActividades(casoId).then(function (lista) {
      return Promise.all(
        lista.map(function (a) {
          return EpeCatalogo.getById(a.catalogo_id).then(function (app) {
            return {
              app: app,
              orden: a.agregado_en,
              privada: false,
              quitar: function () {
                return EpeStore.removeActividad(a.id);
              },
            };
          });
        })
      );
    });

    var propias = EpeStore.listAppsTerceros(casoId).then(function (lista) {
      return lista.map(function (t) {
        return {
          app: {
            id: t.id,
            tipo: "tercero",
            nombre: t.nombre,
            descripcion: t.descripcion,
            categoria: "",
            autor: "vos",
            instrucciones: t.instrucciones,
            configuracion: t.configuracion,
            url: t.url,
            icono: EpeCatalogo.ICONO_EXTERNO,
          },
          orden: t.creado_en,
          privada: true,
          quitar: function () {
            return EpeStore.removeAppTercero(t.id);
          },
        };
      });
    });

    return Promise.all([deCatalogo, propias]).then(function (resultados) {
      return resultados[0].concat(resultados[1]).sort(function (a, b) {
        return (a.orden || "").localeCompare(b.orden || "");
      });
    });
  }

  function renderActividades(casoId) {
    var grid = root.querySelector("[data-actividades-lista]");
    mensajeVacio(grid, "Cargando…");

    actividadesUnificadas(casoId)
      .then(function (unificadas) {
        if (casoId !== casoSeleccionadoId) return;
        grid.innerHTML = "";

        if (unificadas.length === 0) {
          mensajeVacio(grid, "Todavía no vinculaste actividades a este caso.");
          return;
        }

        unificadas.forEach(function (entrada) {
          var app = entrada.app;
          var card = document.createElement("div");
          card.className = "epe-actividad-card";

          if (!app) {
            var nombreFaltante = document.createElement("strong");
            nombreFaltante.textContent = "Actividad no disponible";
            card.appendChild(nombreFaltante);
          } else {
            var icono = document.createElement("span");
            icono.className = "epe-actividad-card-icono";
            icono.innerHTML = app.icono;
            icono.setAttribute("aria-hidden", "true");
            card.appendChild(icono);

            var nombre = document.createElement("strong");
            nombre.textContent = app.nombre;
            card.appendChild(nombre);

            var autor = document.createElement("span");
            autor.className = "epe-actividad-card-autor";
            if (entrada.privada) {
              autor.classList.add("epe-actividad-card-autor-privada");
              autor.textContent = "Privada de este caso";
            } else {
              autor.textContent = app.tipo === "app-epe" ? "App EpE" : "De terceros: " + app.autor;
            }
            card.appendChild(autor);
          }

          var acciones = document.createElement("div");
          acciones.className = "epe-actividad-card-acciones";

          var accionPrincipal = document.createElement("button");
          accionPrincipal.type = "button";
          accionPrincipal.className = "epe-btn-acc epe-btn-sm";
          if (app && app.tipo === "app-epe") {
            accionPrincipal.textContent = "Abrir";
            accionPrincipal.addEventListener("click", function () {
              window.open(app.url, "_blank", "noopener");
            });
          } else if (app) {
            accionPrincipal.textContent = "Ver detalles";
            accionPrincipal.addEventListener("click", function () {
              EpeTerceroDetalle.abrir(app, {});
            });
          } else {
            accionPrincipal.textContent = "Abrir";
            accionPrincipal.disabled = true;
          }

          var del = document.createElement("button");
          del.type = "button";
          del.className = "epe-btn-ghost epe-btn-sm";
          del.textContent = "Quitar";
          del.addEventListener("click", function () {
            del.disabled = true;
            entrada
              .quitar()
              .then(function () {
                renderActividades(casoId);
              })
              .catch(function () {
                window.alert("No se pudo quitar la actividad. Revisá tu conexión e intentá de nuevo.");
                del.disabled = false;
              });
          });

          acciones.appendChild(accionPrincipal);
          acciones.appendChild(del);
          card.appendChild(acciones);
          grid.appendChild(card);
        });
      })
      .catch(function () {
        if (casoId !== casoSeleccionadoId) return;
        mensajeVacio(grid, "No se pudieron cargar las actividades. Revisá tu conexión.");
      });
  }

  // ── Agregar actividad: elegir de la "tienda" del catálogo EpE ──────

  function abrirCatalogo() {
    if (!casoSeleccionadoId) return;
    renderPicker("app-epe");
  }

  function renderPicker(tabActiva) {
    var casoId = casoSeleccionadoId;

    Promise.all([EpeStore.listActividades(casoId), EpeCatalogo.getAll()])
      .then(function (resultados) {
        if (casoId !== casoSeleccionadoId) return;

        var yaVinculadas = resultados[0].map(function (a) {
          return a.catalogo_id;
        });
        var catalogo = resultados[1];

        var contenido = document.createElement("div");

        var tabs = document.createElement("div");
        tabs.className = "epe-subtabs epe-picker-tabs";
        ["app-epe", "tercero"].forEach(function (tipo) {
          var tab = document.createElement("button");
          tab.type = "button";
          tab.className = "epe-subtab" + (tipo === tabActiva ? " is-active" : "");
          tab.textContent = tipo === "app-epe" ? "Apps EpE" : "De terceros";
          tab.addEventListener("click", function () {
            renderPicker(tipo);
          });
          tabs.appendChild(tab);
        });
        contenido.appendChild(tabs);

        var seccion = document.createElement("div");
        seccion.className = "epe-picker-seccion";

        var disponibles = catalogo.filter(function (app) {
          return app.tipo === tabActiva && yaVinculadas.indexOf(app.id) === -1;
        });

        if (disponibles.length === 0) {
          var vacio = document.createElement("p");
          vacio.className = "epe-vacio";
          vacio.textContent =
            tabActiva === "app-epe"
              ? "Ya vinculaste todas las Apps EpE a este caso."
              : "Ya vinculaste todas las apps de terceros del catálogo público a este caso.";
          seccion.appendChild(vacio);
        } else {
          var grid = document.createElement("div");
          grid.className = "epe-catalogo-grid";

          disponibles.forEach(function (app) {
            grid.appendChild(construirCatalogoItem(app, casoId));
          });

          seccion.appendChild(grid);
        }

        if (tabActiva === "tercero") {
          var crear = document.createElement("button");
          crear.type = "button";
          crear.className = "epe-btn-ghost epe-btn-sm epe-picker-crear";
          crear.textContent = "+ Crear app de terceros para este caso";
          crear.addEventListener("click", function () {
            renderFormNuevaAppTercero();
          });
          seccion.appendChild(crear);
        }

        contenido.appendChild(seccion);

        EpeModal.open({
          titulo: "Agregar actividad desde el catálogo",
          contenido: contenido,
        });
      })
      .catch(function () {
        window.alert("No se pudo cargar el catálogo. Revisá tu conexión e intentá de nuevo.");
      });
  }

  function construirCatalogoItem(app, casoId) {
    var item = document.createElement("button");
    item.type = "button";
    item.className = "epe-catalogo-item";

    var icono = document.createElement("span");
    icono.className = "epe-catalogo-item-icono";
    icono.innerHTML = app.icono;
    icono.setAttribute("aria-hidden", "true");

    var nombre = document.createElement("strong");
    nombre.textContent = app.nombre;

    var categoria = document.createElement("span");
    categoria.className = "epe-catalogo-item-categoria";
    categoria.textContent = app.categoria;

    var desc = document.createElement("p");
    desc.textContent = app.descripcion;

    var autor = document.createElement("span");
    autor.className = "epe-catalogo-item-autor";
    autor.textContent = app.tipo === "app-epe" ? "App EpE" : "De terceros: " + app.autor;

    item.appendChild(icono);
    item.appendChild(nombre);
    item.appendChild(categoria);
    item.appendChild(desc);
    item.appendChild(autor);

    function vincular() {
      return EpeStore.addActividad(casoId, app.id).then(function () {
        renderActividades(casoId);
        EpeModal.close();
      });
    }

    if (app.tipo === "app-epe") {
      item.addEventListener("click", function () {
        item.disabled = true;
        vincular().catch(function () {
          window.alert("No se pudo vincular la actividad. Revisá tu conexión e intentá de nuevo.");
          item.disabled = false;
        });
      });
    } else {
      // Las de terceros pasan primero por el modal de indicaciones; recién
      // ahí se confirma vincularlas (ver js/core/tercero-detalle.js).
      item.addEventListener("click", function () {
        EpeTerceroDetalle.abrir(app, {
          accionExtra: {
            etiqueta: "Vincular a este caso",
            onClick: function () {
              vincular().catch(function () {
                window.alert("No se pudo vincular la actividad. Revisá tu conexión e intentá de nuevo.");
              });
            },
          },
        });
      });
    }

    return item;
  }

  function renderFormNuevaAppTercero() {
    var casoId = casoSeleccionadoId;
    var contenido = document.createElement("div");

    var intro = document.createElement("p");
    intro.className = "epe-panel-sub";
    intro.textContent = "Esta app solo va a ser visible en este caso — no se suma al catálogo público.";
    contenido.appendChild(intro);

    var form = document.createElement("form");
    form.className = "epe-form-grid epe-picker-form";

    function campo(nombre, label, tipoInput, requerido) {
      var wrap = document.createElement("div");
      wrap.className = "epe-field";
      var lbl = document.createElement("label");
      lbl.textContent = label;
      var input = tipoInput === "textarea" ? document.createElement("textarea") : document.createElement("input");
      if (tipoInput !== "textarea") input.type = tipoInput;
      input.name = nombre;
      if (requerido) input.required = true;
      wrap.appendChild(lbl);
      wrap.appendChild(input);
      form.appendChild(wrap);
      return input;
    }

    campo("nombre", "Nombre de la app", "text", true);
    campo("descripcion", "Descripción breve", "text", false);
    campo("instrucciones", "Cómo se usa", "textarea", false);
    campo("configuracion", "Configuración de dispositivo necesaria", "textarea", false);
    campo("url", "Link al recurso externo", "url", true);

    var acciones = document.createElement("div");
    var volver = document.createElement("button");
    volver.type = "button";
    volver.className = "epe-btn-ghost epe-btn-sm";
    volver.textContent = "Volver";
    volver.addEventListener("click", function () {
      renderPicker("tercero");
    });
    var guardar = document.createElement("button");
    guardar.type = "submit";
    guardar.className = "epe-btn-acc epe-btn-sm";
    guardar.textContent = "Crear y vincular";
    acciones.appendChild(volver);
    acciones.appendChild(guardar);
    form.appendChild(acciones);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nombre = form.elements.nombre.value.trim();
      var url = form.elements.url.value.trim();
      if (!nombre || !url) return;
      guardar.disabled = true;
      EpeStore.addAppTercero(casoId, {
        nombre: nombre,
        descripcion: form.elements.descripcion.value.trim(),
        instrucciones: form.elements.instrucciones.value.trim(),
        configuracion: form.elements.configuracion.value.trim(),
        url: url,
      })
        .then(function () {
          renderActividades(casoId);
          EpeModal.close();
        })
        .catch(function () {
          window.alert("No se pudo crear la app. Revisá tu conexión e intentá de nuevo.");
          guardar.disabled = false;
        });
    });

    contenido.appendChild(form);

    EpeModal.open({
      titulo: "Crear app de terceros para este caso",
      contenido: contenido,
    });
  }

  function renderEntradas(casoId) {
    var ul = root.querySelector("[data-entradas-lista]");
    ul.innerHTML = "";
    var cargando = document.createElement("li");
    cargando.className = "epe-vacio";
    cargando.textContent = "Cargando…";
    ul.appendChild(cargando);

    EpeStore.listEntradas(casoId)
      .then(function (entradas) {
        if (casoId !== casoSeleccionadoId) return;
        ul.innerHTML = "";
        entradas.forEach(function (entrada) {
          var li = document.createElement("li");
          li.className = "epe-entrada-item";

          var badge = document.createElement("span");
          badge.className = "epe-entrada-tipo epe-entrada-tipo-" + entrada.tipo;
          badge.textContent = EpeSchema.ENTRADA_TIPO_LABELS[entrada.tipo] || entrada.tipo;

          var fecha = document.createElement("span");
          fecha.className = "epe-entrada-fecha";
          fecha.textContent = new Date(entrada.creado_en).toLocaleDateString("es-AR");

          var contenido = document.createElement("p");
          contenido.textContent = entrada.contenido;

          var header = document.createElement("div");
          header.className = "epe-entrada-header";
          header.appendChild(badge);
          header.appendChild(fecha);

          li.appendChild(header);
          li.appendChild(contenido);
          ul.appendChild(li);
        });
      })
      .catch(function () {
        if (casoId !== casoSeleccionadoId) return;
        ul.innerHTML = "";
        var li = document.createElement("li");
        li.className = "epe-vacio";
        li.textContent = "No se pudieron cargar las entradas. Revisá tu conexión.";
        ul.appendChild(li);
      });
  }

  function onAgregarEntrada(ev) {
    ev.preventDefault();
    if (!casoSeleccionadoId) return;
    var form = ev.target;
    var contenido = form.elements.contenido.value.trim();
    if (!contenido) return;

    var casoId = casoSeleccionadoId;
    var boton = form.querySelector("button[type=submit]");
    boton.disabled = true;

    EpeStore.addEntrada(casoId, {
      tipo: form.elements.tipo.value,
      contenido: contenido,
    })
      .then(function () {
        form.reset();
        renderEntradas(casoId);
      })
      .catch(function () {
        window.alert("No se pudo agregar la entrada. Revisá tu conexión e intentá de nuevo.");
      })
      .finally(function () {
        boton.disabled = false;
      });
  }

  // ── Compartir ───────────────────────────────────────────────────────
  // Tres formas de dar acceso (solo lectura) a un caso: colegas puntuales
  // (lista dinámica, uno o varios) e institución/dis+capacidad (toggles
  // simples, ya están fijos en el HTML — ver dashboard.html). La lista de
  // colegas se reconstruye en cada render; los dos toggles solo se
  // actualizan (checked/disabled), no se recrean.

  function renderShares(casoId) {
    var listaColegas = root.querySelector("[data-colegas-lista]");
    var toggleInstitucion = root.querySelector('[data-share-toggle][value="institucion"]');
    var toggleDismascapacidad = root.querySelector('[data-share-toggle][value="dismascapacidad"]');
    var hintInstitucion = root.querySelector("[data-institucion-hint]");

    mensajeVacio(listaColegas, "Cargando…");

    Promise.all([EpeStore.getShares(casoId), EpeStore.getProfile()])
      .then(function (resultados) {
        if (casoId !== casoSeleccionadoId) return;
        var shares = resultados[0];
        var miPerfil = resultados[1];

        var colegas = shares.filter(function (s) {
          return s.tipo === "colega";
        });
        toggleInstitucion.checked = shares.some(function (s) {
          return s.tipo === "institucion";
        });
        toggleDismascapacidad.checked = shares.some(function (s) {
          return s.tipo === "dismascapacidad";
        });

        var institucion = (miPerfil.institucion || "").trim();
        toggleInstitucion.disabled = !institucion;
        hintInstitucion.textContent = institucion
          ? 'Le da acceso a cualquier colega cuyo perfil diga "' + institucion + '".'
          : "Completá tu institución en la pestaña Perfil para poder usar esto.";

        listaColegas.innerHTML = "";
        if (colegas.length === 0) {
          mensajeVacio(listaColegas, "Todavía no compartiste este caso con ningún colega.", "li");
        } else {
          colegas.forEach(function (share) {
            var li = document.createElement("li");
            li.className = "epe-compartir-item";

            var etiqueta = document.createElement("span");
            etiqueta.textContent = "Cargando…";
            li.appendChild(etiqueta);

            var quitar = document.createElement("button");
            quitar.type = "button";
            quitar.className = "epe-btn-ghost epe-btn-sm";
            quitar.textContent = "Quitar";
            quitar.addEventListener("click", function () {
              quitar.disabled = true;
              EpeStore.removeShare(share.id)
                .then(function () {
                  renderShares(casoId);
                })
                .catch(function () {
                  window.alert("No se pudo quitar. Revisá tu conexión e intentá de nuevo.");
                  quitar.disabled = false;
                });
            });
            li.appendChild(quitar);
            listaColegas.appendChild(li);

            EpeStore.getColegaLabel(share.compartido_con_user_id)
              .then(function (label) {
                if (casoId !== casoSeleccionadoId) return;
                etiqueta.textContent = label;
              })
              .catch(function () {
                etiqueta.textContent = "Colega";
              });
          });
        }
      })
      .catch(function () {
        if (casoId !== casoSeleccionadoId) return;
        mensajeVacio(listaColegas, "No se pudo cargar. Revisá tu conexión.", "li");
      });
  }

  function onToggleShare(ev) {
    if (!casoSeleccionadoId) {
      ev.target.checked = false;
      return;
    }
    var toggle = ev.target;
    var valorAnterior = !toggle.checked;
    toggle.disabled = true;
    EpeStore.setShare(casoSeleccionadoId, toggle.value, toggle.checked)
      .catch(function () {
        toggle.checked = valorAnterior;
        window.alert("No se pudo actualizar. Revisá tu conexión.");
      })
      .finally(function () {
        toggle.disabled = false;
      });
  }

  function abrirFormCompartirColega() {
    if (!casoSeleccionadoId) return;
    var casoId = casoSeleccionadoId;

    var contenido = document.createElement("div");

    var intro = document.createElement("p");
    intro.className = "epe-panel-sub";
    intro.textContent = "Solo se puede compartir con alguien que ya tenga cuenta en la plataforma.";
    contenido.appendChild(intro);

    var form = document.createElement("form");
    form.className = "epe-form-grid";

    var wrap = document.createElement("div");
    wrap.className = "epe-field";
    var lbl = document.createElement("label");
    lbl.textContent = "Email del colega";
    var input = document.createElement("input");
    input.type = "email";
    input.name = "email";
    input.required = true;
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    form.appendChild(wrap);

    var status = document.createElement("p");
    status.className = "epe-form-status";
    form.appendChild(status);

    var guardar = document.createElement("button");
    guardar.type = "submit";
    guardar.className = "epe-btn-acc epe-btn-sm";
    guardar.textContent = "Compartir";
    form.appendChild(guardar);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = input.value.trim();
      if (!email) return;
      guardar.disabled = true;
      status.textContent = "Buscando…";

      EpeStore.addShareColega(casoId, email)
        .then(function (resultado) {
          if (!resultado) {
            status.textContent = "Esa persona todavía no tiene cuenta en la plataforma.";
            guardar.disabled = false;
            return;
          }
          renderShares(casoId);
          EpeModal.close();
        })
        .catch(function () {
          status.textContent = "No se pudo compartir. Revisá tu conexión e intentá de nuevo.";
          guardar.disabled = false;
        });
    });

    contenido.appendChild(form);

    EpeModal.open({
      titulo: "Compartir con un colega",
      contenido: contenido,
    });
  }

  return { init: init };
})();
