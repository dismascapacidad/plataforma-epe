-- =====================================================================
-- Plataforma EpE — Admin de institución (016)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de 015.
--
-- Implementa el perfil "Admin de institución" tal como quedó
-- especificado en el proyecto (ver doc "Admin de institución - diseño
-- detallado y plan"):
--  - Un profesional verificado en una institución puede pedir ser su
--    administrador; dis+capacidad lo aprueba desde el panel después de
--    confirmarlo por fuera de la plataforma (mensaje + teléfono).
--  - Máximo 2 administradores activos por institución.
--  - Un admin puede: quitar de la institución a un profesional
--    verificado que no sea admin (pasa a ser dueño de las colecciones
--    de esa persona que estaban compartidas con la institución — solo
--    esas, no todo lo que posee), y agregar profesionales por correo
--    (quedan verificados directo).
--  - Un admin no puede remover a otro admin — eso es solo de
--    dis+capacidad (quitar_admin_institucion).
--  - Si el único admin activo se va de la institución, tiene que
--    sugerir un reemplazo (salvo que no haya ningún candidato
--    elegible) y queda "congelado": no pierde su vínculo con la
--    institución (para no perder las colecciones de las que es
--    dueño) pero no puede agregar ni modificar nada compartido con
--    ELLA mientras tanto (ver 015, caso_institucion_congelada). Si ya
--    hay otro admin activo, se puede ir directo, sin congelarse.
--  - Salir de una institución (por cualquier camino: voluntario,
--    removido por un admin, o admin que finaliza su salida) SIEMPRE
--    hace lo mismo (ver _institucion_salir): se pierden TODAS las
--    colecciones compartidas con esa institución — las propias pasan
--    a ser del admin activo correspondiente (o quedan como estaban,
--    sin compartir, si no hay ningún admin); las de terceros
--    simplemente dejan de ser visibles (ya lo garantiza
--    puede_ver_caso al no estar más vinculado a la institución).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Tablas — mismo criterio que staff_dismascapacidad: RLS activado,
--    SIN policies para authenticated/anon. Todo acceso pasa por las
--    funciones security definer de más abajo.
-- ---------------------------------------------------------------------

create table public.institucion_admins (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.instituciones (id),
  profile_id uuid not null references auth.users (id) on delete cascade,
  -- activo: administra con normalidad.
  -- congelado: se está yendo de la institución, ya sugirió reemplazo,
  --   espera que dis+capacidad lo apruebe.
  -- revocado: dis+capacidad le sacó el rol (sigue en la institución
  --   como profesional común).
  -- retirado: se fue de la institución (con o sin haber pasado por
  --   congelado).
  estado text not null default 'activo' check (estado in ('activo', 'congelado', 'revocado', 'retirado')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (institucion_id, profile_id)
);

create index institucion_admins_institucion_idx on public.institucion_admins (institucion_id, estado);

alter table public.institucion_admins enable row level security;
revoke all on public.institucion_admins from anon, authenticated;

create table public.institucion_admin_solicitudes (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.instituciones (id),
  profile_id uuid not null references auth.users (id) on delete cascade, -- quien pasaría a ser admin
  origen text not null check (origen in ('autosolicitud', 'sugerencia')),
  sugerido_por uuid references auth.users (id), -- admin saliente, si origen='sugerencia'
  mensaje text not null default '',
  telefono text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  motivo_rechazo text,
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid references auth.users (id)
);

create index institucion_admin_solicitudes_estado_idx on public.institucion_admin_solicitudes (estado);

alter table public.institucion_admin_solicitudes enable row level security;
revoke all on public.institucion_admin_solicitudes from anon, authenticated;

create table public.institucion_remociones (
  id uuid primary key default gen_random_uuid(),
  institucion_id uuid not null references public.instituciones (id),
  actor_id uuid references auth.users (id), -- quién quedó como dueño de las colecciones (null si nadie)
  profesional_id uuid not null references auth.users (id),
  tipo text not null check (tipo in ('remocion_por_admin', 'salida_voluntaria', 'salida_admin_finalizada')),
  creado_en timestamptz not null default now()
);

alter table public.institucion_remociones enable row level security;
revoke all on public.institucion_remociones from anon, authenticated;

-- listar_instituciones_staff() suma acá cantidad_admins_activos — no se
-- pudo definir así en 015 porque esa migración corre ANTES de que
-- exista institucion_admins (esta tabla). Postgres tampoco deja
-- cambiarle la forma de las columnas a una función existente con
-- "create or replace" (la de 010/015 devolvía 4 columnas, esta
-- devuelve 5), así que hay que borrarla primero.
drop function if exists public.listar_instituciones_staff();

create function public.listar_instituciones_staff()
returns table (id uuid, nombre text, codigo_acceso text, creada_en timestamptz, cantidad_admins_activos bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id, i.nombre, i.codigo_acceso, i.creada_en,
    coalesce((select count(*) from public.institucion_admins a where a.institucion_id = i.id and a.estado = 'activo'), 0)
  from public.instituciones i
  where exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
  order by i.nombre;
$$;

revoke execute on function public.listar_instituciones_staff() from public, anon;
grant execute on function public.listar_instituciones_staff() to authenticated;

-- ---------------------------------------------------------------------
-- 2) _institucion_salir(): el único lugar donde se borra un vínculo
--    con una institución — lo usan dejar_institucion,
--    institucion_admin_quitar_profesional, y aprobar_admin_institucion
--    (para finalizar la salida de un admin congelado). Nunca se llama
--    directo desde el cliente.
-- ---------------------------------------------------------------------
create or replace function public._institucion_salir(
  p_profile_id uuid,
  p_institucion_id uuid,
  p_actor_id uuid, -- quién se queda como dueño de lo compartido con la institución (null = nadie)
  p_tipo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_id is not null then
    update public.casos c
    set dueno_id = p_actor_id
    where c.dueno_id = p_profile_id
      and exists (
        select 1 from public.caso_shares s
        where s.caso_id = c.id and s.tipo = 'institucion' and s.institucion_id = p_institucion_id
      );
  else
    -- Nadie a quien transferir: se desactiva el share (no queda
    -- "huérfano" para que no se reactive solo si la persona vuelve a
    -- verificarse en la misma institución más adelante — ver 014).
    delete from public.caso_shares s
    using public.casos c
    where s.caso_id = c.id
      and c.dueno_id = p_profile_id
      and s.tipo = 'institucion'
      and s.institucion_id = p_institucion_id;
  end if;

  delete from public.profile_instituciones
  where profile_id = p_profile_id and institucion_id = p_institucion_id;

  insert into public.institucion_remociones (institucion_id, actor_id, profesional_id, tipo)
  values (p_institucion_id, p_actor_id, p_profile_id, p_tipo);
end;
$$;

revoke execute on function public._institucion_salir(uuid, uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Autoservicio del profesional
-- ---------------------------------------------------------------------

create or replace function public.solicitar_admin_institucion(p_institucion_id uuid, p_mensaje text, p_telefono text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_telefono text;
begin
  if v_yo is null then
    raise exception 'Hace falta iniciar sesión.';
  end if;

  if not exists (
    select 1 from public.profile_instituciones
    where profile_id = v_yo and institucion_id = p_institucion_id and verificada
  ) then
    raise exception 'Tenés que estar verificado en esta institución para pedir ser su administrador.';
  end if;

  if exists (
    select 1 from public.institucion_admins
    where institucion_id = p_institucion_id and profile_id = v_yo and estado in ('activo', 'congelado')
  ) then
    raise exception 'Ya sos administrador de esta institución.';
  end if;

  if exists (
    select 1 from public.institucion_admin_solicitudes
    where institucion_id = p_institucion_id and profile_id = v_yo and origen = 'autosolicitud' and estado = 'pendiente'
  ) then
    raise exception 'Ya tenés una solicitud pendiente para esta institución.';
  end if;

  v_telefono := nullif(trim(coalesce(p_telefono, '')), '');
  if v_telefono is null then
    select nullif(trim(coalesce(telefono, '')), '') into v_telefono from public.profiles where id = v_yo;
  end if;
  if v_telefono is null then
    raise exception 'Hace falta un teléfono de contacto para esta solicitud.';
  end if;

  insert into public.institucion_admin_solicitudes
    (institucion_id, profile_id, origen, mensaje, telefono, estado)
  values (p_institucion_id, v_yo, 'autosolicitud', coalesce(trim(p_mensaje), ''), v_telefono, 'pendiente');
end;
$$;

-- Reemplaza por completo a la función del mismo nombre de store.js (que
-- hasta ahora hacía un update directo de profiles) — ver 015 para por
-- qué ya no existe ese camino. Pide institución puntual porque ahora
-- puede haber varias.
create or replace function public.dejar_institucion(p_institucion_id uuid, p_candidato_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_mi_estado text;
  v_hay_otro_admin boolean;
  v_admin_destino uuid;
  v_hay_candidatos boolean;
begin
  if v_yo is null then
    raise exception 'Hace falta iniciar sesión.';
  end if;

  if not exists (select 1 from public.profile_instituciones where profile_id = v_yo and institucion_id = p_institucion_id) then
    raise exception 'No pertenecés a esa institución.';
  end if;

  select estado into v_mi_estado
  from public.institucion_admins
  where institucion_id = p_institucion_id and profile_id = v_yo and estado in ('activo', 'congelado');

  if v_mi_estado = 'congelado' then
    -- Ya había pedido irme y estoy esperando que se apruebe un
    -- reemplazo. Si dis+capacidad rechazó al candidato sugerido, esto
    -- deja sugerir otro; si ya hay uno pendiente de revisión, no se
    -- permite duplicarlo.
    if exists (
      select 1 from public.institucion_admin_solicitudes
      where institucion_id = p_institucion_id and sugerido_por = v_yo and origen = 'sugerencia' and estado = 'pendiente'
    ) then
      raise exception 'Ya hay un reemplazo sugerido esperando la aprobación de dis+capacidad.';
    end if;

    if p_candidato_id is null then
      raise exception 'Tenés que sugerir a quién te va a reemplazar.';
    end if;

    if not exists (
      select 1 from public.profile_instituciones
      where profile_id = p_candidato_id and institucion_id = p_institucion_id and verificada
    ) then
      raise exception 'El profesional elegido no está verificado en esta institución.';
    end if;

    if exists (
      select 1 from public.institucion_admins
      where institucion_id = p_institucion_id and profile_id = p_candidato_id and estado in ('activo', 'congelado')
    ) then
      raise exception 'Ese profesional ya es administrador de esta institución.';
    end if;

    insert into public.institucion_admin_solicitudes
      (institucion_id, profile_id, origen, sugerido_por, mensaje, telefono, estado)
    values (p_institucion_id, p_candidato_id, 'sugerencia', v_yo, '', null, 'pendiente');
    return;
  end if;

  if v_mi_estado is distinct from 'activo' then
    -- Profesional común (o admin ya revocado/retirado): salida
    -- directa. El admin activo más antiguo (si hay alguno) se queda
    -- como dueño de lo que tenía compartido con la institución.
    select profile_id into v_admin_destino
    from public.institucion_admins
    where institucion_id = p_institucion_id and estado = 'activo'
    order by creado_en asc
    limit 1;

    perform public._institucion_salir(v_yo, p_institucion_id, v_admin_destino, 'salida_voluntaria');
    return;
  end if;

  -- Soy admin activo de esta institución.
  select exists (
    select 1 from public.institucion_admins
    where institucion_id = p_institucion_id and estado = 'activo' and profile_id <> v_yo
  ) into v_hay_otro_admin;

  if v_hay_otro_admin then
    -- Ya queda otro admin activo: me puedo ir directo, sin sugerir
    -- reemplazo ni congelarme.
    select profile_id into v_admin_destino
    from public.institucion_admins
    where institucion_id = p_institucion_id and estado = 'activo' and profile_id <> v_yo
    order by creado_en asc
    limit 1;

    perform public._institucion_salir(v_yo, p_institucion_id, v_admin_destino, 'salida_voluntaria');
    update public.institucion_admins set estado = 'retirado', actualizado_en = now()
    where institucion_id = p_institucion_id and profile_id = v_yo;
    return;
  end if;

  -- Soy el ÚNICO admin activo.
  select exists (
    select 1
    from public.profile_instituciones pi
    where pi.institucion_id = p_institucion_id
      and pi.verificada
      and pi.profile_id <> v_yo
      and not exists (
        select 1 from public.institucion_admins a
        where a.institucion_id = p_institucion_id and a.profile_id = pi.profile_id and a.estado in ('activo', 'congelado')
      )
  ) into v_hay_candidatos;

  if not v_hay_candidatos then
    -- Nadie a quien sugerir: me voy directo, sin transferencia posible.
    perform public._institucion_salir(v_yo, p_institucion_id, null, 'salida_voluntaria');
    update public.institucion_admins set estado = 'retirado', actualizado_en = now()
    where institucion_id = p_institucion_id and profile_id = v_yo;
    return;
  end if;

  if p_candidato_id is null then
    raise exception 'Sos el único administrador activo de esta institución: tenés que sugerir quién te va a reemplazar antes de irte.';
  end if;

  if not exists (
    select 1 from public.profile_instituciones
    where profile_id = p_candidato_id and institucion_id = p_institucion_id and verificada
  ) then
    raise exception 'El profesional elegido no está verificado en esta institución.';
  end if;

  if exists (
    select 1 from public.institucion_admins
    where institucion_id = p_institucion_id and profile_id = p_candidato_id and estado in ('activo', 'congelado')
  ) then
    raise exception 'Ese profesional ya es administrador de esta institución.';
  end if;

  insert into public.institucion_admin_solicitudes
    (institucion_id, profile_id, origen, sugerido_por, mensaje, telefono, estado)
  values (p_institucion_id, p_candidato_id, 'sugerencia', v_yo, '', null, 'pendiente');

  update public.profile_instituciones set saliendo = true
  where profile_id = v_yo and institucion_id = p_institucion_id;

  update public.institucion_admins set estado = 'congelado', actualizado_en = now()
  where institucion_id = p_institucion_id and profile_id = v_yo;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Acciones de un admin activo sobre su institución
-- ---------------------------------------------------------------------

create or replace function public.institucion_admin_quitar_profesional(p_institucion_id uuid, p_profesional_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
begin
  if not exists (
    select 1 from public.institucion_admins
    where institucion_id = p_institucion_id and profile_id = v_yo and estado = 'activo'
  ) then
    raise exception 'Solo un administrador activo de la institución puede hacer esto.';
  end if;

  if p_profesional_id = v_yo then
    raise exception 'No podés removerte a vos mismo — usá "Dejar la institución" desde tu perfil.';
  end if;

  if not exists (
    select 1 from public.profile_instituciones
    where profile_id = p_profesional_id and institucion_id = p_institucion_id and verificada
  ) then
    raise exception 'Ese profesional no es un miembro verificado de esta institución.';
  end if;

  if exists (
    select 1 from public.institucion_admins
    where institucion_id = p_institucion_id and profile_id = p_profesional_id and estado in ('activo', 'congelado')
  ) then
    raise exception 'No se puede remover así a otro administrador — eso solo lo puede hacer dis+capacidad.';
  end if;

  perform public._institucion_salir(p_profesional_id, p_institucion_id, v_yo, 'remocion_por_admin');
end;
$$;

create or replace function public.institucion_admin_buscar_profesional(p_institucion_id uuid, p_email text)
returns table (profile_id uuid, nombre text, profesion text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.institucion_admins
    where institucion_id = p_institucion_id and profile_id = auth.uid() and estado = 'activo'
  ) then
    raise exception 'Solo un administrador activo de la institución puede hacer esto.';
  end if;

  return query
  select p.id, p.nombre, p.profesion
  from public.profiles p
  where lower(p.email) = lower(trim(p_email));
end;
$$;

create or replace function public.institucion_admin_agregar_profesional(p_institucion_id uuid, p_profesional_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.institucion_admins
    where institucion_id = p_institucion_id and profile_id = auth.uid() and estado = 'activo'
  ) then
    raise exception 'Solo un administrador activo de la institución puede hacer esto.';
  end if;

  insert into public.profile_instituciones
    (profile_id, institucion_id, institucion_pendiente, verificada, verificada_en, verificada_metodo)
  values (p_profesional_id, p_institucion_id, null, true, now(), 'agregado_admin_institucion')
  on conflict (profile_id, institucion_id) where institucion_id is not null
  do update set verificada = true, verificada_en = now(), verificada_metodo = 'agregado_admin_institucion', saliendo = false;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Staff de dis+capacidad
-- ---------------------------------------------------------------------

create or replace function public.aprobar_admin_institucion(p_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol record;
  v_cupo int;
begin
  if not exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid()) then
    raise exception 'Solo el staff de dis+capacidad puede hacer esto.';
  end if;

  select * into v_sol from public.institucion_admin_solicitudes where id = p_solicitud_id;
  if not found then
    raise exception 'La solicitud no existe.';
  end if;
  if v_sol.estado <> 'pendiente' then
    raise exception 'Esa solicitud ya fue resuelta.';
  end if;

  select count(*) into v_cupo
  from public.institucion_admins
  where institucion_id = v_sol.institucion_id and estado = 'activo';

  if v_cupo >= 2 then
    raise exception 'Esta institución ya tiene el máximo de 2 administradores activos.';
  end if;

  update public.institucion_admin_solicitudes
  set estado = 'aprobada', resuelto_en = now(), resuelto_por = auth.uid()
  where id = p_solicitud_id;

  insert into public.institucion_admins (institucion_id, profile_id, estado)
  values (v_sol.institucion_id, v_sol.profile_id, 'activo')
  on conflict (institucion_id, profile_id) do update set estado = 'activo', actualizado_en = now();

  if v_sol.origen = 'sugerencia' and v_sol.sugerido_por is not null then
    perform public._institucion_salir(v_sol.sugerido_por, v_sol.institucion_id, v_sol.profile_id, 'salida_admin_finalizada');
    update public.institucion_admins
    set estado = 'retirado', actualizado_en = now()
    where institucion_id = v_sol.institucion_id and profile_id = v_sol.sugerido_por;
  end if;
end;
$$;

create or replace function public.rechazar_admin_institucion(p_solicitud_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid()) then
    raise exception 'Solo el staff de dis+capacidad puede hacer esto.';
  end if;

  update public.institucion_admin_solicitudes
  set estado = 'rechazada', motivo_rechazo = coalesce(trim(p_motivo), ''), resuelto_en = now(), resuelto_por = auth.uid()
  where id = p_solicitud_id and estado = 'pendiente';

  if not found then
    raise exception 'La solicitud no existe o ya fue resuelta.';
  end if;
end;
$$;

create or replace function public.quitar_admin_institucion(p_institucion_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid()) then
    raise exception 'Solo el staff de dis+capacidad puede hacer esto.';
  end if;

  update public.institucion_admins
  set estado = 'revocado', actualizado_en = now()
  where institucion_id = p_institucion_id and profile_id = p_profile_id and estado in ('activo', 'congelado');

  if not found then
    raise exception 'Esa persona no es administradora activa de esta institución.';
  end if;

  -- Si estaba congelada (en proceso de irse), sacarle el rol cancela
  -- ese proceso: deja de estar "saliendo" y sigue como profesional
  -- común de la institución. La sugerencia de reemplazo que hubiera
  -- dejado pendiente, si la hay, se cierra (sin efecto: ya no hay
  -- nadie esperando ese reemplazo).
  update public.profile_instituciones
  set saliendo = false
  where profile_id = p_profile_id and institucion_id = p_institucion_id;

  update public.institucion_admin_solicitudes
  set estado = 'rechazada', motivo_rechazo = 'El administrador que lo sugirió dejó de serlo antes de resolverse.', resuelto_en = now(), resuelto_por = auth.uid()
  where institucion_id = p_institucion_id and sugerido_por = p_profile_id and origen = 'sugerencia' and estado = 'pendiente';
end;
$$;

-- Para el botón "Quitar admin" del panel de staff (pestaña
-- Instituciones) — lista quiénes son admins de una institución puntual,
-- incluidos los congelados (para que el staff vea el proceso de salida
-- en curso, aunque revocarles el rol ahí tenga el efecto adicional
-- descrito en quitar_admin_institucion).
create or replace function public.listar_admins_institucion_staff(p_institucion_id uuid)
returns table (profile_id uuid, nombre text, email text, estado text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.email, a.estado
  from public.institucion_admins a
  join public.profiles p on p.id = a.profile_id
  where exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
    and a.institucion_id = p_institucion_id
    and a.estado in ('activo', 'congelado')
  order by a.estado, p.nombre;
$$;

revoke execute on function public.listar_admins_institucion_staff(uuid) from public, anon;
grant execute on function public.listar_admins_institucion_staff(uuid) to authenticated;

create or replace function public.listar_solicitudes_admin_staff()
returns table (
  id uuid,
  institucion_id uuid,
  institucion_nombre text,
  profile_id uuid,
  profile_nombre text,
  profile_email text,
  origen text,
  sugerido_por uuid,
  sugerido_por_nombre text,
  mensaje text,
  telefono text,
  creado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.institucion_id, i.nombre,
    s.profile_id, p.nombre, p.email,
    s.origen, s.sugerido_por, sp.nombre,
    s.mensaje, s.telefono, s.creado_en
  from public.institucion_admin_solicitudes s
  join public.instituciones i on i.id = s.institucion_id
  join public.profiles p on p.id = s.profile_id
  left join public.profiles sp on sp.id = s.sugerido_por
  where exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
    and s.estado = 'pendiente'
  order by s.creado_en asc;
$$;

-- ---------------------------------------------------------------------
-- 6) Lecturas para el profesional
-- ---------------------------------------------------------------------

-- Reemplaza a los campos institución sueltos de getProfile(): ahora
-- devuelve una fila por institución a la que pertenezco, con mi estado
-- de admin ahí (si lo soy) y cuántos admins activos tiene en total (para
-- poder avisar "sos el único" en la UI).
create or replace function public.mis_instituciones()
returns table (
  institucion_id uuid,
  institucion_nombre text,
  institucion_pendiente text,
  verificada boolean,
  verificada_metodo text,
  saliendo boolean,
  admin_estado text,
  admins_activos bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pi.institucion_id, i.nombre, pi.institucion_pendiente, pi.verificada, pi.verificada_metodo, pi.saliendo,
    a.estado,
    (select count(*) from public.institucion_admins a2 where a2.institucion_id = pi.institucion_id and a2.estado = 'activo')
  from public.profile_instituciones pi
  left join public.instituciones i on i.id = pi.institucion_id
  left join public.institucion_admins a on a.institucion_id = pi.institucion_id and a.profile_id = pi.profile_id and a.estado in ('activo', 'congelado')
  where pi.profile_id = auth.uid()
  order by i.nombre;
$$;

create or replace function public.listar_colegas_institucion(p_institucion_id uuid)
returns table (profile_id uuid, nombre text, email text, profesion text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.email, p.profesion
  from public.profile_instituciones pi
  join public.profiles p on p.id = pi.profile_id
  where pi.institucion_id = p_institucion_id
    and pi.verificada
    and pi.profile_id <> auth.uid()
    and exists (
      select 1 from public.institucion_admins a
      where a.institucion_id = p_institucion_id and a.profile_id = auth.uid() and a.estado = 'activo'
    )
    and not exists (
      select 1 from public.institucion_admins a2
      where a2.institucion_id = p_institucion_id and a2.profile_id = pi.profile_id and a2.estado in ('activo', 'congelado')
    )
  order by p.nombre;
$$;

-- ---------------------------------------------------------------------
-- 7) Permisos de ejecución — mismo patrón que 013: nada ejecutable por
--    anon/PUBLIC, grant explícito a authenticated función por función.
--    _institucion_salir queda afuera a propósito (solo la llaman otras
--    funciones security definer, nunca el cliente).
-- ---------------------------------------------------------------------
revoke execute on function public.solicitar_admin_institucion(uuid, text, text)        from public, anon;
revoke execute on function public.dejar_institucion(uuid, uuid)                        from public, anon;
revoke execute on function public.institucion_admin_quitar_profesional(uuid, uuid)     from public, anon;
revoke execute on function public.institucion_admin_buscar_profesional(uuid, text)     from public, anon;
revoke execute on function public.institucion_admin_agregar_profesional(uuid, uuid)    from public, anon;
revoke execute on function public.aprobar_admin_institucion(uuid)                      from public, anon;
revoke execute on function public.rechazar_admin_institucion(uuid, text)               from public, anon;
revoke execute on function public.quitar_admin_institucion(uuid, uuid)                 from public, anon;
revoke execute on function public.listar_solicitudes_admin_staff()                     from public, anon;
revoke execute on function public.mis_instituciones()                                  from public, anon;
revoke execute on function public.listar_colegas_institucion(uuid)                     from public, anon;

grant execute on function public.solicitar_admin_institucion(uuid, text, text)        to authenticated;
grant execute on function public.dejar_institucion(uuid, uuid)                        to authenticated;
grant execute on function public.institucion_admin_quitar_profesional(uuid, uuid)     to authenticated;
grant execute on function public.institucion_admin_buscar_profesional(uuid, text)     to authenticated;
grant execute on function public.institucion_admin_agregar_profesional(uuid, uuid)    to authenticated;
grant execute on function public.aprobar_admin_institucion(uuid)                      to authenticated;
grant execute on function public.rechazar_admin_institucion(uuid, text)               to authenticated;
grant execute on function public.quitar_admin_institucion(uuid, uuid)                 to authenticated;
grant execute on function public.listar_solicitudes_admin_staff()                     to authenticated;
grant execute on function public.mis_instituciones()                                  to authenticated;
grant execute on function public.listar_colegas_institucion(uuid)                     to authenticated;

commit;

-- =====================================================================
-- VERIFICACIÓN (solo lectura, correr después, por separado)
-- =====================================================================
-- a) Ninguna función nueva ejecutable por anon/PUBLIC:
--    select routine_name, grantee from information_schema.routine_privileges
--    where routine_schema='public' and grantee in ('anon','PUBLIC')
--      and routine_name like '%institucion%';
-- b) Nunca más de 2 admins activos por institución:
--    select institucion_id, count(*) from public.institucion_admins
--    where estado='activo' group by institucion_id having count(*) > 2;
--    (tiene que devolver 0 filas)

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- begin;
-- drop function if exists public.listar_colegas_institucion(uuid);
-- drop function if exists public.mis_instituciones();
-- drop function if exists public.listar_solicitudes_admin_staff();
-- drop function if exists public.quitar_admin_institucion(uuid, uuid);
-- drop function if exists public.rechazar_admin_institucion(uuid, text);
-- drop function if exists public.aprobar_admin_institucion(uuid);
-- drop function if exists public.institucion_admin_agregar_profesional(uuid, uuid);
-- drop function if exists public.institucion_admin_buscar_profesional(uuid, text);
-- drop function if exists public.institucion_admin_quitar_profesional(uuid, uuid);
-- drop function if exists public.dejar_institucion(uuid, uuid);
-- drop function if exists public.solicitar_admin_institucion(uuid, text, text);
-- drop function if exists public._institucion_salir(uuid, uuid, uuid, text);
-- drop table if exists public.institucion_remociones;
-- drop table if exists public.institucion_admin_solicitudes;
-- drop table if exists public.institucion_admins;
-- commit;
