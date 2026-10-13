-- =====================================================================
-- Plataforma EpE — Material de consulta vinculable a colecciones
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de
-- 023_alta_simoneuro.sql. NO es destructiva: solo crea dos tablas nuevas,
-- no toca ninguna existente.
--
-- Dos tablas, mismo patrón que caso_actividades / caso_apps_terceros:
--
-- 1) caso_materiales — referencia a un material del catálogo de
--    dis+capacidad (js/data/catalogo-materiales.js). El catálogo vive en el
--    código, no en la base, así que material_id es TEXTO sin clave foránea:
--    si un material se saca del catálogo, la colección lo muestra como
--    "Material no disponible" (igual que "Actividad no disponible").
--
-- 2) caso_materiales_propios — material de la persona: un nombre y un link a
--    un archivo de SU Drive (drive.google.com / docs.google.com). Los datos
--    van inline y solo se ven desde esa colección: nunca entran al catálogo.
--
-- Quién ve qué (igual que el resto del caso):
--   - dueño: ve, agrega y borra.
--   - quien ve la colección (colega, institución, dis+capacidad según
--     cómo la compartió el dueño): solo ve, vía puede_ver_caso().
--   - anon (sin sesión): nada.
--   - nadie puede modificar (UPDATE) una fila: para corregir, se borra y
--     se vuelve a crear.
-- Agregar contenido a una colección "congelada" (dueño saliendo de una
-- institución) está bloqueado, como en las demás tablas hijas.
-- =====================================================================

begin;

create table public.caso_materiales (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  material_id text not null check (char_length(material_id) between 1 and 80),
  agregado_en timestamptz not null default now(),
  unique (caso_id, material_id) -- no vincular dos veces el mismo material
);

create index caso_materiales_caso_id_idx on public.caso_materiales (caso_id);

create table public.caso_materiales_propios (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  -- Solo https hacia Google Drive o Google Docs, sin espacios y con tope de
  -- largo. El navegador valida lo mismo (EpeMaterialVisor.urlDriveValida),
  -- pero esta es la regla que vale: la API se puede llamar sin la página.
  url text not null check (
    char_length(url) <= 500
    and url ~ '^https://(drive|docs)\.google\.com/[^[:space:]]*$'
  ),
  creado_en timestamptz not null default now()
);

create index caso_materiales_propios_caso_id_idx on public.caso_materiales_propios (caso_id);

comment on table public.caso_materiales is
  'Material del catálogo de dis+capacidad vinculado a una colección (referencia por id de texto).';
comment on table public.caso_materiales_propios is
  'Material propio de una colección: nombre + link a Drive/Docs del dueño. Solo visible desde esa colección.';

-- Permisos de tabla: lo mínimo. Sin anon, y sin UPDATE para nadie.
revoke all on public.caso_materiales from anon, authenticated;
revoke all on public.caso_materiales_propios from anon, authenticated;
grant select, insert, delete on public.caso_materiales to authenticated;
grant select, insert, delete on public.caso_materiales_propios to authenticated;

alter table public.caso_materiales enable row level security;
alter table public.caso_materiales_propios enable row level security;

-- ── caso_materiales ────────────────────────────────────────────────────
create policy "caso_materiales: select propio"
  on public.caso_materiales for select
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));

create policy "caso_materiales: select compartido"
  on public.caso_materiales for select
  using (public.puede_ver_caso(caso_id));

create policy "caso_materiales: insert via caso"
  on public.caso_materiales for insert
  with check (
    exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid())
    and not public.caso_institucion_congelada(caso_id)
  );

create policy "caso_materiales: delete via caso"
  on public.caso_materiales for delete
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));

-- ── caso_materiales_propios ────────────────────────────────────────────
create policy "caso_materiales_propios: select propio"
  on public.caso_materiales_propios for select
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));

create policy "caso_materiales_propios: select compartido"
  on public.caso_materiales_propios for select
  using (public.puede_ver_caso(caso_id));

create policy "caso_materiales_propios: insert via caso"
  on public.caso_materiales_propios for insert
  with check (
    exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid())
    and not public.caso_institucion_congelada(caso_id)
  );

create policy "caso_materiales_propios: delete via caso"
  on public.caso_materiales_propios for delete
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));

commit;

-- =====================================================================
-- VERIFICACIÓN (solo lectura, correr después, por separado)
-- =====================================================================
-- a) RLS activado en las dos tablas (relrowsecurity debe dar true):
--    select relname, relrowsecurity from pg_class
--    where relname in ('caso_materiales', 'caso_materiales_propios');
--
-- b) Las 4 policies de cada tabla (select x2, insert, delete) y ninguna "using (true)":
--    select tablename, policyname, cmd, qual, with_check from pg_policies
--    where tablename in ('caso_materiales', 'caso_materiales_propios')
--    order by tablename, cmd;
--
-- c) anon no debe tener ningún permiso sobre las tablas (0 filas):
--    select table_name, grantee, privilege_type
--    from information_schema.role_table_grants
--    where table_name in ('caso_materiales', 'caso_materiales_propios')
--      and grantee = 'anon';
--
-- d) El CHECK rechaza un link que no sea de Drive/Docs (debe dar error):
--    insert into public.caso_materiales_propios (caso_id, nombre, url)
--    select id, 'prueba', 'https://drive.google.com.evil.com/x' from public.casos limit 1;
--    (si la colección existe, falla por la restricción; no deja nada guardado)

-- =====================================================================
-- VUELTA ATRÁS (si hiciera falta; borra también el material ya vinculado):
-- =====================================================================
-- drop table public.caso_materiales_propios;
-- drop table public.caso_materiales;
