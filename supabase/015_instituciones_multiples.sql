-- =====================================================================
-- Plataforma EpE — Un profesional puede pertenecer a varias
-- instituciones a la vez (015)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de 014.
--
-- Qué resuelve: hasta ahora profiles.institucion_id era un campo único
-- (un profesional, una institución). Gon pidió que un profesional pueda
-- estar verificado en varias instituciones al mismo tiempo — necesario
-- para la Parte B de "Admin de institución" (un admin puede sumar
-- profesionales por correo, compartir una colección con MÁS de una
-- institución, etc.).
--
-- Qué cambia:
--  1) profile_instituciones: tabla nueva, una fila por (profesional,
--     institución) — reemplaza profiles.institucion_id/
--     institucion_pendiente/institucion_verificada*.
--  2) caso_shares suma institucion_id: antes "compartido con mi
--     institución" no necesitaba decir cuál (solo había una posible).
--     Ahora cada share institucional apunta a una institución puntual.
--  3) puede_ver_caso() compara profile_instituciones de ambos lados en
--     vez de profiles.institucion_id.
--  4) verificar_institucion()/verificar_institucion_manual()/
--     listar_instituciones_staff()/panel_staff_colecciones()/
--     directorio_pendientes_staff() reescritas sobre la tabla nueva.
--  5) El trigger de 014 (limpiar_shares_institucion_al_cambiar, sobre
--     profiles.institucion_id) se retira: ya no tiene sentido porque
--     profiles ya no tiene ese campo. Con el modelo nuevo, la ÚNICA
--     forma de dejar de pertenecer a una institución es que se borre tu
--     fila de profile_instituciones — y eso solo lo hacen las funciones
--     de 016 (nunca un update directo del cliente), así que la limpieza
--     de shares queda escrita UNA vez ahí, no repartida en un trigger
--     aparte. No hace falta un trigger de respaldo: profile_instituciones
--     no tiene policy de update ni de delete para "authenticated" (ver
--     más abajo), así que no hay ningún camino de cliente que lo
--     esquive.
--
-- Al 03/10/2026 solo hay perfiles de prueba — por eso esta migración
-- migra los datos existentes y pisa el esquema directo, como ya hizo
-- 010.
--
-- ANTES de correrlo: export (CSV) de profiles y caso_shares, por las
-- dudas — ver nota de seguridad en el chat.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) profile_instituciones
-- ---------------------------------------------------------------------
create table public.profile_instituciones (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users (id) on delete cascade,
  institucion_id uuid references public.instituciones (id),
  institucion_pendiente text,
  verificada boolean not null default false,
  verificada_en timestamptz,
  verificada_metodo text,
  -- Freeze puntual de ESTA pertenencia (ver 016): un admin que se va de
  -- ESTA institución, mientras no haya reemplazo, no puede agregar ni
  -- modificar colecciones compartidas con ESTA institución — pero sigue
  -- operando normal en cualquier OTRA institución a la que pertenezca.
  -- Por eso el flag vive acá (por fila), no en profiles (global).
  saliendo boolean not null default false,
  creado_en timestamptz not null default now()
);

-- Una fila por institución real por profesional (no se puede "elegir"
-- la misma institución dos veces). Las filas "pendientes de alta"
-- (institucion_id null) se limitan a una por profesional — mismo
-- comportamiento que tenía profiles.institucion_pendiente antes.
create unique index profile_instituciones_unica_institucion
  on public.profile_instituciones (profile_id, institucion_id)
  where institucion_id is not null;

create unique index profile_instituciones_unica_pendiente
  on public.profile_instituciones (profile_id)
  where institucion_id is null;

create index profile_instituciones_institucion_idx
  on public.profile_instituciones (institucion_id);

alter table public.profile_instituciones enable row level security;

-- Select: cada quien ve sus propias filas. (El staff y las funciones de
-- admin de institución leen esta tabla vía funciones security definer,
-- no con un select directo — no hace falta una policy para ellos acá.)
create policy "profile_instituciones: select propio"
  on public.profile_instituciones for select
  to authenticated
  using (profile_id = auth.uid());

