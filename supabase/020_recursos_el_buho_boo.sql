-- 020_recursos_el_buho_boo.sql
-- Suma tres juegos de El Búho Boo a catalogo_actividades. Correr DESPUÉS de 018
-- (columna `teclas`). Idempotente: cada fila se inserta solo si su URL no está.
--
-- Solo Animalitos declara `teclas` acá (barra espaciadora). FORMITAS y COMPLETAR se
-- manejan con el cursor y el clic del mouse; esos requisitos se cargan en
-- 021_requisitos_cursor_arrastrar.sql (correrlo después de este).
--
-- Seguridad: solo inserta filas (no cambia tablas ni policies).
-- Respaldo: exportar la tabla antes. Vuelta atrás al final del archivo.

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key, teclas)
select v.*
from (values
  (
    'tercero',
    'ANIMALITOS (El Búho Boo)',
    'Juego de causa y efecto simple: al presionar la barra espaciadora, los animalitos responden.',
    'Juegos',
    'El Búho Boo',
    'https://elbuhoboo.com/juegos-educativos/animalitos/',
    'Se abre en una pestaña nueva. Presioná la barra espaciadora (o el botón del dispositivo que le asignaste) para jugar.',
    'Asignar la barra espaciadora a un botón del dispositivo dis+capacidad. Al terminar, volvé a la pestaña de la plataforma desde donde abriste el recurso y presioná «Restaurar» para devolver el dispositivo a como estaba.',
    'externo',
    '[
      {"id":"space","etiqueta":"Barra espaciadora","tecla":" "}
    ]'::jsonb
  ),
  (
    'tercero',
    'FORMITAS (El Búho Boo)',
    'Juego para pasar el cursor sobre los animalitos y descubrir sus formas. Se juega moviendo el cursor del mouse.',
    'Juegos',
    'El Búho Boo',
    'https://elbuhoboo.com/juegos-educativos/formitas/',
    'Se abre en una pestaña nueva. Pasá el cursor sobre los animalitos; no hace falta hacer clic.',
    'Las flechas del dispositivo tienen que mover el cursor del mouse. Esta configuración todavía no se hace desde la plataforma: verificala en el dispositivo antes de abrir el recurso.',
    'externo',
    null
  ),
  (
    'tercero',
    'COMPLETAR (El Búho Boo)',
    'Juego de arrastrar piezas para completar un dibujo. Sirve como ejemplo de la función «mantener clic» de los dispositivos dis+capacidad.',
    'Juegos',
    'El Búho Boo',
    'https://elbuhoboo.com/juegos-educativos/completar-panda/',
    'Se abre en una pestaña nueva. Mantené el clic izquierdo con el botón del dispositivo y movelo con las flechas para arrastrar cada pieza.',
    'Un botón del dispositivo tiene que hacer «mantener clic izquierdo» y las flechas tienen que mover el cursor del mouse. Esta configuración todavía no se hace desde la plataforma: dejala armada en el dispositivo antes de abrir el recurso.',
    'externo',
    null
  )
) as v(tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key, teclas)
where not exists (
  select 1 from public.catalogo_actividades c where c.url = v.url
);

-- Comprobación:
--   select nombre, teclas is not null as con_teclas from public.catalogo_actividades where autor = 'El Búho Boo';

-- ---------------------------------------------------------------------
-- VUELTA ATRÁS (no se corre junto con lo de arriba):
--   delete from public.catalogo_actividades where url in (
--     'https://elbuhoboo.com/juegos-educativos/animalitos/',
--     'https://elbuhoboo.com/juegos-educativos/formitas/',
--     'https://elbuhoboo.com/juegos-educativos/completar-panda/');
-- ---------------------------------------------------------------------
