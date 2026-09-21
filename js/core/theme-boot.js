/**
 * theme-boot.js
 * Se carga con <script src="..."> normal (sin type="module", sin defer),
 * lo antes posible en <head>, antes de los <link> de CSS. Su único trabajo
 * es aplicar el tema guardado ANTES de que se pinte la página, para que no
 * haya un parpadeo claro→oscuro al cargar. Por eso vive separado de
 * theme.js (que sí es un módulo y maneja el toggle) en vez de mezclarse:
 * este archivo tiene que poder correr sin esperar a nada.
 *
 * Default: claro. Solo pasa a oscuro si el usuario lo eligió antes.
 */
(function () {
  try {
    if (localStorage.getItem("epe-theme") === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) {
    // localStorage puede fallar (modo privado, storage bloqueado): seguimos en claro.
  }
})();