-- Insert: elegir una institución (con o sin código) o avisar una
-- pendiente de alta — sigue siendo una acción directa del cliente,
-- como antes. verificada/verificada_en/verificada_metodo/saliendo NO
-- están en la lista de columnas que puede escribir "authenticated" (ver
-- el grant de columnas más abajo) y además el trigger de abajo los
-- vuelve a su default si de alguna forma llegaran en el insert.
create policy "profile_instituciones: insert propio"
  on public.profile_instituciones for insert
  to authenticated
  with check (profile_id = auth.uid());

-- Una fila "pendiente de alta" (institucion_id null) no tiene ninguna
-- colección ni rol de admin asociado — retractarla no tiene ningún
-- efecto que una función necesite controlar, así que el cliente la
-- puede borrar directo. Una fila con institución REAL nunca se borra
-- así: toda baja de una institución real pasa por una función security
-- definer (ver 016), nunca un delete directo del cliente, para que la
-- lógica de "a quién se transfieren las colecciones al salir" no se
-- pueda esquivar escribiendo directo a la tabla. Tampoco hay policy de
-- UPDATE para authenticated — ni para esto ni para verificar nada.
create policy "profile_instituciones: delete pendiente propio"
  on public.profile_instituciones for delete
  to authenticated
  using (profile_id = auth.uid() and institucion_id is null);

revoke all on public.profile_instituciones from anon, authenticated;
grant select on public.profile_instituciones to authenticated;
grant insert (profile_id, institucion_id, institucion_pendiente) on public.profile_instituciones to authenticated;
grant delete on public.profile_instituciones to authenticated;

-- Mismo patrón que profiles_proteger_verificacion (013): si el cambio
-- viene de un cliente (authenticated/anon), nunca puede dejar
-- verificada=true ni tocar saliendo — eso solo lo hacen las funciones
-- (que corren como dueñas de la función, no como "authenticated").
create or replace function public.profile_instituciones_proteger_verificacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.verificada := false;
    new.verificada_en := null;
    new.verificada_metodo := null;
    new.saliendo := false;
  end if;
  return new;
end;
$$;

create trigger profile_instituciones_proteger_verificacion
  before insert or update on public.profile_instituciones
  for each row execute function public.profile_instituciones_proteger_verificacion();

-- ---------------------------------------------------------------------
-- 2) Migrar los datos existentes de profiles a profile_instituciones
-- ---------------------------------------------------------------------
insert into public.profile_instituciones
  (profile_id, institucion_id, institucion_pendiente, verificada, verificada_en, verificada_metodo)
select id, institucion_id, nullif(trim(institucion_pendiente), ''), institucion_verificada, institucion_verificada_en, institucion_verificada_metodo
from public.profiles
where institucion_id is not null or nullif(trim(institucion_pendiente), '') is not null;

alter table public.profiles drop column if exists institucion_id;
alter table public.profiles drop column if exists institucion_pendiente;
alter table public.profiles drop column if exists institucion_verificada;
alter table public.profiles drop column if exists institucion_verificada_en;
alter table public.profiles drop column if exists institucion_verificada_metodo;

-- El trigger/función de 014 apuntaba a profiles.institucion_id, que ya
-- no existe — se retira (ver nota arriba sobre por qué no hace falta
-- reemplazarlo por un trigger equivalente acá).
drop trigger if exists profiles_limpiar_shares_institucion on public.profiles;
drop function if exists public.limpiar_shares_institucion_al_cambiar();

-- ---------------------------------------------------------------------
-- 3) caso_shares: institucion_id puntual para tipo 'institucion'
-- ---------------------------------------------------------------------
alter table public.caso_shares add column if not exists institucion_id uuid references public.instituciones (id);

alter table public.caso_shares
  add constraint caso_shares_institucion_id_coherente
  check ((tipo = 'institucion') = (institucion_id is not null));

