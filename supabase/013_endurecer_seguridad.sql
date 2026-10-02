-- =====================================================================
-- Plataforma EpE — Endurecimiento de seguridad (013)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de 012.
--
-- Todo va dentro de una transacción: si algo falla, no se aplica nada.
--
-- Qué corrige (hallazgos de la revisión del 02/10/2026 + Security Advisor):
--  1) Un usuario podía marcarse a sí mismo como "verificado" en su
--     perfil (policy de UPDATE sin WITH CHECK ni límite de columnas).
--  2) puede_ver_caso() no exigía institución verificada: bastaba con
--     ELEGIR una institución para ver lo compartido con ella.
--  3) instituciones.codigo_acceso era legible por cualquier usuario
--     logueado (RLS filtra filas, no columnas).
--  4) Las funciones security definer eran ejecutables SIN login (anon).
--  5) etiqueta_colega() devolvía nombre/email de cualquier uuid.
--  6) verificar_institucion(): sin login, sin límite de intentos y con
--     códigos cortos generados con md5(random()).
--  7) set_actualizado_en() sin search_path fijo (aviso del Advisor).
--
-- NO requiere cambios en el JavaScript (revisado contra store.js):
--  - getInstituciones() ya pide solo "id, nombre".
--  - saveProfile() solo escribe columnas que siguen permitidas.
--  - elegirInstitucionSinVerificar()/setInstitucionPendiente() siguen
--    funcionando; la base fuerza que queden "sin verificar".
--
-- ANTES de correrlo: respaldo de policies y permisos (los 3 CSV).
-- Rollback: ver bloque comentado al final.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) instituciones: el código de acceso deja de ser legible por clientes
-- ---------------------------------------------------------------------
-- Se quita el permiso de lectura de TODA la tabla y se devuelve solo
-- sobre las columnas que el cliente necesita. Las funciones de staff
-- (security definer) siguen leyendo codigo_acceso porque corren con los
-- permisos del dueño de la función, no del usuario.
revoke select on public.instituciones from anon, authenticated;
grant select (id, nombre, creada_en) on public.instituciones to authenticated;

-- Los códigos actuales pudieron leerse con una consulta directa:
-- se rotan todos (8 caracteres, generados con gen_random_uuid(), que es
-- criptográficamente seguro). Los nuevos se ven en el panel de staff,
-- pestaña Instituciones.
update public.instituciones
set codigo_acceso = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

-- ---------------------------------------------------------------------
-- 2) profiles: nadie puede auto-verificarse
-- ---------------------------------------------------------------------
-- 2a) La policy de UPDATE ahora también valida la fila resultante.
drop policy if exists "profiles: update propio" on public.profiles;
create policy "profiles: update propio"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2b) Solo se pueden escribir las columnas que la app realmente usa.
--     Quedan fuera: id, email, creado_en. (Las 3 columnas de verificación
--     siguen en la lista porque el JS actual las manda; el trigger de
--     más abajo neutraliza cualquier intento de cambiarlas.)
revoke update on public.profiles from anon, authenticated;
grant update (
  nombre, profesion, telefono, localidad, email_contacto, actualizado_en,
  institucion_id, institucion_pendiente,
  institucion_verificada, institucion_verificada_en, institucion_verificada_metodo
) on public.profiles to authenticated;

-- 2c) Trigger: cuando el cambio viene de un cliente (rol authenticated /
--     anon), la verificación NO se puede subir a true:
--       - si cambia institucion_id o institucion_pendiente -> se resetea
--         a "sin verificar";
--       - si no cambian -> se conservan los valores anteriores.
--     Las funciones security definer (verificar_institucion, y la manual
--     del staff) corren como dueño de la función, no como "authenticated",
--     así que el trigger no las afecta y ESAS sí pueden verificar.
create or replace function public.profiles_proteger_verificacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.institucion_id is distinct from old.institucion_id
       or new.institucion_pendiente is distinct from old.institucion_pendiente then
      new.institucion_verificada := false;
      new.institucion_verificada_en := null;
      new.institucion_verificada_metodo := null;
    else
      new.institucion_verificada := old.institucion_verificada;
      new.institucion_verificada_en := old.institucion_verificada_en;
      new.institucion_verificada_metodo := old.institucion_verificada_metodo;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_proteger_verificacion on public.profiles;
create trigger profiles_proteger_verificacion
  before update on public.profiles
  for each row execute function public.profiles_proteger_verificacion();

-- ---------------------------------------------------------------------
-- 3) puede_ver_caso(): compartir con la institución exige verificación
--    de AMBAS personas (la dueña del caso y quien quiere verlo).
--    Sin "stable" (ver 011).
-- ---------------------------------------------------------------------
create or replace function public.puede_ver_caso(p_caso_id uuid)
returns boolean
language sql
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
                and exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
              )
              or (
                s.tipo = 'institucion'
                and exists (
                  select 1
                  from public.profiles dueno
                  join public.profiles yo on yo.id = auth.uid()
                  where dueno.id = c.dueno_id
                    and dueno.institucion_id is not null
                    and dueno.institucion_verificada
                    and yo.institucion_verificada
                    and dueno.institucion_id = yo.institucion_id
                )
              )
            )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------
