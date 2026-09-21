/**
 * theme.js
 * Maneja el botón de toggle claro/oscuro. El estado inicial ya lo aplicó
 * theme-boot.js (para evitar parpadeo); acá solo se engancha la interacción
 * y se persiste el cambio.
 *
 * Script clásico a propósito (sin import/export): un módulo ES no carga
 * si la página se abre directo con file:// (doble clic), y este proyecto
 * necesita poder verse así, sin depender de un servidor local. Se expone
 * un único objeto de namespace (EpeTheme) para no ensuciar el global scope.
 */

var EpeTheme = (function () {
  var STORAGE_KEY = "epe-theme";

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      // Sin storage disponible: el toggle igual funciona, solo no persiste.
    }
  }

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function initThemeToggle(buttonEl) {
    if (!buttonEl) return;

    buttonEl.addEventListener("click", function () {
      var isDark = document.documentElement.getAttribute("data-theme") === "dark";
      var next = isDark ? "light" : "dark";
      applyTheme(next);
      setStoredTheme(next);
      buttonEl.setAttribute("aria-pressed", String(next === "dark"));
    });

    var current = getStoredTheme() === "dark";
    buttonEl.setAttribute("aria-pressed", String(current));
  }

  return { initThemeToggle: initThemeToggle };
})();
