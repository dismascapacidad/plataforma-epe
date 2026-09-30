-- =====================================================================
-- Plataforma EpE — Alta de "Comunicación con seguimiento de cabeza"
-- en el catálogo de actividades.
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de 001 y 002.
--
-- Es idempotente: si la fila ya existe (mismo tipo y nombre), no la duplica.
-- La app en sí NO depende de esta fila: funciona sin login. Esto solo hace
-- que los profesionales puedan vincularla a un caso desde el espacio
-- personal.
--
-- Mismo formato que las otras apps EpE del seed (001): url relativa a
-- /apps-terceros/ y /espacio-personal/, instrucciones/configuracion vacías,
-- icono_key = 'comunicacion-cabeza' (el SVG vive en
-- js/data/catalogo-actividades.js, mapa ICONOS).
-- =====================================================================

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key)
select
  'app-epe',
  'Comunicación con seguimiento de cabeza',
  'Escribir con el movimiento de la cabeza (webcam) y elegir con pulsador o permanencia; el texto se dice por voz.',
  'Comunicación',
  'dis+capacidad',
  '../apps-epe/comunicacion-cabeza.html',
  '',
  '',
  'comunicacion-cabeza'
where not exists (
  select 1
  from public.catalogo_actividades
  where tipo = 'app-epe'
    and nombre = 'Comunicación con seguimiento de cabeza'
);

-- Verificación: tiene que devolver 1 fila.
select id, tipo, nombre, categoria, url, icono_key
from public.catalogo_actividades
where nombre = 'Comunicación con seguimiento de cabeza';

-- Para deshacer (solo si todavía no hay casos que la tengan vinculada;
-- caso_actividades.catalogo_id es "on delete restrict"):
-- delete from public.catalogo_actividades
-- where tipo = 'app-epe' and nombre = 'Comunicación con seguimiento de cabeza';
