-- =====================================================================
-- Plataforma EpE — Alta de "Si-No con pulsadores" en el catálogo de
-- actividades.
-- Correr en Supabase → SQL Editor → New query → Run.
--
-- Es idempotente: si la fila ya existe (mismo tipo y nombre), no la duplica.
-- La app en sí NO depende de esta fila: ya funciona sin login desde
-- apps-epe/index.html (tile agregado en la misma entrega). Esto solo hace
-- que los profesionales puedan vincularla a un caso desde el espacio
-- personal (Gestión de casos → Recursos), igual que las demás Apps EpE.
--
-- Seguridad: solo INSERT de una fila pública del catálogo (tabla de lectura
-- pública, sin datos personales). No crea tablas, no toca policies ni
-- funciones. La app guarda sus textos e imágenes únicamente en el navegador
-- de quien la usa, nunca en Supabase.
--
-- icono_key = 'si-no': agregado al mapa ICONOS de
-- js/data/catalogo-actividades.js en esta misma entrega; si ese archivo no
-- se actualizó todavía en el servidor, el catálogo cae al ícono genérico sin
-- romper nada (ICONOS[row.icono_key] || ICONOS.generico).
--
-- categoria = 'Comunicación': la misma de "Comunicación con seguimiento de
-- cabeza".
-- =====================================================================

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key)
select
  'app-epe',
  'Si-No con pulsadores',
  'Tablero de dos casillas (y una tercera opcional) con imagen y texto a voz, para responder sí o no. Se usa con una tecla por casilla, con barrido de 1 o 2 pulsadores (dirigido o automático, con tiempo configurable) o con seguimiento de cabeza (con pulsador o por permanencia). Las imágenes pueden venir del dispositivo o de ARASAAC.',
  'Comunicación',
  'dis+capacidad',
  '../apps-epe/si-no.html',
  '',
  '',
  'si-no'
where not exists (
  select 1
  from public.catalogo_actividades
  where tipo = 'app-epe'
    and nombre = 'Si-No con pulsadores'
);

-- Verificación: tiene que devolver 1 fila.
select id, tipo, nombre, categoria, url, icono_key
from public.catalogo_actividades
where nombre = 'Si-No con pulsadores';

-- Para deshacer (solo si todavía no hay casos que la tengan vinculada;
-- caso_actividades.catalogo_id es "on delete restrict"):
-- delete from public.catalogo_actividades
-- where tipo = 'app-epe' and nombre = 'Si-No con pulsadores';
