-- =====================================================================
-- Plataforma EpE — Instituciones propias, staff de dis+capacidad y
-- código de acceso por institución (Fase 8)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de
-- 001_schema_inicial.sql, 002_patches.sql, 003_compartir.sql y
-- 004_comentarios.sql.
--
-- Qué resuelve (ver doc "Dashboard dis+capacidad - ADR institución,
-- staff y panel" en el proyecto):
-- 1) instituciones: catálogo propio en vez de institución como texto
--    libre en profiles — necesario para agrupar de forma confiable por
--    institución en el panel de dis+capacidad, a la escala de 70+
--    instituciones reales.
-- 2) profiles.institucion_id / institucion_pendiente /
--    institucion_verificada*: reemplazan a profiles.institucion.
-- 3) staff_dismascapacidad: reemplaza al booleano
--    es_admin_dismascapacidad — cualquier fila ahí es alguien del
--    equipo con acceso al panel (hoy, todo el equipo = 1 cuenta:
--    dismascapacidad@gmail.com).
-- 4) puede_ver_caso() actualizada para usar lo de arriba.
-- 5) Código de acceso por institución: valida que un profesional
--    realmente pertenece a la institución que elige, sin depender de
--    dominio de email (la mayoría usa emails personales) ni de
--    invitaciones nominales (dis+capacidad no sabe de antemano qué
--    profesional puntual de cada institución se va a registrar — el
--    vínculo es con la institución, no con la persona). El código
--    nunca se compara en el cliente: todo pasa por funciones
--    security definer.
--
-- Al 01/10/2026 solo hay 2 perfiles de prueba (ambos de Gon, uno es
-- dismascapacidad@gmail.com) y la plataforma no está lanzada — por eso
-- esta migración pisa directo profiles.institucion en vez de hacer una
-- migración de datos en dos pasos.
-- =====================================================================

-- 1) Instituciones ------------------------------------------------------

create table public.instituciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  codigo_acceso text not null,
  creada_en timestamptz not null default now()
);

alter table public.instituciones enable row level security;

-- Cualquier usuario autenticado puede leer id+nombre (lo necesita el
-- selector del formulario de Perfil). El código de acceso viaja en la
-- misma fila porque RLS es por fila, no por columna — pero del lado del
-- cliente nunca se pide esa columna salvo desde las funciones de staff
-- de más abajo (listar_instituciones_staff), así que en la práctica no
-- se expone. Riesgo aceptado conscientemente (ver el ADR): el código es
-- compartido, no personal, y de bajo impacto si se filtra (se regenera).
create policy "instituciones: select autenticado"
  on public.instituciones for select
  to authenticated
  using (true);

-- 2) Perfiles: institución como entidad, no texto libre ----------------

alter table public.profiles add column if not exists institucion_id uuid references public.instituciones (id);
alter table public.profiles add column if not exists institucion_pendiente text;
alter table public.profiles add column if not exists institucion_verificada boolean not null default false;
alter table public.profiles add column if not exists institucion_verificada_en timestamptz;
alter table public.profiles add column if not exists institucion_verificada_metodo text;

-- Con solo 2 perfiles de prueba no hace falta migrar datos reales — se
-- retiran directo las dos columnas viejas.
alter table public.profiles drop column if exists institucion;
alter table public.profiles drop column if exists es_admin_dismascapacidad;

-- 3) Staff de dis+capacidad ---------------------------------------------

create table public.staff_dismascapacidad (
  user_id uuid primary key references auth.users (id) on delete cascade,
  agregado_en timestamptz not null default now(),
  agregado_por uuid references auth.users (id)
);

alter table public.staff_dismascapacidad enable row level security;
-- Sin policies de select/insert/update/delete a propósito: nadie lee ni
-- escribe esta tabla desde el cliente. El alta de staff se hace a mano
-- por SQL Editor; todo lo demás la consulta vía funciones security
-- definer (puede_ver_caso, soy_staff, etc.), nunca con un select directo.

insert into public.staff_dismascapacidad (user_id)
select id from auth.users where email = 'dismascapacidad@gmail.com'
on conflict (user_id) do nothing;

-- 4) puede_ver_caso(): institución por id, admin vía staff_dismascapacidad

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
                    and dueno.institucion_id = yo.institucion_id
                )
              )
            )
        )
      )
  );
$$;

-- 5) soy_staff(): para que el panel de staff sepa si mostrarse o no

create or replace function public.soy_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid());
$$;

grant execute on function public.soy_staff() to authenticated;

-- 6) Validar el código de acceso sin exponerlo en una consulta de lectura

create or replace function public.verificar_institucion(p_institucion_id uuid, p_codigo text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  select (codigo_acceso = trim(p_codigo)) into v_ok
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
  end if;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.verificar_institucion(uuid, text) from public;
grant execute on function public.verificar_institucion(uuid, text) to authenticated;

-- 7) Marcar verificada una institución a mano (staff) — para cuando se
--    confirma la pertenencia por otro medio, sin código, o al resolver
--    un institucion_pendiente recién dado de alta.

