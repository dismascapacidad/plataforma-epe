-- 021_requisitos_cursor_arrastrar.sql
-- Los requisitos de un recurso (columna `teclas`, de 018) ahora pueden ser, además
-- de teclas, acciones de mouse, "mover el cursor con las flechas" y "arrastrar y
-- soltar". Este archivo carga eso en FORMITAS y COMPLETAR (de 020) y corrige su
-- texto de configuración: antes decía que no se hacía desde la plataforma.
--
-- Formas que entiende la plataforma (cada ítem tiene UNA sola):
--   {"id":"e","etiqueta":"Barra espaciadora","tecla":" "}              -- tecla (opcional "mods":["ctrl","shift","alt","gui"])
--   {"id":"c","etiqueta":"Clic derecho","mouse":"clic-derecho"}         -- clic | clic-derecho | clic-central | doble-clic | scroll-arriba | scroll-abajo
--   {"id":"cursor","etiqueta":"Mover el cursor","cursor":true}          -- las flechas mueven el cursor (sin botón)
--   {"id":"arrastrar","etiqueta":"Arrastrar y soltar","arrastrar":true} -- un botón de clic mantenido
-- Máximo 8 ítems, como siempre (el constraint de 018 alcanza: no cambia ninguna tabla).
--
-- Seguridad: solo UPDATE de dos filas por URL; no toca tablas, columnas ni policies.
-- Respaldo: exportar la tabla antes. Vuelta atrás al final. Requiere haber corrido 020.

update public.catalogo_actividades
set
  teclas = '[
    {"id":"cursor","etiqueta":"Mover el cursor","cursor":true}
  ]'::jsonb,
  configuracion = 'La plataforma configura las flechas del dispositivo para que muevan el cursor y te deja ajustar la velocidad y la aceleración. Al terminar, volvé a la pestaña de la plataforma desde donde abriste el recurso y presioná «Restaurar» para devolver el dispositivo a como estaba.'
where url = 'https://elbuhoboo.com/juegos-educativos/formitas/';

update public.catalogo_actividades
set
  teclas = '[
    {"id":"cursor","etiqueta":"Mover el cursor","cursor":true},
    {"id":"arrastrar","etiqueta":"Arrastrar y soltar","arrastrar":true}
  ]'::jsonb,
  configuracion = 'La plataforma configura las flechas del dispositivo para que muevan el cursor y te pregunta con qué botón querés arrastrar (un toque agarra y otro suelta, o mantener el botón presionado). Al terminar, volvé a la pestaña de la plataforma desde donde abriste el recurso y presioná «Restaurar» para devolver el dispositivo a como estaba.'
where url = 'https://elbuhoboo.com/juegos-educativos/completar-panda/';

-- Comprobación (tiene que dar 2 filas con teclas):
--   select nombre, teclas from public.catalogo_actividades where url like 'https://elbuhoboo.com/%' and teclas is not null;

-- ---------------------------------------------------------------------
-- VUELTA ATRÁS (no se corre junto con lo de arriba): deja las dos filas sin teclas.
--   update public.catalogo_actividades set teclas = null
--   where url in ('https://elbuhoboo.com/juegos-educativos/formitas/',
--                 'https://elbuhoboo.com/juegos-educativos/completar-panda/');
-- ---------------------------------------------------------------------
