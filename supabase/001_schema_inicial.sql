-- =====================================================================
-- Plataforma EpE — Esquema inicial (Fase 5)
-- Correr una sola vez en Supabase → SQL Editor → New query → Run.
-- Basado 1 a 1 en las formas de datos usadas hoy en:
--   js/features/perfil/data/store.js
--   js/features/perfil/data/schema.js
--   js/data/catalogo-actividades.js
-- =====================================================================

-- gen_random_uuid() vive en pgcrypto. Supabase suele tenerla habilitada,
-- pero esto no rompe nada si ya está.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- profiles
-- Espejo de EpeStore.getProfile()/saveProfile(). Se crea sola vía
-- trigger cuando alguien se registra en Supabase Auth (ver más abajo).
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  profesion text not null default '',
  institucion text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- catalogo_actividades
-- Reemplaza el array ENTRADAS de js/data/catalogo-actividades.js.
-- "icono_key" guarda la clave del ícono (piano, barrido, vincular-imagen,
-- generico, externo) — el SVG en sí sigue viviendo en el frontend (en el
-- mapa ICONOS de ese archivo), acá solo se referencia cuál usar.
-- Curada por dis+capacidad: solo el owner del proyecto Supabase puede
-- escribir acá (lectura pública, ver policies).
-- ---------------------------------------------------------------------
create table public.catalogo_actividades (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('app-epe', 'tercero')),
  nombre text not null,
  descripcion text not null default '',
  categoria text not null default '',
  autor text not null default '',
  url text not null default '',
  instrucciones text not null default '',
  configuracion text not null default '',
  icono_key text not null default 'generico',
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- casos
-- Espejo de EpeStore.getCasos()/createCaso()/updateCaso()/deleteCaso().
-- ---------------------------------------------------------------------
create table public.casos (
  id uuid primary key default gen_random_uuid(),
  dueno_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null default 'Caso sin nombre',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index casos_dueno_id_idx on public.casos (dueno_id);

-- ---------------------------------------------------------------------
-- caso_actividades
-- Espejo de listActividades()/hasActividad()/addActividad()/removeActividad().
-- "Vincular" nunca copia la app: guarda una referencia al catálogo.
-- ---------------------------------------------------------------------
create table public.caso_actividades (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  catalogo_id uuid not null references public.catalogo_actividades (id) on delete restrict,
  agregado_en timestamptz not null default now(),
  unique (caso_id, catalogo_id) -- espejo de hasActividad(): no duplicar
);

create index caso_actividades_caso_id_idx on public.caso_actividades (caso_id);

-- ---------------------------------------------------------------------
-- caso_apps_terceros
-- Espejo de listAppsTerceros()/addAppTercero()/removeAppTercero().
-- A diferencia de caso_actividades, acá los datos van inline: son propios
-- de ESTE caso, nunca aparecen en el catálogo público.
-- ---------------------------------------------------------------------
create table public.caso_apps_terceros (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  nombre text not null default '',
  descripcion text not null default '',
  instrucciones text not null default '',
  configuracion text not null default '',
  url text not null default '',
  creado_en timestamptz not null default now()
);

create index caso_apps_terceros_caso_id_idx on public.caso_apps_terceros (caso_id);

-- ---------------------------------------------------------------------
-- caso_entradas
-- Espejo de listEntradas()/addEntrada()/removeEntrada(). Tabla unificada
-- para nota/evaluación/sesión (EpeSchema.ENTRADA_TIPOS).
-- ---------------------------------------------------------------------
create table public.caso_entradas (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  tipo text not null default 'nota' check (tipo in ('nota', 'evaluacion', 'sesion')),
  contenido text not null default '',
  creado_en timestamptz not null default now()
);

create index caso_entradas_caso_id_idx on public.caso_entradas (caso_id);

-- ---------------------------------------------------------------------
-- caso_shares
-- Espejo de getShares()/setShare(). Hoy la UI que la usa es mock/no
-- funcional — igual la modelamos bien para no tener que migrar de nuevo.
-- compartido_con_user_id solo se completa para tipo "colega"; para
-- "institucion" y "dismascapacidad" es un flag de visibilidad sin
-- usuario puntual (EpeSchema.SHARE_TIPOS).
-- ---------------------------------------------------------------------
create table public.caso_shares (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos (id) on delete cascade,
  tipo text not null check (tipo in ('institucion', 'colega', 'dismascapacidad')),
  compartido_con_user_id uuid references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

create index caso_shares_caso_id_idx on public.caso_shares (caso_id);

-- =====================================================================
-- Triggers
-- =====================================================================

-- profiles se crea sola cuando alguien se registra en Supabase Auth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- actualizado_en de casos se toca solo en cada update.
create function public.set_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger casos_set_actualizado_en
  before update on public.casos
  for each row execute procedure public.set_actualizado_en();

-- =====================================================================
-- RLS — MVP: "dueño ve/edita todo lo suyo", nada más. La lógica de
-- caso_shares queda para una iteración posterior (hoy no es funcional).
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.catalogo_actividades enable row level security;
alter table public.casos enable row level security;
alter table public.caso_actividades enable row level security;
alter table public.caso_apps_terceros enable row level security;
alter table public.caso_entradas enable row level security;
alter table public.caso_shares enable row level security;

-- profiles: cada quien ve/edita solo el propio.
create policy "profiles: select propio"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update propio"
  on public.profiles for update
  using (auth.uid() = id);

-- catalogo_actividades: lectura pública para cualquier usuario logueado
-- (es el catálogo curado, no hay dueño). Sin policy de insert/update/delete
-- desde el cliente: eso se carga a mano desde el SQL Editor o el Table
-- Editor de Supabase, nunca desde la app.
create policy "catalogo: lectura para logueados"
  on public.catalogo_actividades for select
  to authenticated
  using (true);

-- casos: dueño ve/edita/borra los suyos.
create policy "casos: select propio"
  on public.casos for select
  using (auth.uid() = dueno_id);

create policy "casos: insert propio"
  on public.casos for insert
  with check (auth.uid() = dueno_id);

create policy "casos: update propio"
  on public.casos for update
  using (auth.uid() = dueno_id);

create policy "casos: delete propio"
  on public.casos for delete
  using (auth.uid() = dueno_id);

-- Tablas hijas: el "dueño" es siempre el dueño del caso al que pertenecen.
-- Mismo patrón (select/insert/update/delete) para las cuatro.

create policy "caso_actividades: select via caso"
  on public.caso_actividades for select
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));
create policy "caso_actividades: insert via caso"
  on public.caso_actividades for insert
  with check (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));
