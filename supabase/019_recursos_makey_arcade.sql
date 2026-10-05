-- 019_recursos_makey_arcade.sql
-- Suma tres recursos de Makey Makey a catalogo_actividades, con las teclas que
-- necesitan (columna `teclas`, creada en 018: correr 018 antes que este).
--
-- Seguridad: solo inserta filas (no cambia tablas ni policies). Quién lee y
-- quién escribe sigue igual que en 018. Idempotente: cada fila se inserta solo
-- si su URL no está cargada.
-- Respaldo: exportar la tabla antes. Vuelta atrás al final del archivo.
-- Pendiente de verificar en una prueba real: que cada recurso responda a esas
-- teclas (no se pudo comprobar desde el entorno de desarrollo).

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key, teclas)
select v.*
from (values
  (
    'tercero',
    'BOUNCEY FACE (Makey Makey Arcade)',
    'Juego de Makey Makey estilo arcade que se controla con las teclas de dirección del teclado.',
    'Juegos',
    'Makey Makey (JoyLabz)',
    'https://arcade.makeymakey.com/play/#bouncey%20face',
    'Se abre en una pestaña nueva. Jugá con los botones que asignaste a cada flecha del teclado.',
    'Asignar las 4 flechas del teclado (↑ ↓ ← →) a botones del dispositivo dis+capacidad. Al terminar, volvé a la pestaña de la plataforma desde donde abriste el recurso y presioná «Restaurar» para devolver el dispositivo a como estaba.',
    'externo',
    '[
      {"id":"up","etiqueta":"Flecha ↑","tecla":"arrowup"},
      {"id":"down","etiqueta":"Flecha ↓","tecla":"arrowdown"},
      {"id":"left","etiqueta":"Flecha ←","tecla":"arrowleft"},
      {"id":"right","etiqueta":"Flecha →","tecla":"arrowright"}
    ]'::jsonb
  ),
  (
    'tercero',
    'TIMER (Makey Makey Apps)',
    'Cronómetro de Makey Makey que se maneja con la flecha izquierda, la flecha arriba y la barra espaciadora.',
    'Juegos',
    'Makey Makey (JoyLabz)',
    'https://apps.makeymakey.com/play/#timer',
    'Se abre en una pestaña nueva. Flecha izquierda: iniciar. Flecha arriba: detener. Barra espaciadora: reiniciar.',
    'Asignar la flecha izquierda, la flecha arriba y la barra espaciadora a botones del dispositivo dis+capacidad. Al terminar, volvé a la pestaña de la plataforma desde donde abriste el recurso y presioná «Restaurar» para devolver el dispositivo a como estaba.',
    'externo',
    '[
      {"id":"left","etiqueta":"Flecha ←","tecla":"arrowleft"},
      {"id":"up","etiqueta":"Flecha ↑","tecla":"arrowup"},
      {"id":"space","etiqueta":"Barra espaciadora","tecla":" "}
    ]'::jsonb
  ),
  (
    'tercero',
    'BONGOS (Makey Makey Apps)',
    'Bongós virtuales de Makey Makey que suenan con la flecha izquierda y la barra espaciadora.',
    'Juegos',
    'Makey Makey (JoyLabz)',
    'https://apps.makeymakey.com/bongos/',
    'Se abre en una pestaña nueva. Cada botón asignado toca uno de los dos tambores.',
    'Asignar la flecha izquierda y la barra espaciadora a botones del dispositivo dis+capacidad. Al terminar, volvé a la pestaña de la plataforma desde donde abriste el recurso y presioná «Restaurar» para devolver el dispositivo a como estaba.',
    'externo',
    '[
      {"id":"left","etiqueta":"Flecha ←","tecla":"arrowleft"},
      {"id":"space","etiqueta":"Barra espaciadora","tecla":" "}
    ]'::jsonb
  )
) as v(tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key, teclas)
where not exists (
  select 1 from public.catalogo_actividades c where c.url = v.url
);

-- Comprobación:
--   select nombre, jsonb_array_length(teclas) from public.catalogo_actividades where teclas is not null;

-- ---------------------------------------------------------------------
-- VUELTA ATRÁS (no se corre junto con lo de arriba):
--   delete from public.catalogo_actividades where url in (
--     'https://arcade.makeymakey.com/play/#bouncey%20face',
--     'https://apps.makeymakey.com/play/#timer',
--     'https://apps.makeymakey.com/bongos/');
-- ---------------------------------------------------------------------
