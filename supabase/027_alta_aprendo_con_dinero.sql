-- =====================================================================
-- Plataforma EpE — Alta de "Aprendo con dinero" en el catálogo de
-- actividades.
-- Correr en Supabase → SQL Editor → New query → Run, DESPUÉS de fusionar el
-- Pull Request que agrega apps-epe/dinero.html (si se corre antes, el
-- catálogo mostraría un link que todavía no existe en el sitio).
--
-- Es idempotente: si la fila ya existe (mismo tipo y nombre), no la duplica.
-- La app en sí NO depende de esta fila: funciona sin login desde
-- apps-epe/index.html. Esto solo hace que los profesionales puedan
-- vincularla a un caso desde el espacio personal (Gestión de casos →
-- Recursos), igual que las demás Apps EpE.
--
-- Seguridad: solo INSERT de una fila pública del catálogo (tabla de lectura
-- pública, sin datos personales). No crea tablas, no toca policies ni
-- funciones. La app guarda solo preferencias (nivel, cantidad, teclas y
-- velocidad del barrido) en el navegador de quien la usa, nunca en Supabase.
--
-- icono_key = 'dinero': agregado al mapa ICONOS de
-- js/data/catalogo-actividades.js en esta misma entrega; si ese archivo no
-- se actualizó todavía en el servidor, el catálogo cae al ícono genérico sin
-- romper nada (ICONOS[row.icono_key] || ICONOS.generico).
--
-- categoria = 'Manejo del dinero'.
-- =====================================================================

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key)
select
  'app-epe',
  'Aprendo con dinero',
  'Practicar el uso del dinero: reconocer billetes, pagar con billetes, elegir cómo pagar, ir al súper y cuidarse al pagar. Se usa tocando o arrastrando, o con barrido de 1 o 2 pulsadores (dirigido o automático).',
  'Manejo del dinero',
  'dis+capacidad',
  '../apps-epe/dinero.html',
  '',
  '',
  'dinero'
where not exists (
  select 1
  from public.catalogo_actividades
  where tipo = 'app-epe'
    and nombre = 'Aprendo con dinero'
);

-- Verificación: tiene que devolver 1 fila.
select id, tipo, nombre, categoria, url, icono_key
from public.catalogo_actividades
where nombre = 'Aprendo con dinero';

-- Para deshacer (solo si todavía no hay casos que la tengan vinculada;
-- caso_actividades.catalogo_id es "on delete restrict"):
-- delete from public.catalogo_actividades
-- where tipo = 'app-epe' and nombre = 'Aprendo con dinero';