-- 4) etiqueta_colega(): solo devuelve nombre/email si hay una relación
--    real entre quien pregunta y esa persona:
--      - es uno mismo,
--      - es alguien con quien yo compartí un caso (como colega),
--      - es alguien que me compartió un caso (como colega),
--      - o escribió un comentario en un caso que puedo ver.
--    Si no, devuelve null (el cliente muestra "Usuario").
-- ---------------------------------------------------------------------
create or replace function public.etiqueta_colega(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(nullif(p.nombre, ''), p.email, 'Usuario')
  from public.profiles p
  where p.id = p_user_id
    and auth.uid() is not null
    and (
      p.id = auth.uid()
      or exists (
        select 1
        from public.caso_shares s
        join public.casos c on c.id = s.caso_id
        where s.tipo = 'colega'
          and s.compartido_con_user_id = p.id
          and c.dueno_id = auth.uid()
      )
      or exists (
        select 1
        from public.caso_shares s
        join public.casos c on c.id = s.caso_id
        where s.tipo = 'colega'
          and s.compartido_con_user_id = auth.uid()
          and c.dueno_id = p.id
      )
      or exists (
        select 1
        from public.caso_comentarios cc
        where cc.autor_id = p.id
          and public.puede_ver_caso(cc.caso_id)
      )
    );
$$;

-- ---------------------------------------------------------------------
-- 5) verificar_institucion(): exige sesión, limita intentos y compara
--    sin distinguir mayúsculas. 5 intentos fallidos cada 15 minutos por
--    usuario; un acierto borra el contador.
-- ---------------------------------------------------------------------
create table if not exists public.intentos_codigo (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  intentado_en timestamptz not null default now()
);

create index if not exists intentos_codigo_user_idx
  on public.intentos_codigo (user_id, intentado_en desc);

-- RLS activado y SIN policies: nadie la lee ni escribe desde el cliente;
-- solo la función security definer de abajo.
alter table public.intentos_codigo enable row level security;
revoke all on public.intentos_codigo from anon, authenticated;

create or replace function public.verificar_institucion(p_institucion_id uuid, p_codigo text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_intentos int;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.';
  end if;

  select count(*) into v_intentos
  from public.intentos_codigo
  where user_id = auth.uid()
    and intentado_en > now() - interval '15 minutes';

  if v_intentos >= 5 then
    raise exception 'Demasiados intentos. Probá de nuevo en unos minutos.';
  end if;

  insert into public.intentos_codigo (user_id) values (auth.uid());

  select (codigo_acceso = upper(trim(p_codigo))) into v_ok
  from public.instituciones
  where id = p_institucion_id;

  if coalesce(v_ok, false) then
    update public.profiles
    set institucion_id = p_institucion_id,
        institucion_pendiente = null,
        institucion_verificada = true,
        institucion_verificada_en = now(),
        institucion_verificada_metodo = 'codigo'
    where id = auth.uid();

    delete from public.intentos_codigo where user_id = auth.uid();
  end if;

  return coalesce(v_ok, false);
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Generación de códigos: mismo patrón en crear y regenerar, pero con
--    gen_random_uuid() (8 caracteres) en vez de md5(random()).
-- ---------------------------------------------------------------------
create or replace function public.crear_institucion(p_nombre text)
returns table (id uuid, nombre text, codigo_acceso text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_id uuid;
begin
  if not exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid()) then
    raise exception 'Solo el staff de dis+capacidad puede hacer esto.';
  end if;

  v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.instituciones (nombre, codigo_acceso)
  values (trim(p_nombre), v_codigo)
  returning instituciones.id into v_id;

  return query select v_id, trim(p_nombre), v_codigo;
end;
$$;

create or replace function public.regenerar_codigo_institucion(p_institucion_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
begin
  if not exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid()) then
    raise exception 'Solo el staff de dis+capacidad puede hacer esto.';
  end if;

  v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update public.instituciones set codigo_acceso = v_codigo where id = p_institucion_id;

  return v_codigo;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) caso_comentarios_vistos: la marca solo se puede escribir sobre
--    casos que la persona puede ver.
-- ---------------------------------------------------------------------
drop policy if exists "caso_comentarios_vistos: insert propio" on public.caso_comentarios_vistos;
create policy "caso_comentarios_vistos: insert propio"
  on public.caso_comentarios_vistos for insert
  with check (usuario_id = auth.uid() and public.puede_ver_caso(caso_id));

