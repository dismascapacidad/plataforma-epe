-- =====================================================================
-- Plataforma EpE — Alta de "Torre de Hanói", "N-back" y "Stroop" en el
-- catálogo de Apps EpE. Correr en Supabase → SQL Editor → New query → Run.
--
-- Solo agrega tres filas a catalogo_actividades (ya existente desde
-- 001_schema_inicial.sql) — no toca esquema ni RLS. Con esto los tres
-- juegos aparecen en la "tienda" de actividades vinculables a un caso,
-- dentro de Gestión de casos → Recursos. El link directo desde
-- apps-epe/index.html es aparte y no depende de esta tabla: si todavía
-- no agregaste ahí los tres tiles, esta alta no los hace visibles solos.
--
-- icono_key ya usa 'hanoi' / 'nback' / 'stroop': el mapa ICONOS de
-- js/data/catalogo-actividades.js tiene esas tres claves (mismos SVG que
-- los tiles de apps-epe/index.html).
-- =====================================================================

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key)
values
  ('app-epe', 'Torre de Hanói',
   'Planificación y función ejecutiva: pasar una torre de discos de una varilla a otra, de a uno por vez, sin apoyar nunca uno grande sobre uno más chico. Se juega con teclado o con barrido de 1 o 2 pulsadores.',
   'Planificación y función ejecutiva', 'dis+capacidad', '../apps-epe/hanoi.html', '', '', 'hanoi'),
  ('app-epe', 'N-back',
   'Memoria de trabajo y atención: indicar cuándo el estímulo actual (posición, letra, o ambos) coincide con el de N pasos atrás. Se responde con una o dos teclas; ritmo ajustable hasta muy lento.',
   'Memoria de trabajo y atención', 'dis+capacidad', '../apps-epe/nback.html', '', '', 'nback'),
  ('app-epe', 'Stroop',
   'Control inhibitorio y atención selectiva: responder al color de la tinta de una palabra, ignorando lo que la palabra dice. Se juega con teclado o con barrido de 1 o 2 pulsadores.',
   'Control inhibitorio y atención selectiva', 'dis+capacidad', '../apps-epe/stroop.html', '', '', 'stroop');