-- Backfill de los shares existentes (hoy, con 1 institución por
-- profesional): a la institución verificada del dueño, si tiene una
-- sola. Si no tiene ninguna verificada (quedó huérfano), el share
-- queda con institucion_id null — pero la constraint de arriba exige
-- que todo share tipo 'institucion' tenga institucion_id, así que un
-- share que no se pueda resolver se borra en vez de dejarlo inválido
-- (en la práctica, al 03/10/2026, no debería haber ninguno en ese
-- caso — son 2 perfiles de prueba).
with duenos_una_institucion as (
  -- uuid no tiene min()/max() agregado en Postgres (sí tiene < y >, pero
  -- no agregados definidos) — como having count(*) = 1 garantiza una
  -- sola fila por profile_id, alcanza con tomar el primer elemento de
  -- array_agg (que sí acepta cualquier tipo) en vez de min().
  select profile_id, (array_agg(institucion_id))[1] as institucion_id
  from public.profile_instituciones
  where verificada
  group by profile_id
  having count(*) = 1
)
update public.caso_shares s
set institucion_id = d.institucion_id
from public.casos c
join duenos_una_institucion d on d.profile_id = c.dueno_id
where s.caso_id = c.id
  and s.tipo = 'institucion'
  and s.institucion_id is null;

delete from public.caso_shares where tipo = 'institucion' and institucion_id is null;

-- ---------------------------------------------------------------------
-- 4) puede_ver_caso(): institución puntual, verificada de ambos lados
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
                  from public.profile_instituciones dueno
                  join public.profile_instituciones yo
                    on yo.institucion_id = dueno.institucion_id
                   and yo.profile_id = auth.uid()
                   and yo.verificada
                  where dueno.profile_id = c.dueno_id
                    and dueno.institucion_id = s.institucion_id
                    and dueno.verificada
                )
              )
            )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------
-- 5) Verificación por código / manual: ahora upsert sobre
--    profile_instituciones en vez de update de profiles.
-- ---------------------------------------------------------------------
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
    insert into public.profile_instituciones
      (profile_id, institucion_id, institucion_pendiente, verificada, verificada_en, verificada_metodo)
    values (auth.uid(), p_institucion_id, null, true, now(), 'codigo')
    on conflict (profile_id, institucion_id) where institucion_id is not null
    do update set verificada = true, verificada_en = now(), verificada_metodo = 'codigo';

    delete from public.intentos_codigo where user_id = auth.uid();
  end if;

  return coalesce(v_ok, false);
end;
$$;

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

  insert into public.profile_instituciones
    (profile_id, institucion_id, institucion_pendiente, verificada, verificada_en, verificada_metodo)
  values (p_profile_id, p_institucion_id, null, true, now(), 'manual_staff')
  on conflict (profile_id, institucion_id) where institucion_id is not null
  do update set verificada = true, verificada_en = now(), verificada_metodo = 'manual_staff';

  -- Si la verificación resuelve una fila "pendiente de alta" (sin
  -- institucion_id), se borra — ya quedó resuelta con una institución
  -- real.
  delete from public.profile_instituciones
  where profile_id = p_profile_id
    and institucion_id is null
    and institucion_pendiente is not null;
end;
$$;

-- "Elegir sin verificar"/"institución pendiente" ya no son funciones
-- security definer (antes tampoco lo eran del todo — eran updates
-- directos desde store.js): ahora son inserts directos del cliente a
-- profile_instituciones, permitidos por la policy de insert de arriba.
-- No hace falta una función nueva para esto.

-- ---------------------------------------------------------------------
-- 6) Lecturas de staff reescritas sobre profile_instituciones
-- ---------------------------------------------------------------------

-- listar_instituciones_staff() NO se toca acá: en 010 ya devuelve (id,
-- nombre, codigo_acceso, creada_en) y nada de esto cambia en 015 (no
-- referencia profile_instituciones). La versión con
-- cantidad_admins_activos la agrega 016, una vez que existe la tabla
-- institucion_admins de la que depende esa columna — ponerla acá
-- rompería 015 corrido solo, antes de que esa tabla exista.

