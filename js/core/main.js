/**
 * main.js
 * Punto de entrada de la Plataforma EpE. Script clásico, cargado después de
 * theme.js (ver index.html) — nada de type="module": así la página funciona
 * abierta directo con file://, sin depender de un servidor local.
 *
 * En este paso (maquetado + estética) casi no hay lógica real todavía: los
 * tiles del home son enlaces/placeholders. A medida que cada sección exista
 * (configurador, apps-epe, perfil), se decide ahí si su lógica entra acá o
 * se navega a su propio index.html.
 */

EpeTheme.initThemeToggle(document.getElementById("theme-toggle"));

console.info("[EpE] Plataforma Equipar para Equipar — shell inicial cargado");
