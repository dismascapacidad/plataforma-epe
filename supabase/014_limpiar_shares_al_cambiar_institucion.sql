-- =====================================================================
-- Plataforma EpE — Limpieza de shares de institución al cambiar de
-- institución (014)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de 013.
--
-- Qué resuelve: puede_ver_caso() compara la institución ACTUAL del dueño
-- de una colección y la de quien mira, no una foto fija del momento en
-- que se compartió (ver el ADR "Salida de institución" en el proyecto).
-- Sin esto, dejar una institución y unirse a otra — o directamente
-- cambiar de una institución a otra sin pasar por "dejar" — deja
-- colecciones marcadas "compartidas con mi institución" visibles para
-- los colegas de la institución NUEVA, sin que la persona lo haya
-- vuelto a decidir.
--
-- Gon pidió explícitamente que entrar a una institución sea empezar de
-- cero, independientemente del historial del profesional. Por eso esto
-- se resuelve con un trigger en la base — cubre TODOS los caminos que
-- cambian profiles.institucion_id (elegir, verificar con código,
-- verificación manual del staff, dejar la institución desde el perfil,
-- y lo que se agregue después, como la futura remoción por un admin de
-- institución) — en vez de repetir la limpieza en cada función de
-- cliente por separado.
-- =====================================================================

begin;

create or replace function public.limpiar_shares_institucion_al_cambiar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.institucion_id is distinct from old.institucion_id then
    delete from public.caso_shares
    where tipo = 'institucion'
      and caso_id in (select id from public.casos where dueno_id = new.id);
  end if;
  return new;
end;
$$;

-- Solo se dispara como trigger — nadie debe poder llamarla directo por
-- la API (mismo criterio que handle_new_user/rls_auto_enable en 013).
revoke execute on function public.limpiar_shares_institucion_al_cambiar() from public, anon, authenticated;

drop trigger if exists profiles_limpiar_shares_institucion on public.profiles;
create trigger profiles_limpiar_shares_institucion
  after update on public.profiles
  for each row
  execute function public.limpiar_shares_institucion_al_cambiar();

commit;

-- =====================================================================
-- VERIFICACIÓN (solo lectura, correr después, por separado)
-- =====================================================================
-- Con dos perfiles de prueba A y B en la misma institución:
-- 1) Desde A: crear una colección, compartirla con "institución".
-- 2) Desde B: confirmar que la ve en "Compartidos con vos".
-- 3) Desde A: Perfil → "Dejar la institución", unirse a OTRA institución.
-- 4) Desde B: la colección de A ya no debería aparecer.
-- 5) select tipo, caso_id from public.caso_shares where tipo = 'institucion';
--    no debería quedar ninguna fila para las colecciones de A.

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- begin;
-- drop trigger if exists profiles_limpiar_shares_institucion on public.profiles;
-- drop function if exists public.limpiar_shares_institucion_al_cambiar();
-- commit;