-- Nota: devuelve una fila por VÍNCULO sin resolver, no una fila por
-- profesional — con varias instituciones por persona, alguien puede
-- tener más de una fila acá (una por cada institución pendiente o sin
-- verificar). pendientes.js ya itera por fila, así que no hace falta
-- cambiar nada del lado del cliente.
create or replace function public.directorio_pendientes_staff()
returns table (
  id uuid, -- profile_id, mismo nombre que devolvía antes (pendientes.js lo usa como perfil.id)
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
  select pr.id, pr.nombre, pr.email, p.institucion_id, p.institucion_pendiente, p.verificada
  from public.profile_instituciones p
  join public.profiles pr on pr.id = p.profile_id
  where exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
    and (
      (p.institucion_pendiente is not null and trim(p.institucion_pendiente) <> '')
      or (p.institucion_id is not null and p.verificada = false)
    );
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
stable
security definer
set search_path = public
as $$
  -- Un profesional puede tener varias instituciones: se trae la
  -- primera que encuentre (verificada, si tiene alguna) solo para
  -- agrupar visualmente el árbol del panel — no determina a qué
  -- institución pertenece la colección en sí (eso lo decide el share
  -- compartido con "dismascapacidad", no con una institución puntual).
  select
    c.id, c.nombre, c.actualizado_en,
    p.id, p.nombre, p.email,
    pi.institucion_id, i.nombre, pi.institucion_pendiente, pi.verificada
  from public.casos c
  join public.caso_shares s on s.caso_id = c.id and s.tipo = 'dismascapacidad'
  join public.profiles p on p.id = c.dueno_id
  left join lateral (
    select * from public.profile_instituciones x
    where x.profile_id = p.id
    order by x.verificada desc, x.creado_en asc
    limit 1
  ) pi on true
  left join public.instituciones i on i.id = pi.institucion_id
  where exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
  order by coalesce(i.nombre, 'zzz_sin_institucion'), p.nombre, c.actualizado_en desc;
$$;

grant execute on function public.listar_instituciones_staff() to authenticated;
grant execute on function public.directorio_pendientes_staff() to authenticated;
grant execute on function public.panel_staff_colecciones() to authenticated;
revoke execute on function public.listar_instituciones_staff() from public, anon;
revoke execute on function public.directorio_pendientes_staff() from public, anon;
revoke execute on function public.panel_staff_colecciones() from public, anon;

-- ---------------------------------------------------------------------
-- 7) RLS lista para el freeze de "Admin de institución" (016)
-- profile_instituciones.saliendo ya existe en esta migración (default
-- false, y 016 es quien lo va a poner en true) — se actualizan acá las
-- policies de casos y sus 4 tablas hijas para respetarlo, así 016 no
-- tiene que volver a tocar estas policies.
--
-- caso_institucion_congelada(): true si ESTE caso tiene un share
-- "institución" hacia una institución de la que su dueño se está yendo
-- (saliendo=true en su fila de profile_instituciones para esa
-- institución puntual) — nunca por otra institución a la que el dueño
-- siga perteneciendo normalmente.
-- ---------------------------------------------------------------------
create or replace function public.caso_institucion_congelada(p_caso_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.caso_shares s
    join public.casos c on c.id = s.caso_id
    join public.profile_instituciones pi
      on pi.profile_id = c.dueno_id and pi.institucion_id = s.institucion_id
    where s.caso_id = p_caso_id
      and s.tipo = 'institucion'
      and pi.saliendo
  );
$$;

revoke execute on function public.caso_institucion_congelada(uuid) from public, anon;
grant execute on function public.caso_institucion_congelada(uuid) to authenticated;

