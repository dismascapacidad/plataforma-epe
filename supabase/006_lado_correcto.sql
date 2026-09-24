-- =====================================================================
-- Plataforma EpE — Alta de "Lado Correcto" en el catálogo de Apps EpE
-- Correr en Supabase → SQL Editor → New query → Run.
--
-- Solo agrega una fila a catalogo_actividades (ya existente desde
-- 001_schema_inicial.sql) — no toca esquema ni RLS. Con esto "Lado
-- Correcto" aparece tanto en apps-epe/index.html (link directo, no
-- depende de esta tabla) como en la "tienda" de actividades vinculables
-- a un caso, dentro de Gestión de casos → Recursos.
-- =====================================================================

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key)
values
  ('app-epe', 'Lado Correcto',
   'Neuroestimulación de reacción y lateralidad: una fila de frutas se acerca de a una y hay que responder con la flecha del lado que corresponde, antes de que llegue la siguiente.',
   'Reacción y lateralidad', 'dis+capacidad', '../apps-epe/lado-correcto.html', '', '', 'lado-correcto');
