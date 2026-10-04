-- =====================================================================
-- Plataforma EpE — Recursos de terceros compatibles con dis+capacidad (018)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de 017.
--
-- Qué resuelve: un recurso externo (de terceros) puede declarar a qué TECLAS
-- responde (ej. las 4 flechas). Con eso la plataforma:
--   - lo marca como "Compatible dis+capacidad";
--   - antes de abrir la página externa, deja asignar cada tecla a un botón de
--     un dispositivo dis+capacidad (widget "Configurar dispositivo");
--   - avisa cómo restaurar el dispositivo (volviendo a la pestaña de la
--     plataforma y presionando «Restaurar»).
--
-- Qué cambia:
--  1) Columna nueva `teclas` (jsonb, opcional) en catalogo_actividades:
--       [{"id":"up","etiqueta":"Flecha ↑","tecla":"arrowup"}, ...]
--     `tecla` usa el formato de KeyboardEvent.key en minúscula (una letra o
--     dígito, o: " ", arrowup, arrowdown, arrowleft, arrowright, enter,
--     escape, tab, backspace, delete). De 1 a 8 entradas. El código del
--     cliente VUELVE a validar todo esto antes de usarlo.
--     null = recurso sin compatibilidad (todos los actuales).
--  2) Alta del primer recurso de prueba: COUNTER (Makey Makey Apps).
--
-- Seguridad:
--  - Las policies NO cambian. La lectura sigue siendo pública (policy
--    "catalogo: lectura publica", ver 002) y no hay policy de
--    insert/update/delete: el catálogo solo se escribe desde el SQL Editor
--    o el Table Editor de Supabase. Una columna nueva queda cubierta por la
--    misma policy de fila. Qué ve cada rol: anon y authenticated ven la
--    columna `teclas` (no es un dato sensible); nadie puede escribirla
--    desde la app.
--  - No toca datos de personas.
--
-- Respaldo antes de correrlo (la tabla es chica): en el SQL Editor,
--   select * from public.catalogo_actividades;
-- y exportar el resultado a CSV. Vuelta atrás: ver el final del archivo.
-- =====================================================================

alter table public.catalogo_actividades
  add column if not exists teclas jsonb;

alter table public.catalogo_actividades
  drop constraint if exists catalogo_teclas_forma;

alter table public.catalogo_actividades
  add constraint catalogo_teclas_forma
  check (
    teclas is null
    or (jsonb_typeof(teclas) = 'array' and jsonb_array_length(teclas) between 1 and 8)
  );

comment on column public.catalogo_actividades.teclas is
  'Teclas a las que responde un recurso externo compatible con dis+capacidad: [{id, etiqueta, tecla}]. null = sin compatibilidad.';

-- ---------------------------------------------------------------------
-- Primer recurso de prueba: COUNTER (Makey Makey Apps).
-- Idempotente: no lo vuelve a cargar si ya existe una fila con esa URL.
-- ---------------------------------------------------------------------
insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key, teclas)
select
  'tercero',
  'COUNTER (Makey Makey Apps)',
  'Juego de Makey Makey que responde a las teclas de dirección del teclado. Con un dispositivo dis+capacidad, cada flecha se asigna a un botón.',
  'Juegos',
  'Makey Makey (JoyLabz)',
  'https://apps.makeymakey.com/play/#counter',
  'Se abre en una pestaña nueva. Respondé con los botones que asignaste a cada flecha del teclado.',
  'Asignar las 4 flechas del teclado (↑ ↓ ← →) a botones del dispositivo dis+capacidad. Al terminar, volvé a la pestaña de la plataforma desde donde abriste el recurso y presioná «Restaurar» para devolver el dispositivo a como estaba.',
  'externo',
  '[
    {"id":"up","etiqueta":"Flecha ↑","tecla":"arrowup"},
    {"id":"down","etiqueta":"Flecha ↓","tecla":"arrowdown"},
    {"id":"left","etiqueta":"Flecha ←","tecla":"arrowleft"},
    {"id":"right","etiqueta":"Flecha →","tecla":"arrowright"}
  ]'::jsonb
where not exists (
  select 1 from public.catalogo_actividades
  where url = 'https://apps.makeymakey.com/play/#counter'
);

-- Comprobación:
--   select nombre, teclas from public.catalogo_actividades where teclas is not null;

-- ---------------------------------------------------------------------
-- VUELTA ATRÁS (si hace falta; no se corre junto con lo de arriba):
--   delete from public.catalogo_actividades
--     where url = 'https://apps.makeymakey.com/play/#counter';
--   alter table public.catalogo_actividades drop constraint if exists catalogo_teclas_forma;
--   alter table public.catalogo_actividades drop column if exists teclas;
-- ---------------------------------------------------------------------