-- casos: no se puede modificar ni borrar mientras tenga un share
-- institucional congelado (sí se puede seguir creando casos nuevos sin
-- relación con ninguna institución, y sí se pueden modificar/borrar
-- casos compartidos con OTRA institución a la que el dueño siga
-- perteneciendo normalmente).
drop policy if exists "casos: update propio" on public.casos;
create policy "casos: update propio"
  on public.casos for update
  using (auth.uid() = dueno_id and not public.caso_institucion_congelada(id))
  with check (auth.uid() = dueno_id);

drop policy if exists "casos: delete propio" on public.casos;
create policy "casos: delete propio"
  on public.casos for delete
  using (auth.uid() = dueno_id and not public.caso_institucion_congelada(id));

-- Tablas hijas: no se puede agregar contenido nuevo a un caso congelado.
drop policy if exists "caso_actividades: insert via caso" on public.caso_actividades;
create policy "caso_actividades: insert via caso"
  on public.caso_actividades for insert
  with check (
    exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid())
    and not public.caso_institucion_congelada(caso_id)
  );

drop policy if exists "caso_apps_terceros: insert via caso" on public.caso_apps_terceros;
create policy "caso_apps_terceros: insert via caso"
  on public.caso_apps_terceros for insert
  with check (
    exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid())
    and not public.caso_institucion_congelada(caso_id)
  );

drop policy if exists "caso_entradas: insert via caso" on public.caso_entradas;
create policy "caso_entradas: insert via caso"
  on public.caso_entradas for insert
  with check (
    exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid())
    and not public.caso_institucion_congelada(caso_id)
  );

-- caso_shares: además de "no agregar nada a un caso ya congelado", una
-- institución puntual solo se puede compartir si el dueño está
-- realmente verificado ahí y no se está yendo de ESA institución (sí
-- puede, mientras tanto, compartir con OTRA institución suya, o con un
-- colega, o con dismascapacidad).
drop policy if exists "caso_shares: insert via caso" on public.caso_shares;
create policy "caso_shares: insert via caso"
  on public.caso_shares for insert
  with check (
    exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid())
    and not public.caso_institucion_congelada(caso_id)
    and (
      tipo <> 'institucion'
      or exists (
        select 1 from public.profile_instituciones pi
        where pi.profile_id = auth.uid()
          and pi.institucion_id = caso_shares.institucion_id -- NEW.institucion_id (fila que se inserta)
          and pi.verificada
          and not pi.saliendo
      )
    )
  );

-- No se puede desactivar justo el share de la institución de la que el
-- dueño se está yendo (para no perder la continuidad mientras se
-- resuelve el reemplazo) — sí se puede sacar cualquier otro share,
-- incluida la institución de otro vínculo no congelado.
drop policy if exists "caso_shares: delete via caso" on public.caso_shares;
create policy "caso_shares: delete via caso"
  on public.caso_shares for delete
  using (
    exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid())
    and not (
      tipo = 'institucion'
      and exists (
        select 1 from public.profile_instituciones pi
        where pi.profile_id = auth.uid() and pi.institucion_id = caso_shares.institucion_id and pi.saliendo
      )
    )
  );

commit;

-- =====================================================================
-- VERIFICACIÓN (solo lectura, correr después, por separado)
-- =====================================================================
-- a) Cada profesional de prueba conserva su institución:
--    select * from public.profile_instituciones order by profile_id;
-- b) profiles ya no tiene las columnas viejas:
--    select column_name from information_schema.columns
--    where table_schema='public' and table_name='profiles';
-- c) Ningún caso_shares tipo institución quedó sin institucion_id:
--    select count(*) from public.caso_shares where tipo='institucion' and institucion_id is null;
--    (tiene que dar 0 — la constraint ya no lo permitiría de todas formas)

-- =====================================================================
-- ROLLBACK (requiere el CSV de respaldo de profiles/caso_shares — el
-- drop de columnas de profiles no se puede deshacer solo con SQL)
-- =====================================================================
-- Ver backup tomado antes de correr esta migración.
