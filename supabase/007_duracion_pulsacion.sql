-- =====================================================================
-- Plataforma EpE — Alta de "Duración de pulsación" en el catálogo de
-- Apps EpE. Correr en Supabase → SQL Editor → New query → Run.
--
-- Solo agrega una fila a catalogo_actividades (ya existente desde
-- 001_schema_inicial.sql) — no toca esquema ni RLS.
-- =====================================================================

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key)
values
  ('app-epe', 'Duración de pulsación',
   'Entrenamiento de acceso por switch: diferenciar pulsaciones cortas (cambiar de bloque) de largas (moverlo hasta la zona objetivo), con dificultad creciente por nivel.',
   'Acceso por switch', 'dis+capacidad', '../apps-epe/duracion-pulsacion.html', '', '', 'duracion-pulsacion');
