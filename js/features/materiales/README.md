# Material de consulta

Página `materiales/index.html`. Muestra PDF (Google Drive) y videos (YouTube)
como cards.

- **Datos:** `js/data/catalogo-materiales.js`. Cada material tiene un `id`
  estable, `tipo` (`pdf`/`video`), `acceso` (`publico`/`logueado`) y el id de
  Drive o de YouTube (nunca una URL entera: se arma en `urlsDe()`).
- **Acceso:** las cards `logueado` se ven siempre, con candado; abrirlas sin
  sesión ofrece ingresar. Es un incentivo, **no seguridad**: los links de Drive
  son públicos y este repo también.
- **Sesión:** `js/core/sesion-ui.js` refleja la sesión en el header. La sesión
  persiste en el navegador (Supabase, localStorage) entre todas las páginas.
- **Sumar un material:** agregar un objeto a `MATERIALES` con un `id` nuevo.
  Para un PDF: pegar el id de Drive (entre `/d/` y `/view`; el archivo debe
  estar compartido como "cualquiera con el link"). Para un video: el id de 11
  caracteres de YouTube.
- **Vínculo con colecciones (pendiente):** una colección guardaría el `id` del
  material, como `caso_actividades` guarda el `catalogo_id` de una actividad.
  Por eso los `id` publicados no se cambian.
