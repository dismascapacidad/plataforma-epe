-- =====================================================================
-- Plataforma EpE — Eliminar la propia cuenta (017)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de 016.
--
-- Qué resuelve: agrega un botón de "Eliminar cuenta" al perfil. Borra
-- directo la fila de auth.users del usuario autenticado — el mismo
-- patrón que recomienda la comunidad de Supabase para este caso (una
-- función security definer, sin necesidad de Edge Function ni de la
-- service_role key en el cliente: https://github.com/orgs/supabase/discussions/1066).
--
-- Qué cambia:
--  1) 4 columnas que señalan a auth.users SIN "on delete cascade" ni
--     "on delete set null" (quedaron así porque son de AUDITORÍA, no
--     de pertenencia) pasan a "on delete set null". Sin este cambio,
--     cualquiera que alguna vez haya aprobado/rechazado una solicitud
--     de admin (todo el staff), sugerido un reemplazo, o aparecido en
--     el historial de remociones, NO podría borrar su cuenta —
--     Postgres rechazaría el delete por la restricción de clave
--     foránea ("no action" es el comportamiento por defecto cuando no
--     se especifica ninguno). Con "set null" se conserva el resto del
--     registro (fecha, institución, tipo de evento) y solo se pierde el
--     "quién" de ESE registro puntual si esa persona se borra — no se
--     borra el registro entero, así que no se pierde el historial de
--     OTRA persona involucrada en el mismo evento.
--       - institucion_remociones.profesional_id / actor_id
--       - institucion_admin_solicitudes.sugerido_por / resuelto_por
--  2) eliminar_cuenta(): la función en sí. Nada más que
--     "delete from auth.users where id = auth.uid()" — todo lo demás
--     (profiles, casos y sus hijos, caso_shares, profile_instituciones,
--     institucion_admins, comentarios, etc.) ya tiene "on delete
--     cascade" desde que se crearon esas tablas, así que se borra solo.
--     Si la persona es la única admin activa de una institución, su
--     fila en institucion_admins se borra con el resto — igual que ya
--     pasa hoy cuando dis+capacidad le quita el rol a alguien (queda
--     "sin administrador confirmado", estado ya contemplado en el
--     panel de staff). No se exige sugerir reemplazo antes de borrar la
--     cuenta: forzar una sucesión le pondría un freno a alguien que se
--     quiere ir del todo de la plataforma.
--
-- NO verificado contra una instancia real de Supabase — en particular,
-- no se pudo confirmar desde este entorno que el rol "postgres" (el que
-- corre este script) tenga permiso de DELETE sobre auth.users. Es el
-- patrón que la comunidad de Supabase reporta que funciona out-of-the-box
-- en proyectos administrados (postgres hereda ese permiso), pero si al
-- correr esta migración o al probar el botón aparece un error de
-- permisos ahí, hace falta otorgarlo a mano una vez:
--   grant delete on auth.users to postgres;
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Las 4 columnas de auditoría pasan a "on delete set null"
-- ---------------------------------------------------------------------

-- profesional_id era "not null" — para poder poner null ahí hace falta
-- sacarle esa restricción primero (el resto de la fila se conserva).
alter table public.institucion_remociones
  alter column profesional_id drop not null;

-- Se busca el nombre real de cada constraint en vez de adivinarlo
-- (los nombres por defecto de Postgres son predecibles, pero no vale
-- la pena arriesgarse otra vez a un nombre que no coincida exacto).
do $$
declare
  rec record;
begin
  for rec in
    select c.conrelid::regclass::text as tabla, c.conname
    from pg_constraint c
    where c.contype = 'f'
      and (
        (c.conrelid = 'public.institucion_remociones'::regclass
         and c.conkey = array[(select attnum from pg_attribute
                                where attrelid = 'public.institucion_remociones'::regclass
                                  and attname = 'profesional_id')])
        or (c.conrelid = 'public.institucion_remociones'::regclass
            and c.conkey = array[(select attnum from pg_attribute
                                   where attrelid = 'public.institucion_remociones'::regclass
                                     and attname = 'actor_id')])
        or (c.conrelid = 'public.institucion_admin_solicitudes'::regclass
            and c.conkey = array[(select attnum from pg_attribute
                                   where attrelid = 'public.institucion_admin_solicitudes'::regclass
                                     and attname = 'sugerido_por')])
        or (c.conrelid = 'public.institucion_admin_solicitudes'::regclass
            and c.conkey = array[(select attnum from pg_attribute
                                   where attrelid = 'public.institucion_admin_solicitudes'::regclass
                                     and attname = 'resuelto_por')])
      )
  loop
    execute format('alter table %s drop constraint %I', rec.tabla, rec.conname);
  end loop;
end $$;

alter table public.institucion_remociones
  add constraint institucion_remociones_profesional_id_fkey
  foreign key (profesional_id) references auth.users (id) on delete set null;

alter table public.institucion_remociones
  add constraint institucion_remociones_actor_id_fkey
  foreign key (actor_id) references auth.users (id) on delete set null;

alter table public.institucion_admin_solicitudes
  add constraint institucion_admin_solicitudes_sugerido_por_fkey
  foreign key (sugerido_por) references auth.users (id) on delete set null;

alter table public.institucion_admin_solicitudes
  add constraint institucion_admin_solicitudes_resuelto_por_fkey
  foreign key (resuelto_por) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------
-- 2) eliminar_cuenta()
-- ---------------------------------------------------------------------
create or replace function public.eliminar_cuenta()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.eliminar_cuenta() from public, anon;
grant execute on function public.eliminar_cuenta() to authenticated;

commit;

-- =====================================================================
-- VERIFICACIÓN (solo lectura, correr después, por separado)
-- =====================================================================
-- a) Las 4 columnas quedaron nullable y con "set null":
--    select conname, confdeltype from pg_constraint
--    where conname in (
--      'institucion_remociones_profesional_id_fkey',
--      'institucion_remociones_actor_id_fkey',
--      'institucion_admin_solicitudes_sugerido_por_fkey',
--      'institucion_admin_solicitudes_resuelto_por_fkey'
--    );
--    (confdeltype tiene que dar 'n' en las 4 — es el código de "set null")
-- b) Probar con una cuenta de prueba (nunca con una real todavía en
--    uso): crear un usuario de prueba, iniciar sesión como esa cuenta,
--    y en el SQL Editor (NO desde el cliente, para no depender del
--    botón todavía) correr "select eliminar_cuenta();" — tiene que
--    devolver sin error y el usuario de prueba debe desaparecer de
--    Authentication → Users.

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- El cambio de "on delete" no es destructivo en sí (no borra datos) —
-- para volver atrás alcanza con recrear las 4 constraints sin
-- "on delete set null" (o con "on delete cascade", según se prefiera).
-- eliminar_cuenta() se puede borrar con: drop function public.eliminar_cuenta();
-- Lo irreversible es el EFECTO de usar el botón una vez que existe
-- (los datos borrados por un usuario real no se recuperan) — por eso
-- la migración en sí no necesita backup propio, pero el uso del botón
-- sí depende de que cada usuario entienda que no hay vuelta atrás
-- (ver el modal de confirmación en perfil.js).