create policy "caso_actividades: delete via caso"
  on public.caso_actividades for delete
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));

create policy "caso_apps_terceros: select via caso"
  on public.caso_apps_terceros for select
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));
create policy "caso_apps_terceros: insert via caso"
  on public.caso_apps_terceros for insert
  with check (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));
create policy "caso_apps_terceros: delete via caso"
  on public.caso_apps_terceros for delete
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));

create policy "caso_entradas: select via caso"
  on public.caso_entradas for select
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));
create policy "caso_entradas: insert via caso"
  on public.caso_entradas for insert
  with check (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));
create policy "caso_entradas: delete via caso"
  on public.caso_entradas for delete
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));

create policy "caso_shares: select via caso"
  on public.caso_shares for select
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));
create policy "caso_shares: insert via caso"
  on public.caso_shares for insert
  with check (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));
create policy "caso_shares: delete via caso"
  on public.caso_shares for delete
  using (exists (select 1 from public.casos c where c.id = caso_id and c.dueno_id = auth.uid()));

-- =====================================================================
-- Seed: contenido actual de js/data/catalogo-actividades.js
-- Los ids van a ser uuids nuevos generados acá (no coinciden con los
-- strings "app-epe-piano" etc. del código viejo) — no importa, porque
-- cuando se migre el catálogo en la Fase 6 la app va a leerlos de acá,
-- no a tenerlos hardcodeados.
-- =====================================================================

insert into public.catalogo_actividades
  (tipo, nombre, descripcion, categoria, autor, url, instrucciones, configuracion, icono_key)
values
  ('app-epe', 'Piano',
   '7 notas con teclado o puntero, para practicar acceso por switch.',
   'Música y sonido', 'dis+capacidad', '../apps-epe/piano.html', '', '', 'piano'),

  ('app-epe', 'Barrido',
   'Entrenador de barrido por tiempo o por 2 pulsadores, copiando una palabra.',
   'Acceso por switch', 'dis+capacidad', '../apps-epe/barrido.html', '', '', 'barrido'),

  ('app-epe', 'Vincular imagen',
   'De 1 a 8 casilleros con imagen propia, texto a voz y tecla asignable.',
   'Comunicación', 'dis+capacidad', '../apps-epe/vincular-imagen.html', '', '', 'vincular-imagen'),

  ('tercero', 'Piano de frutas (MakeyMakey + Scratch)',
   'Ejemplo — reemplazar por el recurso real: tocar frutas conectadas al MakeyMakey suena como teclas de piano en un proyecto de Scratch.',
   'Música y sonido', 'MakeyMakey', 'https://makeymakey.com/',
   'Conectá cada objeto conductor (frutas, plastilina conductora, papel aluminio) a una de las entradas de flecha o espacio del MakeyMakey con un cable caimán, y otro cable de la entrada "EARTH" a la mano o el cuerpo de la persona (o a una superficie que esté tocando). Al tocar el objeto conductor mientras se toca tierra, se cierra el circuito y se presiona esa tecla en el proyecto.',
   'MakeyMakey conectado por USB, configurado como teclado (modo por defecto). No requiere ningún dispositivo dismascapacidad adicional. Conviene revisar antes que el objeto elegido conduzca electricidad razonablemente bien (fruta fresca, no seca).',
   'externo'),

  ('tercero', 'Comunicador básico (MakeyMakey + Scratch)',
   'Ejemplo — reemplazar por el recurso real: entradas grandes que emulan teclas de flecha/espacio para armar un comunicador simple en Scratch.',
   'Comunicación', 'MakeyMakey', 'https://makeymakey.com/',
   'Cada pulsador o superficie conductora conectada a una entrada del MakeyMakey dispara una tecla del proyecto de Scratch elegido. Conviene definir antes con qué mensaje o imagen va a asociarse cada entrada disponible.',
   'MakeyMakey como teclado (modo por defecto), USB. Si se usan pulsadores externos en vez de tocar directo el MakeyMakey, hace falta un cable caimán por pulsador hacia cada entrada usada, más el cable de tierra común.',
   'externo');
