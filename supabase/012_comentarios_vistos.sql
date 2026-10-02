-- =====================================================================
-- Plataforma EpE — Avisos de mensajes sin leer (02/10/2026)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de
-- 004_comentarios.sql, 010_instituciones_y_staff.sql y
-- 011_funciones_volatile.sql.
--
-- El canal de comentarios (caso_comentarios) ya existe desde la Fase 7,
-- pero no había ningún registro de "hasta cuándo vio cada quien los
-- comentarios de una colección" — por eso ni el profesional ni el staff
-- tenían forma de saber que había un mensaje nuevo sin entrar a revisar
-- colección por colección. Esta migración agrega esa única pieza que
-- faltaba: una marca de "visto" por usuario y por colección, reutilizada
-- tal cual tanto en el espacio personal como en el panel de staff (cada
-- quien tiene su propia marca, independiente de la de los demás).
--
-- No cambia nada de lo que ya existía: ni la tabla de comentarios ni sus
-- policies se tocan.
-- =====================================================================

-- 1) Marca de "visto": una fila por (colección, usuario). "upsert" desde
--    el cliente (ver EpeStore.marcarComentariosVistos en store.js) cada
--    vez que alguien abre el Espacio compartido de una colección — igual
--    de directo que como ya se actualiza profiles o caso_shares en este
--    proyecto, sin necesidad de una función intermedia.
create table public.caso_comentarios_vistos (
  caso_id uuid not null references public.casos (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  visto_en timestamptz not null default now(),
  primary key (caso_id, usuario_id)
);

alter table public.caso_comentarios_vistos enable row level security;

-- Cada quien solo puede leer y escribir SU PROPIA marca — nunca la de
-- otro usuario (ni para mirarla ni para pisarla).
create policy "caso_comentarios_vistos: select propio"
  on public.caso_comentarios_vistos for select
  using (usuario_id = auth.uid());

create policy "caso_comentarios_vistos: insert propio"
  on public.caso_comentarios_vistos for insert
  with check (usuario_id = auth.uid());

create policy "caso_comentarios_vistos: update propio"
  on public.caso_comentarios_vistos for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- 2) Para el espacio personal: cuántos comentarios sin leer tiene CADA
--    colección que ya puedo ver (propia o compartida conmigo), sin contar
--    los que escribí yo mismo. No necesita security definer: tanto
--    "casos" como "caso_comentarios" ya tienen policies de select que
--    dejan ver exactamente lo que auth.uid() puede ver (ver
--    003_compartir.sql), así que una consulta normal alcanza — nadie ve
--    de más por este camino. Solo trae colecciones con al menos un
--    mensaje sin leer (el cliente no tiene que filtrar ceros).
create or replace function public.mis_casos_no_leidos()
returns table (caso_id uuid, no_leidos bigint)
language sql
set search_path = public
as $$
  select
    c.id as caso_id,
    count(cc.id) filter (
      where cc.autor_id <> auth.uid()
        and cc.creado_en > coalesce(v.visto_en, 'epoch'::timestamptz)
    ) as no_leidos
  from public.casos c
  join public.caso_comentarios cc on cc.caso_id = c.id
  left join public.caso_comentarios_vistos v on v.caso_id = c.id and v.usuario_id = auth.uid()
  group by c.id
  having count(cc.id) filter (
    where cc.autor_id <> auth.uid()
      and cc.creado_en > coalesce(v.visto_en, 'epoch'::timestamptz)
  ) > 0;
$$;

revoke all on function public.mis_casos_no_leidos() from public;
grant execute on function public.mis_casos_no_leidos() to authenticated;

-- 3) Para el panel de staff: lo mismo, pero restringido a colecciones
--    compartidas con "dismascapacidad" (igual que panel_staff_colecciones
--    en 010_instituciones_y_staff.sql — a propósito separada de
--    mis_casos_no_leidos(), para no repetir el bug original de mezclar lo
--    propio del staff con lo compartido). Esta sí necesita security
--    definer: tiene que contar comentarios de colecciones de OTROS
--    usuarios, y confía en su propio chequeo de staff_dismascapacidad en
--    vez de en las policies de "casos"/"caso_comentarios". "volatile" por
--    default (no "stable") por el mismo motivo que el resto de las
--    funciones de staff — ver 011_funciones_volatile.sql.
create or replace function public.panel_staff_no_leidos()
returns table (caso_id uuid, no_leidos bigint)
language sql
security definer
set search_path = public
as $$
  select
    c.id as caso_id,
    count(cc.id) filter (
      where cc.autor_id <> auth.uid()
        and cc.creado_en > coalesce(v.visto_en, 'epoch'::timestamptz)
    ) as no_leidos
  from public.casos c
  join public.caso_shares s on s.caso_id = c.id and s.tipo = 'dismascapacidad'
  join public.caso_comentarios cc on cc.caso_id = c.id
  left join public.caso_comentarios_vistos v on v.caso_id = c.id and v.usuario_id = auth.uid()
  where exists (select 1 from public.staff_dismascapacidad where user_id = auth.uid())
  group by c.id
  having count(cc.id) filter (
    where cc.autor_id <> auth.uid()
      and cc.creado_en > coalesce(v.visto_en, 'epoch'::timestamptz)
  ) > 0;
$$;

revoke all on function public.panel_staff_no_leidos() from public;
grant execute on function public.panel_staff_no_leidos() to authenticated;