create or replace function public.verificar_institucion_manual(p_profile_id uuid, p_institucion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid()) then
    raise exception 'Solo el staff de dis+capacidad puede hacer esto.';
  end if;

  update public.profiles
  set institucion_id = p_institucion_id,
      institucion_pendiente = null,
      institucion_verificada = true,
      institucion_verificada_en = now(),
      institucion_verificada_metodo = 'manual_staff'
  where id = p_profile_id;
end;
$$;

revoke all on function public.verificar_institucion_manual(uuid, uuid) from public;
grant execute on function public.verificar_institucion_manual(uuid, uuid) to authenticated;

-- 8) Crear una institución (staff) generando el código en el mismo paso

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

  v_codigo := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.instituciones (nombre, codigo_acceso)
  values (trim(p_nombre), v_codigo)
  returning instituciones.id into v_id;

  return query select v_id, trim(p_nombre), v_codigo;
end;
$$;

revoke all on function public.crear_institucion(text) from public;
grant execute on function public.crear_institucion(text) to authenticated;

-- 9) Regenerar el código de acceso de una institución (staff)

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

  v_codigo := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  update public.instituciones set codigo_acceso = v_codigo where id = p_institucion_id;

  return v_codigo;
end;
$$;

revoke all on function public.regenerar_codigo_institucion(uuid) from public;
grant execute on function public.regenerar_codigo_institucion(uuid) to authenticated;

-- 10) Lista de instituciones PARA STAFF (incluye el código, a diferencia
--     de un select normal sobre la tabla) — para poder reenviarlo.

create or replace function public.listar_instituciones_staff()
returns table (id uuid, nombre text, codigo_acceso text, creada_en timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.nombre, i.codigo_acceso, i.creada_en
  from public.instituciones i
  where exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
  order by i.nombre;
$$;

revoke all on function public.listar_instituciones_staff() from public;
grant execute on function public.listar_instituciones_staff() to authenticated;

-- 11) El panel de staff en un solo llamado: colecciones compartidas con
--     "dismascapacidad", ya agrupables por institución y profesional.
--     Deliberadamente NO reusa getCasos() del espacio personal (que
--     trae todo lo que RLS deja ver, incluidas las colecciones propias
--     del staff): esto trae SOLO lo compartido con la empresa, para no
--     repetir el bug original (todo mezclado en una sola lista).

create or replace function public.panel_staff_colecciones()
returns table (
  caso_id uuid,
  caso_nombre text,
  caso_actualizado_en timestamptz,
  dueno_id uuid,
  dueno_nombre text,
  dueno_email text,
  institucion_id uuid,
  institucion_nombre text,
  institucion_pendiente text,
  institucion_verificada boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.nombre, c.actualizado_en,
    p.id, p.nombre, p.email,
    i.id, i.nombre, p.institucion_pendiente, p.institucion_verificada
  from public.casos c
  join public.caso_shares s on s.caso_id = c.id and s.tipo = 'dismascapacidad'
  join public.profiles p on p.id = c.dueno_id
  left join public.instituciones i on i.id = p.institucion_id
  where exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
  order by coalesce(i.nombre, 'zzz_sin_institucion'), p.nombre, c.actualizado_en desc;
$$;

revoke all on function public.panel_staff_colecciones() from public;
grant execute on function public.panel_staff_colecciones() to authenticated;

-- 12) Directorio de pendientes (staff): perfiles con institución sin
--     resolver, hayan compartido una colección o no.

create or replace function public.directorio_pendientes_staff()
returns table (
  id uuid,
  nombre text,
  email text,
  institucion_id uuid,
  institucion_pendiente text,
  institucion_verificada boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.email, p.institucion_id, p.institucion_pendiente, p.institucion_verificada
  from public.profiles p
  where exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
    and (
      (p.institucion_pendiente is not null and trim(p.institucion_pendiente) <> '')
      or (p.institucion_id is not null and p.institucion_verificada = false)
    );
$$;

revoke all on function public.directorio_pendientes_staff() from public;
grant execute on function public.directorio_pendientes_staff() to authenticated;

-- 13) Seed: las 20 instituciones conocidas (institutions-ticker de
--     equiparparaequipar.com.ar, relevado el 01/10/2026). REVISAR los
--     nombres con Gon antes de correr esto si alguno debería decir
--     distinto a como aparece en la web.

insert into public.instituciones (nombre, codigo_acceso) values
  ('ALPI', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Centro de Rehabilitación Despertar', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('ALPI San Francisco', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('ALPI Deán Funes', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Centro de Estimulación Renacer', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Centro Privado de Rehab. Dra. Raquel Heredia', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Centro Privado de Rehabilitación Integral San Benito', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Neuroability', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('INSERIR', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Centro de Rehabilitación Rehabilitando', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Centro Médico AIRE Jesús María', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Centro Privado de Rehab. e Integración Escolar Wernicke', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('CE.IN', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Instituto de Rehabilitación del Lisiado Córdoba', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('RAÍCES Centro Interdisciplinario de Rehabilitación', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Elphis Centro de Rehabilitación Integral', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('San Camilo de Lellis', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Centro de Rehabilitación Neurológica Logros', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Fundación ILIKA', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  ('Centro de Rehabilitación Fundación Kamay', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)))
on conflict (nombre) do nothing;
