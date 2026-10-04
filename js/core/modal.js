/**
 * modal.js
 * Modal genérico y chico, reutilizable en toda la plataforma (hoy lo usa
 * el picker de actividades del espacio personal; pensado para servir
 * también a futuros diálogos de confirmación, etc.). No maneja contenido
 * propio: recibe un título y un nodo de contenido ya armado.
 *
 * Opción `bloqueado: true` en open(): el modal NO se cierra con Esc, con un
 * clic afuera ni con la ×; solo con close() desde el código. Es para
 * decisiones que no se pueden dejar a medias (por ejemplo, restaurar un
 * dispositivo que quedó configurado para un recurso externo).
 *
 * Script clásico (ver theme.js). Namespace: EpeModal.
 */

var EpeModal = (function () {
  var root = null;
  var onCloseActual = null;
  var bloqueadoActual = false;

  function ensureRoot() {
    if (root) return root;
    root = document.createElement("div");
    root.className = "epe-modal-overlay";
    root.hidden = true;
    root.innerHTML =
      '<div class="epe-modal" role="dialog" aria-modal="true">' +
      '<div class="epe-modal-header">' +
      '<h3 data-modal-titulo></h3>' +
      '<button type="button" class="epe-modal-cerrar" data-modal-cerrar aria-label="Cerrar">×</button>' +
      "</div>" +
      '<div class="epe-modal-body" data-modal-body></div>' +
      "</div>";
    document.body.appendChild(root);

    root.addEventListener("click", function (ev) {
      if (ev.target === root) pedirCerrar();
    });
    root.querySelector("[data-modal-cerrar]").addEventListener("click", pedirCerrar);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !root.hidden) pedirCerrar();
    });

    return root;
  }

  // Cierre pedido por la persona (Esc, clic afuera, ×): un modal bloqueado lo ignora.
  function pedirCerrar() {
    if (bloqueadoActual) return;
    close();
  }

  function open(opciones) {
    var el = ensureRoot();
    onCloseActual = (opciones && opciones.onClose) || null;
    bloqueadoActual = !!(opciones && opciones.bloqueado);
    // style.display (no el atributo hidden): el CSS del botón le pone display propio.
    el.querySelector("[data-modal-cerrar]").style.display = bloqueadoActual ? "none" : "";

    el.querySelector("[data-modal-titulo]").textContent = (opciones && opciones.titulo) || "";
    var body = el.querySelector("[data-modal-body]");
    body.innerHTML = "";
    if (opciones && opciones.contenido) body.appendChild(opciones.contenido);

    el.hidden = false;
  }

  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    bloqueadoActual = false;
    var cb = onCloseActual;
    onCloseActual = null;
    if (cb) cb();
  }

  return { open: open, close: close };
})();
