-- =====================================================================
-- Plataforma EpE — Compartir casos de verdad (Fase 7)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de
-- 001_schema_inicial.sql y 002_patches.sql.
--
-- Antes de esto, caso_shares guardaba el estado del toggle pero nadie
-- del otro lado podía ver nada — esto agrega la parte que faltaba:
-- 1) profiles.email, para poder mostrar CON QUIÉN está compartido un caso.
-- 2) profiles.es_admin_dismascapacidad, para el share tipo "dismascapacidad".
-- 3) find_user_id_by_email(): buscar el uuid de un colega por su email,
--    sin exponer la lista completa de usuarios al cliente.
-- 4) etiqueta_colega(): traer un texto para mostrar (nombre o email) de
--    la persona con la que se compartió, sin exponer su perfil entero.
-- 5) puede_ver_caso(): centraliza toda la lógica de "quién puede ver este
--    caso" (dueño, colega compartido, institución igual, o admin de
--    dis+capacidad) y se reusa en las policies de las 4 tablas del caso.
-- =====================================================================

-- 1) email en profiles (antes solo vivía en auth.users, invisible para
--    otros usuarios). Se completa en el mismo trigger que ya crea el
--    profile al registrarse.
alter table public.profiles add column if not exists email text not null default '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

-- Los usuarios que ya existían antes de este patch no tienen email en su
-- profile todavía: lo completamos una sola vez acá.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

-- 2) Flag de admin de dis+capacidad — sin UI para activarlo, se carga a
--    mano por SQL. Reemplazá el email antes de correr esta línea:
--
--    update public.profiles set es_admin_dismascapacidad = true
--    where email = 'TU_EMAIL_ACA';
--
alter table public.profiles add column if not exists es_admin_dismascapacidad boolean not null default false;

-- 3) Buscar un colega por email. SECURITY DEFINER para poder leer
--    auth.users (los usuarios comunes no tienen permiso), pero solo
--    devuelve un uuid — nada de datos personales. Restringido a usuarios
--    logueados.
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public;
grant execute on function public.find_user_id_by_email(text) to authenticated;

-- 4) Nombre o email para mostrar en la lista de "compartido con" — nunca
--    el perfil completo del colega, sea quien sea el que pregunta.
create or replace function public.etiqueta_colega(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(nullif(nombre, ''), email, 'Usuario') from public.profiles where id = p_user_id;
$$;

revoke all on function public.etiqueta_colega(uuid) from public;
grant execute on function public.etiqueta_colega(uuid) to authenticated;

-- 5) "¿Puede este usuario ver este caso?" — dueño, o alguno de los tres
--    tipos de share. Institución se resuelve comparando el texto libre
--    del perfil (sin mayúsculas/espacios de más) — si hay un typo entre
--    dos perfiles, no matchea; es la limitación conocida de no modelar
--    instituciones como entidad propia todavía.
create or replace function public.puede_ver_caso(p_caso_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.casos c
    where c.id = p_caso_id
      and (
        c.dueno_id = auth.uid()
        or exists (
          select 1 from public.caso_shares s
          where s.caso_id = c.id
            and (
              (s.tipo = 'colega' and s.compartido_con_user_id = auth.uid())
              or (
                s.tipo = 'dismascapacidad'
                and exists (select 1 from public.profiles p where p.id = auth.uid() and p.es_admin_dismascapacidad)
              )
              or (
                s.tipo = 'institucion'
                and exists (
                  select 1
                  from public.profiles dueno
                  join public.profiles yo on yo.id = auth.uid()
                  where dueno.id = c.dueno_id
                    and trim(lower(dueno.institucion)) <> ''
                    and trim(lower(dueno.institucion)) = trim(lower(yo.institucion))
                )
              )
            )
        )
      )
  );
$$;

-- Policies de lectura compartida — se SUMAN a las que ya existían
-- ("casos: select propio", etc.): en Postgres, varias policies
-- permisivas para el mismo comando se combinan con OR, así que esto
-- amplía quién puede leer sin tocar las reglas de dueño ni las de
-- insert/update/delete (compartir sigue siendo de solo lectura).

create policy "casos: select compartido"
  on public.casos for select
  using (public.puede_ver_caso(id));

create policy "caso_actividades: select compartido"
  on public.caso_actividades for select
  using (public.puede_ver_caso(caso_id));

create policy "caso_apps_terceros: select compartido"
  on public.caso_apps_terceros for select
  using (public.puede_ver_caso(caso_id));

create policy "caso_entradas: select compartido"
  on public.caso_entradas for select
  using (public.puede_ver_caso(caso_id));