drop policy if exists "caso_comentarios_vistos: update propio" on public.caso_comentarios_vistos;
create policy "caso_comentarios_vistos: update propio"
  on public.caso_comentarios_vistos for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid() and public.puede_ver_caso(caso_id));

-- ---------------------------------------------------------------------
-- 8) search_path fijo en la función de trigger que marcó el Advisor
-- ---------------------------------------------------------------------
alter function public.set_actualizado_en() set search_path = public;

-- ---------------------------------------------------------------------
-- 9) Permisos de ejecución de funciones
--    "revoke ... from public" no alcanza en Supabase: hay que sacar
--    también a "anon" (permiso explícito por defecto).
--    Después se vuelve a otorgar a "authenticated" explícitamente lo que
--    la app o las policies necesitan (puede_ver_caso lo usan las
--    policies de RLS).
-- ---------------------------------------------------------------------
revoke execute on function public.crear_institucion(text)                  from public, anon;
revoke execute on function public.directorio_pendientes_staff()            from public, anon;
revoke execute on function public.etiqueta_colega(uuid)                    from public, anon;
revoke execute on function public.find_user_id_by_email(text)              from public, anon;
revoke execute on function public.listar_instituciones_staff()             from public, anon;
revoke execute on function public.mis_casos_no_leidos()                    from public, anon;
revoke execute on function public.panel_staff_colecciones()                from public, anon;
revoke execute on function public.panel_staff_no_leidos()                  from public, anon;
revoke execute on function public.puede_ver_caso(uuid)                     from public, anon;
revoke execute on function public.regenerar_codigo_institucion(uuid)       from public, anon;
revoke execute on function public.soy_staff()                              from public, anon;
revoke execute on function public.verificar_institucion(uuid, text)        from public, anon;
revoke execute on function public.verificar_institucion_manual(uuid, uuid) from public, anon;

grant execute on function public.crear_institucion(text)                  to authenticated;
grant execute on function public.directorio_pendientes_staff()            to authenticated;
grant execute on function public.etiqueta_colega(uuid)                    to authenticated;
grant execute on function public.find_user_id_by_email(text)              to authenticated;
grant execute on function public.listar_instituciones_staff()             to authenticated;
grant execute on function public.mis_casos_no_leidos()                    to authenticated;
grant execute on function public.panel_staff_colecciones()                to authenticated;
grant execute on function public.panel_staff_no_leidos()                  to authenticated;
grant execute on function public.puede_ver_caso(uuid)                     to authenticated;
grant execute on function public.regenerar_codigo_institucion(uuid)       to authenticated;
grant execute on function public.soy_staff()                              to authenticated;
grant execute on function public.verificar_institucion(uuid, text)        to authenticated;
grant execute on function public.verificar_institucion_manual(uuid, uuid) to authenticated;

-- Funciones que solo deben dispararse como trigger: nadie las llama por
-- la API. (Postgres no revisa EXECUTE al disparar un trigger, solo al
-- crearlo — si el registro de cuentas nuevas fallara, ver rollback.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Para que las funciones que se creen de ahora en más en "public" NO
-- queden abiertas a anon/authenticated por defecto. Aplica a funciones
-- creadas por el rol "postgres" (el del SQL Editor). Cada función nueva
-- que la app deba llamar necesita su "grant execute ... to authenticated".
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

commit;

-- =====================================================================
-- VERIFICACIÓN (solo lectura, correr después, por separado)
-- =====================================================================
-- a) No debe quedar ninguna función ejecutable por anon/PUBLIC:
--    select routine_name, grantee
--    from information_schema.routine_privileges
--    where routine_schema = 'public' and grantee in ('anon','PUBLIC')
--    order by 1;
--
-- b) Columnas de instituciones visibles para authenticated (sin codigo_acceso):
--    select column_name from information_schema.column_privileges
--    where table_schema='public' and table_name='instituciones'
--      and grantee='authenticated' and privilege_type='SELECT';
--
-- c) Columnas de profiles que authenticated puede actualizar:
--    select column_name from information_schema.column_privileges
--    where table_schema='public' and table_name='profiles'
--      and grantee='authenticated' and privilege_type='UPDATE';

-- =====================================================================
-- ROLLBACK (solo si algo se rompe; usar junto con los CSV de respaldo)
-- =====================================================================
-- begin;
-- drop trigger if exists profiles_proteger_verificacion on public.profiles;
-- drop function if exists public.profiles_proteger_verificacion();
-- grant select on public.instituciones to authenticated;
-- grant update on public.profiles to authenticated;
-- grant execute on all functions in schema public to anon, authenticated;
-- alter default privileges for role postgres in schema public
--   grant execute on functions to anon, authenticated;
-- commit;
-- (Las definiciones anteriores de las funciones están en 010, 011 y 012.
--  Los códigos de acceso rotados no se pueden "des-rotar": se regeneran
--  o se consultan desde el panel de staff.)
