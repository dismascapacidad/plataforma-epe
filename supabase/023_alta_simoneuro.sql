-- =====================================================================
-- Plataforma EpE — Alta de "SimoNeuro" en el catálogo de actividades.
-- Correr en Supabase → SQL Editor → New query → Run.
--
-- Es idempotente: si la fila ya existe (mismo tipo y nombre), no la duplica.
-- La app en sí NO depende de esta fila: ya funciona sin login desde
-- apps-epe/index.html (tile ya agregado). Esto solo hace que los
-- profesionales puedan vincularla a un caso desde el espacio personal
-- (Gestión de casos → Recursos), igual que Piano/Hanói/N-back/Stroop/etc.
--
-- icono_key = 'simoneuro': agregado al mapa ICONOS de
-- js/data/catalogo-actividades.js en esta misma entrega (grilla 2x2, como
-- el tablero real del juego) — si ese archivo no se actualizó todavía en
-- el servidor, el catálogo cae al ícono genérico sin romper nada
-- (ICONOS[row.icono_key] || ICONOS.generico).
--
-- categoria = 'Memoria de trabajo y atención': se reutiliza la misma
-- categoría de N-back en vez de crear una nueva solo para esta app —
-- SimoNeuro es técnicamente una prueba de amplitud de secuencia (span
-- task, familia del Corsi block-tapping test / digit span), pariente
-- cercana de la memoria de trabajo. Si preferís una categoría propia
-- (ej. "Memoria de secuencias"), es un solo valor para cambiar.
-- =====================================================================

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key)
select
  'app-epe',
  'SimoNeuro',
  'Memoria de secuencias (span task, como el Corsi block-tapping test): repetir una secuencia de colores que crece de a uno, en 4 modos de combinación visual/auditiva (incluidos dos de interferencia cruzada tipo Stroop). Se juega con teclado o con barrido de 1 o 2 pulsadores; duración del estímulo y aceleración configurables.',
  'Memoria de trabajo y atención',
  'dis+capacidad',
  '../apps-epe/simoneuro.html',
  '',
  '',
  'simoneuro'
where not exists (
  select 1
  from public.catalogo_actividades
  where tipo = 'app-epe'
    and nombre = 'SimoNeuro'
);

-- Verificación: tiene que devolver 1 fila.
select id, tipo, nombre, categoria, url, icono_key
from public.catalogo_actividades
where nombre = 'SimoNeuro';

-- Para deshacer (solo si todavía no hay casos que la tengan vinculada;
-- caso_actividades.catalogo_id es "on delete restrict"):
-- delete from public.catalogo_actividades
-- where tipo = 'app-epe' and nombre = 'SimoNeuro';
