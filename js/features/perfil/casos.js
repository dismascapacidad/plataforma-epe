/**
 * casos.js
 * Sección "Gestión de casos": listar/crear/borrar casos, ver el detalle de
 * uno (actividades vinculadas + entradas de nota/evaluación/sesión) y los
 * toggles de compartir — estos últimos MOCKEADOS a propósito (ver
 * data/store.js y el README): sin Supabase no hay a quién compartírselo de
 * verdad, así que quedan visibles pero marcados como no conectados.
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

    root.querySelectorAll("[data-share-toggle]").forEach(function (toggle) {
      toggle.addEventListener("change", onToggleShare);
    });

    initSubtabs();
    renderListaCasos();
    renderDetalleCaso();
  }

  // ── Sub-pestañas dentro del detalle de un caso ─────────────────────
  // Mismo patrón que las pestañas de nivel superior (dashboard.js), un
  // nivel más adentro: cada sección (actividades, notas, compartir) ocupa
  // todo el espacio disponible en vez de apilarse.

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
    // Al cambiar de caso siempre se vuelve a "Actividades" (default acordado).
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

  // ── Listado de casos ────────────────────────────────────────────────

  function renderListaCasos() {
    var lista = root.querySelector("[data-casos-lista]");
    var vacio = root.querySelector("[data-casos-vacio]");
    var casos = EpeStore.getCasos();

    lista.innerHTML = "";
    vacio.hidden = casos.length > 0;

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
        EpeStore.deleteCaso(caso.id);
        if (casoSeleccionadoId === caso.id) casoSeleccionadoId = null;
        renderListaCasos();
        renderDetalleCaso();
      });

      item.appendChild(btn);
      item.appendChild(del);
      lista.appendChild(item);
    });
  }

  function onCrearCaso() {
    var nombre = window.prompt("Nombre del caso (podés usar cualquier criterio: iniciales, tipo de actividad, lo que te sirva a vos):");
    if (nombre === null) return;
    var caso = EpeStore.createCaso({ nombre: nombre.trim() || "Caso sin nombre" });
    casoSeleccionadoId = caso.id;
    resetSubtabActividades();
    renderListaCasos();
    renderDetalleCaso();
  }

  // ── Detalle del caso seleccionado ──────────────────────────────────

  function renderDetalleCaso() {
    var vacio = root.querySelector("[data-detalle-vacio]");
    var detalle = root.querySelector("[data-detalle]");
    var caso = casoSeleccionadoId ? EpeStore.getCaso(casoSeleccionadoId) : null;

    if (!caso) {
      vacio.hidden = false;
      detalle.hidden = true;
      return;
    }

    vacio.hidden = true;
    detalle.hidden = false;
    detalle.querySelector("[data-detalle-nombre]").textContent = caso.nombre;

    renderActividades(caso.id);
    renderEntradas(caso.id);
    renderShares(caso.id);
  }

  // Una actividad vinculada viene de una de dos fuentes: una referencia al
  // catálogo público (EpeStore.listActividades → EpeCatalogo.getById, sea
  // tipo "app-epe" o "tercero") o una app de terceros propia de ESTE caso
  // (EpeStore.listAppsTerceros, siempre tipo "tercero", nunca pública).
  // Se combinan acá en una sola forma para no repetir el render.
  function actividadesUnificadas(casoId) {
    var deCatalogo = EpeStore.listActividades(casoId).map(function (a) {
      var app = EpeCatalogo.getById(a.catalogo_id);
      return {
        app: app,
        orden: a.agregado_en,
        privada: false,
        quitar: function () {
          EpeStore.removeActividad(a.id);
        },
      };
    });
    var propias = EpeStore.listAppsTerceros(casoId).map(function (t) {
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
          EpeStore.removeAppTercero(t.id);
        },
      };
    });
    return deCatalogo.concat(propias).sort(function (a, b) {
      return (a.orden || "").localeCompare(b.orden || "");
    });
  }

  function renderActividades(casoId) {
    var grid = root.querySelector("[data-actividades-lista]");
    var unificadas = actividadesUnificadas(casoId);
    grid.innerHTML = "";

    if (unificadas.length === 0) {
      var vacio = document.createElement("p");
      vacio.className = "epe-vacio";
      vacio.textContent = "Todavía no vinculaste actividades a este caso.";
      grid.appendChild(vacio);
      return;
    }

    unificadas.forEach(function (entrada) {
      var app = entrada.app;
      var card = document.createElement("div");
      card.className = "epe-actividad-card";

      if (!app) {
        // Referencia a una app que salió del catálogo (o dato viejo de una
        // versión anterior del prototipo): se muestra igual para no
        // esconder el registro, pero sin acciones que dependan de ella.
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
        // Apps EpE se abren directo: no necesitan indicaciones previas.
        accionPrincipal.textContent = "Abrir";
        accionPrincipal.addEventListener("click", function () {
          window.open(app.url, "_blank", "noopener");
        });
      } else if (app) {
        // Apps de terceros (públicas o privadas del caso) siempre pasan
        // primero por el modal de indicaciones/configuración (compartido
        // con la página pública apps-terceros/, ver js/core/tercero-detalle.js).
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
        entrada.quitar();
        renderActividades(casoId);
      });

      acciones.appendChild(accionPrincipal);
      acciones.appendChild(del);
      card.appendChild(acciones);
      grid.appendChild(card);
    });
  }

  // ── Agregar actividad: elegir de la "tienda" del catálogo EpE ──────
  // Guardar una actividad NUNCA instancia la app acá adentro: solo crea el
  // link (ver EpeStore.addActividad). Por eso el picker no pide ningún
  // dato más que "cuál" — abrir/usar la app pasa siempre en su propia
  // página, o (apps de terceros) en el modal de indicaciones de arriba.

  function abrirCatalogo() {
    if (!casoSeleccionadoId) return;
    renderPicker("app-epe");
  }

  function renderPicker(tabActiva) {
    var casoId = casoSeleccionadoId;
    var yaVinculadas = EpeStore.listActividades(casoId).map(function (a) {
      return a.catalogo_id;
    });

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

    var disponibles = EpeCatalogo.getAll().filter(function (app) {
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

    if (app.tipo === "app-epe") {
      item.addEventListener("click", function () {
        EpeStore.addActividad(casoId, app.id);
        renderActividades(casoId);
        EpeModal.close();
      });
    } else {
      // Las de terceros pasan primero por el modal de indicaciones; recién
      // ahí se confirma vincularlas (ver js/core/tercero-detalle.js).
      item.addEventListener("click", function () {
        EpeTerceroDetalle.abrir(app, {
          accionExtra: {
            etiqueta: "Vincular a este caso",
            onClick: function () {
              EpeStore.addActividad(casoId, app.id);
              renderActividades(casoId);
              EpeModal.close();
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
      EpeStore.addAppTercero(casoId, {
        nombre: nombre,
        descripcion: form.elements.descripcion.value.trim(),
        instrucciones: form.elements.instrucciones.value.trim(),
        configuracion: form.elements.configuracion.value.trim(),
        url: url,
      });
      renderActividades(casoId);
      EpeModal.close();
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
    EpeStore.listEntradas(casoId).forEach(function (entrada) {
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
  }

  function onAgregarEntrada(ev) {
    ev.preventDefault();
    if (!casoSeleccionadoId) return;
    var form = ev.target;
    var contenido = form.elements.contenido.value.trim();
    if (!contenido) return;
    EpeStore.addEntrada(casoSeleccionadoId, {
      tipo: form.elements.tipo.value,
      contenido: contenido,
    });
    form.reset();
    renderEntradas(casoSeleccionadoId);
  }

  // ── Compartir (mock) ───────────────────────────────────────────────

  function renderShares(casoId) {
    var activos = EpeStore.getShares(casoId).map(function (s) {
      return s.tipo;
    });
    root.querySelectorAll("[data-share-toggle]").forEach(function (toggle) {
      toggle.checked = activos.indexOf(toggle.value) !== -1;
    });
  }

  function onToggleShare(ev) {
    if (!casoSeleccionadoId) {
      ev.target.checked = false;
      return;
    }
    EpeStore.setShare(casoSeleccionadoId, ev.target.value, ev.target.checked);
  }

  return { init: init };
})();
