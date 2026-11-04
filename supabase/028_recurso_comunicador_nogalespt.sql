-- 028_recurso_comunicador_nogalespt.sql
-- Suma el «Comunicador NogalesPT» a catalogo_actividades. Correr DESPUÉS de 018
-- (columna `teclas`). Idempotente: la fila se inserta solo si su URL no está.
--
-- El recurso se maneja con barrido. Declara dos teclas, ambas `combinable`
-- (toque corto + pulsación larga con firmware -TH, ver
-- js/features/configurar-dispositivo/README.md):
--   - Avanzar     -> flecha derecha
--   - Seleccionar -> Enter
-- Con barrido automático solo se usa «Seleccionar»; con manual, las dos.
--
-- Seguridad: solo inserta una fila (no cambia tablas, RLS ni policies). La
-- lectura del catálogo sigue siendo pública y la escritura, solo desde Supabase.
-- Respaldo: exportar la tabla antes. Vuelta atrás al final del archivo.

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key, teclas)
select v.*
from (values
  (
    'tercero',
    'Comunicador NogalesPT',
    'Comunicador SAAC con pictogramas, voz y tableros visuales para acompañar al alumnado, docentes y familias. De NogalesPT.',
    'Comunicación',
    'NogalesPT',
    'https://nogalespt.app/comunicador/',
    'Se abre en una pestaña nueva. Antes de usarlo con barrido, activalo en el comunicador:
1. Hacé clic en el lápiz de abajo a la izquierda.
2. Entrá a Ajustes.
3. Buscá la sección Barrido y activalo.
4. Elegí el tipo de barrido: Filas y celdas / Columnas y celdas / Celda a celda.
5. Elegí el modo de avance: Automático por tiempo (1 punto de acceso) o Manual: avanzar y seleccionar (2 puntos de acceso). Si elegís automático, ajustá la velocidad con el deslizable.
6. Elegí el indicador visual: Ampliar fila, columna o celda activa / Iluminar y atenuar el resto.
7. Cerrá la ventana y hacé clic en Guardar.',
    'Asignar la flecha derecha (Avanzar) y Enter (Seleccionar) a botones del dispositivo dis+capacidad. Con barrido automático solo se usa Seleccionar. Con un solo botón y firmware Tap-Hold, el toque corto puede avanzar y la pulsación larga seleccionar. Al terminar, volvé a la pestaña de la plataforma desde donde abriste el recurso y presioná «Restaurar» para devolver el dispositivo a como estaba.',
    'externo',
    '[
      {"id":"avanzar","etiqueta":"Avanzar (flecha derecha)","tecla":"arrowright","combinable":true},
      {"id":"seleccionar","etiqueta":"Seleccionar (Enter)","tecla":"enter","combinable":true}
    ]'::jsonb
  )
) as v(tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key, teclas)
where not exists (
  select 1 from public.catalogo_actividades c where c.url = v.url
);

-- Comprobación:
--   select nombre, categoria, teclas from public.catalogo_actividades where autor = 'NogalesPT';

-- ---------------------------------------------------------------------
-- VUELTA ATRÁS (no se corre junto con lo de arriba):
--   delete from public.catalogo_actividades
--   where url = 'https://nogalespt.app/comunicador/';
-- ---------------------------------------------------------------------
