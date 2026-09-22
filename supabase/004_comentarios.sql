-- =====================================================================
-- Plataforma EpE — Comentarios en casos compartidos (Fase 7, follow-up)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de
-- 001_schema_inicial.sql, 002_patches.sql y 003_compartir.sql.
--
-- Compartir un caso sigue siendo de solo lectura para actividades,
-- entradas (notas/evaluaciones/sesiones) y apps de terceros — eso no
-- cambia. Lo que faltaba es un canal para que alguien con quien
-- compartiste un caso te pueda dejar un mensaje a VOS (el dueño), sin
-- tocar la documentación clínica del caso. Esta tabla es ese canal.
--
-- Reglas:
-- - Puede VER los comentarios cualquiera que ya pueda ver el caso
--   (dueño o compartido) — reusa puede_ver_caso() de 003_compartir.sql.
-- - Puede ESCRIBIR un comentario cualquiera que pueda ver el caso, pero
--   solo a nombre propio (autor_id = auth.uid()) — a diferencia de
--   entradas/actividades, acá SÍ hay insert para compartidos.
-- - Puede BORRAR solo el autor su propio comentario (no hay moderación
--   del dueño sobre comentarios ajenos, al menos por ahora).
-- =====================================================================

create table public.caso_comentarios (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  autor_id uuid not null references auth.users (id) on delete cascade,
  contenido text not null default '',
  creado_en timestamptz not null default now()
);

create index caso_comentarios_caso_id_idx on public.caso_comentarios (caso_id);

alter table public.caso_comentarios enable row level security;

create policy "caso_comentarios: select via acceso al caso"
  on public.caso_comentarios for select
  using (public.puede_ver_caso(caso_id));

create policy "caso_comentarios: insert via acceso al caso"
  on public.caso_comentarios for insert
  with check (public.puede_ver_caso(caso_id) and autor_id = auth.uid());

create policy "caso_comentarios: delete propio"
  on public.caso_comentarios for delete
  using (autor_id = auth.uid());
