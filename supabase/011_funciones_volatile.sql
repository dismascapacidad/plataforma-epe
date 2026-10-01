-- 011_funciones_volatile.sql
--
-- Corrige un bug de permisos en las funciones de 010_instituciones_y_staff.sql:
-- estaban declaradas "stable", pero todas dependen de auth.uid() (el usuario
-- que hace el pedido, no un argumento de la función). Con el pooler de
-- conexiones de Supabase (PgBouncer en modo transacción), una función
-- "stable" puede hacer que Postgres reutilice el resultado calculado para
-- un usuario y se lo devuelva a otro en un pedido posterior — es el bug
-- documentado de Supabase/PostgREST: cualquier función que lea auth.uid()
-- tiene que ser "volatile" (el default, por eso simplemente se saca la
-- palabra "stable" de cada una). No cambia ninguna lógica, solo esto.
--
-- Esto corrigió un caso real: gonzalo.nanzer@gmail.com veía el botón del
-- panel de staff (soy_staff() le devolvía true) aunque la tabla
-- staff_dismascapacidad solo tiene a dismascapacidad@gmail.com. La misma
-- causa afecta a puede_ver_caso(), que es la que decide si alguien puede
-- ver una colección compartida de otra persona — es la más importante de
-- arreglar acá.
--
-- Correr en el SQL Editor de Supabase. create or replace: no hace falta
-- borrar nada antes.

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
                    and dueno.institucion_id = yo.institucion_id
                )
              )
            )
        )
      )
  );
$$;

create or replace function public.soy_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid());
$$;

create or replace function public.listar_instituciones_staff()
returns table (id uuid, nombre text, codigo_acceso text, creada_en timestamptz)
language sql
security definer
set search_path = public
as $$
  select i.id, i.nombre, i.codigo_acceso, i.creada_en
  from public.instituciones i
  where exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
  order by i.nombre;
$$;

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
