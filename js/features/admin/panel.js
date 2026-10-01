/**
 * panel.js
 * Pestaña "Colecciones compartidas" del panel de staff: árbol institución →
 * profesional → colección, con detalle de solo lectura (recursos
 * vinculados) y el mismo canal de comentarios que ya usa el espacio
 * personal — el staff puede comentar, no editar ni ver notas personales
 * (esas ni siquiera llegan acá: la RLS de caso_entradas sigue sin incluir
 * a dis+capacidad, ver supabase/005_notas_privadas.sql).
 *
 * Reusa EpeStore para todo lo que ya es genérico de un caso (actividades,
 * apps de terceros, comentarios) — lo único propio de acá es
 * EpeAdminStore.panelColecciones(), que ya viene agrupable por
 * institución y filtrado a SOLO lo compartido con "dismascapacidad" (a
 * diferencia de EpeStore.getCasos(), que también trae lo propio del
 * staff — ver el comentario en 010_instituciones_y_staff.sql).
 *
 * v1 deliberadamente simple (sin métricas, sin exportar — ver el ADR en
 * el proyecto): el objetivo es que el staff pueda encontrar y acompañar
 * una colección, no un dashboard analítico.
 *
 * Script clásico. Namespace: EpeAdminPanel.
 */

var EpeAdminPanel = (function () {
  var root;
  var filas = [];
  var casoSeleccionado = null;

  function init(rootEl) {
    root = rootEl;
    if (!root) return;

    root.querySelector("[data-admin-buscador]").addEventListener("input", renderArbol);
    root.querySelector("[data-admin-comentario-form]").addEventListener("submit", onAgregarComentario);

    cargar();
  }

  function cargar() {
    var arbol = root.querySelector("[data-admin-arbol]");
    arbol.innerHTML = '<p class="epe-vacio">Cargando…</p>';

    EpeAdminStore.panelColecciones()
      .then(function (data) {
        filas = data;
        renderArbol();
      })
      .catch(function () {
        arbol.innerHTML = '<p class="epe-vacio">No se pudieron cargar las colecciones. Recargá la página.</p>';
      });
  }

  // institución → profesional → [casos]. Se arma en JS (no en SQL) porque
  // es puramente de presentación y el volumen esperado (decenas de
  // instituciones, no miles) no justifica complicar la función de Postgres.
  function agrupar(lista) {
    var grupos = [];
    var porInstitucion = {};

    lista.forEach(function (fila) {
      var clave = fila.institucion_id || fila.institucion_pendiente || "_sin";
      var nombre = fila.institucion_nombre || (fila.institucion_pendiente ? fila.institucion_pendiente + " (pendiente de alta)" : "Sin institución");

      if (!porInstitucion[clave]) {
        porInstitucion[clave] = { nombre: nombre, profesionales: {}, orden: [] };
        grupos.push(porInstitucion[clave]);
      }
      var grupoInst = porInstitucion[clave];

      if (!grupoInst.profesionales[fila.dueno_id]) {
        grupoInst.profesionales[fila.dueno_id] = {
          nombre: fila.dueno_nombre || fila.dueno_email || "Profesional",
          casos: [],
        };
        grupoInst.orden.push(fila.dueno_id);
      }
      grupoInst.profesionales[fila.dueno_id].casos.push(fila);
    });

    grupos.sort(function (a, b) {
      return a.nombre.localeCompare(b.nombre);
    });
    return grupos;
  }

  function renderArbol() {
    var arbol = root.querySelector("[data-admin-arbol]");
    var vacio = root.querySelector("[data-admin-arbol-vacio]");
    var filtro = (root.querySelector("[data-admin-buscador]").value || "").trim().toLowerCase();

    var filtradas = !filtro
      ? filas
      : filas.filter(function (f) {
          var texto = [f.institucion_nombre, f.institucion_pendiente, f.dueno_nombre, f.dueno_email].join(" ").toLowerCase();
          return texto.indexOf(filtro) !== -1;
        });

    arbol.innerHTML = "";
    vacio.hidden = filtradas.length > 0;
    if (filtradas.length === 0) return;

    agrupar(filtradas).forEach(function (grupoInst) {
      var detalleInst = document.createElement("details");
      detalleInst.className = "epe-admin-institucion";
      detalleInst.open = true;

      var resumenInst = document.createElement("summary");
      resumenInst.textContent = grupoInst.nombre;
      detalleInst.appendChild(resumenInst);

      grupoInst.orden.forEach(function (duenoId) {
        var prof = grupoInst.profesionales[duenoId];
        var detalleProf = document.createElement("details");
        detalleProf.className = "epe-admin-profesional";
        detalleProf.open = true;

        var resumenProf = document.createElement("summary");
        resumenProf.textContent = prof.nombre;
        detalleProf.appendChild(resumenProf);

        var lista = document.createElement("ul");
        lista.className = "epe-casos-lista";
        prof.casos.forEach(function (fila) {
          var li = document.createElement("li");
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "epe-caso-card";
          if (fila.caso_id === casoSeleccionado) btn.classList.add("is-active");
          btn.textContent = fila.caso_nombre;
          btn.addEventListener("click", function () {
            seleccionarCaso(fila);
          });
          li.appendChild(btn);
          lista.appendChild(li);
        });
        detalleProf.appendChild(lista);
        detalleInst.appendChild(detalleProf);
      });

      arbol.appendChild(detalleInst);
    });
  }

  function seleccionarCaso(fila) {
    casoSeleccionado = fila.caso_id;
    renderArbol();

    root.querySelector("[data-admin-detalle-vacio]").hidden = true;
    var detalle = root.querySelector("[data-admin-detalle]");
    detalle.hidden = false;

    detalle.querySelector("[data-admin-detalle-nombre]").textContent = fila.caso_nombre;
    detalle.querySelector("[data-admin-detalle-meta]").textContent =
      (fila.dueno_nombre || fila.dueno_email) + " · " + (fila.institucion_nombre || fila.institucion_pendiente || "Sin institución");

    renderActividades(fila.caso_id);
    renderComentarios(fila.caso_id);
  }

  function renderActividades(casoId) {
    var ul = root.querySelector("[data-admin-actividades-lista]");
    ul.innerHTML = '<li class="epe-vacio">Cargando…</li>';

    Promise.all([EpeStore.listActividades(casoId), EpeStore.listAppsTerceros(casoId)])
      .then(function (resultados) {
        if (casoId !== casoSeleccionado) return;
        var deCatalogo = resultados[0];
        var propias = resultados[1];

        var nombresPropios = propias.map(function (t) {
          return t.nombre + " (de terceros, propia de esta colección)";
        });

        return Promise.all(
          deCatalogo.map(function (a) {
            return EpeCatalogo.getById(a.catalogo_id).then(function (app) {
              return app ? app.nombre + (app.tipo === "app-epe" ? " (App EpE)" : " (de terceros)") : "Actividad no disponible";
            });
          })
        ).then(function (nombresCatalogo) {
          if (casoId !== casoSeleccionado) return;
          var todos = nombresCatalogo.concat(nombresPropios);
          ul.innerHTML = "";
          if (todos.length === 0) {
            ul.innerHTML = '<li class="epe-vacio">Sin recursos vinculados todavía.</li>';
            return;
          }
          todos.forEach(function (texto) {
            var li = document.createElement("li");
            li.textContent = texto;
            ul.appendChild(li);
          });
        });
      })
      .catch(function () {
        if (casoId !== casoSeleccionado) return;
        ul.innerHTML = '<li class="epe-vacio">No se pudieron cargar los recursos.</li>';
      });
  }

  function renderComentarios(casoId) {
    var ul = root.querySelector("[data-admin-comentarios-lista]");
    ul.innerHTML = '<li class="epe-vacio">Cargando…</li>';

    Promise.all([EpeStore.listComentarios(casoId), EpeStore.getUserId()])
      .then(function (resultados) {
        if (casoId !== casoSeleccionado) return;
        var comentarios = resultados[0];
        var miUserId = resultados[1];

        ul.innerHTML = "";
        if (comentarios.length === 0) {
          ul.innerHTML = '<li class="epe-vacio">Sin comentarios todavía.</li>';
          return;
        }

        comentarios.forEach(function (comentario) {
          var li = document.createElement("li");
          li.className = "epe-comentario-item";

          var header = document.createElement("div");
          header.className = "epe-comentario-header";

          var autor = document.createElement("span");
          autor.className = "epe-comentario-autor";
          autor.textContent = comentario.autor_id === miUserId ? "Vos (dis+capacidad)" : "…";
          header.appendChild(autor);

          var fecha = document.createElement("span");
          fecha.textContent = new Date(comentario.creado_en).toLocaleDateString("es-AR");
          header.appendChild(fecha);

          if (comentario.autor_id === miUserId) {
            var quitar = document.createElement("button");
            quitar.type = "button";
            quitar.className = "epe-btn-ghost epe-btn-sm epe-comentario-borrar";
            quitar.textContent = "Borrar";
            quitar.addEventListener("click", function () {
              quitar.disabled = true;
              EpeStore.removeComentario(comentario.id)
                .then(function () {
                  renderComentarios(casoId);
                })
                .catch(function () {
                  quitar.disabled = false;
                });
            });
            header.appendChild(quitar);
          } else {
            EpeStore.getColegaLabel(comentario.autor_id).then(function (label) {
              if (casoId !== casoSeleccionado) return;
              autor.textContent = label;
            });
          }

          var contenido = document.createElement("p");
          contenido.textContent = comentario.contenido;

          li.appendChild(header);
          li.appendChild(contenido);
          ul.appendChild(li);
        });
      })
      .catch(function () {
        if (casoId !== casoSeleccionado) return;
        ul.innerHTML = '<li class="epe-vacio">No se pudieron cargar los comentarios.</li>';
      });
  }

  function onAgregarComentario(ev) {
    ev.preventDefault();
    if (!casoSeleccionado) return;
    var form = ev.target;
    var contenido = form.elements.contenido.value.trim();
    if (!contenido) return;

    var casoId = casoSeleccionado;
    var boton = form.querySelector("button[type=submit]");
    boton.disabled = true;

    EpeStore.addComentario(casoId, contenido)
      .then(function () {
        form.reset();
        renderComentarios(casoId);
      })
      .catch(function () {
        window.alert("No se pudo agregar el comentario.");
      })
      .finally(function () {
        boton.disabled = false;
      });
  }

  return { init: init };
})();
