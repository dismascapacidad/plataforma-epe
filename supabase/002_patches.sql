-- =====================================================================
-- Plataforma EpE — Patches para la Fase 6 (migración de código)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de haber
-- corrido 001_schema_inicial.sql.
-- =====================================================================

-- 1) catalogo_actividades pasa a leerse desde el código (antes era un
--    array fijo en js/data/catalogo-actividades.js). La policy original
--    solo dejaba leer a usuarios logueados, pero
--    apps-terceros/index.html es una página PÚBLICA (sin login) que
--    también necesita mostrar el catálogo — hay que abrir la lectura a
--    "anon" además de "authenticated".
drop policy "catalogo: lectura para logueados" on public.catalogo_actividades;

create policy "catalogo: lectura publica"
  on public.catalogo_actividades for select
  to anon, authenticated
  using (true);

-- 2) casos.dueno_id se completa solo con el usuario logueado (auth.uid()),
--    así el cliente no tiene que mandarlo a mano en cada insert — alcanza
--    con EpeSupabase.from("casos").insert({ nombre: ... }).
alter table public.casos alter column dueno_id set default auth.uid();
