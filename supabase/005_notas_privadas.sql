-- =====================================================================
-- Plataforma EpE — Notas personales 100% privadas (Fase 7, follow-up 2)
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de
-- 001_schema_inicial.sql, 002_patches.sql, 003_compartir.sql y
-- 004_comentarios.sql.
--
-- Decisión de producto: "Notas personales" (caso_entradas) pasan a ser
-- exclusivas del dueño del caso — ni siquiera de lectura para colegas,
-- institución o dis+capacidad. La colaboración en un caso compartido
-- pasa por "Espacio compartido" (caso_comentarios, ver 004), que queda
-- como el único canal visible para todos los que tienen acceso al caso.
--
-- Esto SOLO quita la policy de lectura compartida que había agregado
-- 003_compartir.sql para esta tabla — el dueño sigue viendo/escribiendo
-- sus propias notas exactamente igual que antes (esa policy, de 001, no
-- se toca).
-- =====================================================================

drop policy if exists "caso_entradas: select compartido" on public.caso_entradas;
