-- =====================================================================
-- Plataforma EpE — Renombrar "Vincular imagen" a "Vincular imagen-botón"
-- en el catálogo de actividades.
-- Correr en Supabase → SQL Editor → New query → Run.
--
-- Solo cambia el NOMBRE visible. La url ('../apps-epe/vincular-imagen.html')
-- y el icono_key ('vincular-imagen') quedan igual, así los casos que ya
-- tienen esta app vinculada siguen funcionando: caso_actividades guarda
-- solo el id de la fila del catálogo, que no cambia.
--
-- Es idempotente: si ya se corrió, no encuentra nada que cambiar.
-- No toca policies, tablas ni permisos. Se ejecuta en el SQL Editor (con el
-- rol del proyecto), no desde la app.
-- =====================================================================

-- Antes (tiene que devolver 1 fila la primera vez):
select id, nombre, url, icono_key
from public.catalogo_actividades
where tipo = 'app-epe' and url = '../apps-epe/vincular-imagen.html';

update public.catalogo_actividades
set nombre = 'Vincular imagen-botón'
where tipo = 'app-epe'
  and url = '../apps-epe/vincular-imagen.html'
  and nombre = 'Vincular imagen';

-- Después (tiene que mostrar el nombre nuevo):
select id, nombre, url, icono_key
from public.catalogo_actividades
where tipo = 'app-epe' and url = '../apps-epe/vincular-imagen.html';

-- Para deshacer:
-- update public.catalogo_actividades
-- set nombre = 'Vincular imagen'
-- where tipo = 'app-epe'
--   and url = '../apps-epe/vincular-imagen.html'
--   and nombre = 'Vincular imagen-botón';
