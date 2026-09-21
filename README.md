# Plataforma Equipar para Equipar

Espacio digital para profesionales de rehabilitación: configurador de
dispositivos, recursos terapéuticos, espacio personal y formación. Ver el
documento ejecutivo (`Plataforma_EpE_Documento_Ejecutivo.docx`, en la carpeta
padre) para el contexto de producto completo.

## Estado

**Paso 1 (home) terminado. Espacio personal funcional con datos locales.
Tres Apps EpE prototipadas y linkeadas, catálogo de apps de terceros con
página pública propia, y ambas se pueden vincular a un caso.** El home
(`index.html`) ya tiene su estética definitiva. El espacio personal
(`espacio-personal/`) tiene login y dashboard funcionales, pero corriendo
sobre datos locales — ver la sección siguiente. Las tres Apps EpE
(`apps-epe/`) están accesibles desde el home a través de
`apps-epe/index.html` (una página de cards), y las apps de terceros del
catálogo público a través de `apps-terceros/index.html` — ambas con
navegación de vuelta en los dos sentidos. Desde un caso del espacio
personal se pueden vincular las dos (ver "Catálogo de actividades..." más
abajo). El configurador sigue siendo placeholder.

## Apps EpE

Cada app vive en `apps-epe/<nombre>.html`, con su JS en
`js/features/apps-epe/<nombre>/` y su CSS en
`css/features/apps-epe/<nombre>.css` — mismo criterio de carpetas que el
resto del proyecto. `apps-epe/index.html` es la página índice (cards con
ícono, nombre y descripción de cada app, linkeando a cada una), y
`css/components/app-nav.css` tiene el estilo compartido del link "volver"
que aparece en el header de cada app y del índice. Ninguna app requiere
login ni guarda nada todavía; eso se suma cuando se decida cómo una app se
"guarda" asociada a un caso del espacio personal.

- **`piano.html`** — 7 notas (Do a Si) en las teclas A S D F G H J
  (adyacentes en la fila home, a propósito: para acceso por switch
  conviene que las teclas activas estén físicamente juntas), más teclas
  negras decorativas (sólo estéticas, no interactivas) para que se vea más
  parecido a un piano real. Sonido con Web Audio (osciladores), sin
  archivos de audio. Layout sin scroll: el teclado ocupa siempre el ancho
  completo de la pantalla.
- **`barrido.html`** — entrenador de barrido (scanning) para acceso por
  pulsadores: copiar una palabra de una grilla, en 3 modos — por tiempo (1
  pulsador, barrido automático con velocidad ajustable), manual celda por
  celda (2 pulsadores) y manual fila y columna (2 pulsadores, el estándar
  en comunicadores reales por barrido). La grilla tiene disposición
  elegible (abecedario o QWERTY). "Pulsador" hoy es una tecla de teclado —
  funciona con cualquier interfaz de switch que emule teclado, sin
  necesitar Web Bluetooth/Serial en este prototipo. Las teclas activas de
  cada modo se explicitan en el panel lateral. Incluye palabras de ejemplo
  y la opción de agregar palabras propias, y se puede escuchar por voz lo
  escrito (o la palabra objetivo al completarla) con el botón de play, de
  forma automática o con tecla dedicada a elección del usuario. La
  pronunciación respeta los acentos (ej. "MAMÁ") aunque la grilla no tenga
  letras acentuadas: cada palabra guarda una forma "de escritura" (sin
  tilde, para copiar letra por letra) y una "de pronunciación" (con tilde,
  sólo para el texto a voz). Layout sin scroll: la grilla siempre entra
  completa en la pantalla.
- **`vincular-imagen.html`** — de 1 a 8 casilleros configurables, cada uno
  con: una imagen subida por archivo propio (no URL — funciona offline),
  un texto que se lee en voz alta al activar el casillero (Web Speech
  API), y una tecla propia asignada por el usuario (presionándola, no hay
  mapeo fijo). La imagen grande de cada casillero es a la vez el botón de
  juego y el punto de edición. Layout sin scroll: la grilla de casilleros
  siempre entra completa en la pantalla, con columnas y filas calculadas
  según la cantidad elegida.

## Catálogo de actividades y vinculación a un caso

"Guardar" una actividad en un caso no instancia ni copia la app: agrega un
link a una entrada de un catálogo, mostrado como una card cuadrada dentro
de la pestaña Actividades del caso. La app en sí no sabe nada del caso ni
guarda datos ahí todavía.

Hay tres orígenes posibles para una actividad vinculada, y se distinguen
en la card (badge) y en cómo se abren:

- **Apps EpE** (`tipo: "app-epe"` en el catálogo): las propias
  (`apps-epe/*.html`). Se abren directo con "Abrir" en pestaña nueva — no
  necesitan indicaciones, la app se explica sola.
- **Apps de terceros, catálogo público** (`tipo: "tercero"` en el
  catálogo): un link a un recurso externo (ej. un proyecto de MakeyMakey),
  curado por dis+capacidad y visible para todos. En vez de "Abrir" directo,
  la card tiene "Ver detalles": abre un modal con indicaciones de uso,
  qué configuración de dispositivo hace falta, y ahí sí el botón que abre
  el recurso externo en pestaña nueva.
- **Apps de terceros, propias de un caso**: el mismo tipo de link
  (indicaciones + configuración + url externa), pero creado por el
  profesional para UN caso puntual — no se suma al catálogo público, así
  que ningún otro caso ni otro usuario la ve. Se crean con "+ Crear app de
  terceros para este caso" dentro del picker, y quedan vinculadas al caso
  automáticamente (no hay un paso de "vincular" aparte, a diferencia de
  las del catálogo público).

Piezas del código:

- **`js/data/catalogo-actividades.js`** (namespace `EpeCatalogo`) es la
  "tienda de apps" PÚBLICA: hoy un array fijo con las tres Apps EpE más
  dos apps de terceros de ejemplo (marcadas como placeholder — reemplazar
  por recursos reales curados cuando se decida cuáles sumar). El día de
  Supabase, este archivo se reemplaza por una tabla `catalogo_actividades`
  con el mismo shape (id, tipo, nombre, descripción, categoría, autor,
  url, ícono, instrucciones, configuración).
- **`caso_apps_terceros`** (en `data/store.js`) es la tabla de las apps de
  terceros privadas de un caso — mismo shape de datos que una entrada
  "tercero" del catálogo, pero con `caso_id` y sin pasar nunca por
  `EpeCatalogo`. Futuro Supabase: tabla aparte con RLS por `caso_id`
  (mismas reglas de visibilidad que el resto del caso).
- En el dashboard, "+ Agregar actividad" (pestaña Actividades de un caso)
  abre un modal genérico (`js/core/modal.js`, `css/components/modal.css`,
  reutilizable para otros diálogos) con dos pestañas — Apps EpE / De
  terceros — armado en `css/features/perfil/catalogo-picker.css`. No se
  puede vincular la misma app del catálogo público dos veces a un caso.
- `caso_actividades` (en `data/store.js`) sigue guardando solo la
  referencia (`catalogo_id`) a una entrada del catálogo público — nunca
  texto libre, coincide con cómo sería la tabla real en Supabase.

## Apps y recursos de terceros (página pública)

El catálogo de apps de terceros (`tipo: "tercero"` en `EpeCatalogo`) no
vive solo dentro del picker de un caso: también tiene su propia página
pública, sin necesitar sesión, igual que `apps-epe/index.html`.

- **`apps-terceros/index.html`** + **`js/features/apps-terceros/apps-terceros.js`**
  (namespace `EpeAppsTerceros`): lista todas las entradas tipo "tercero"
  del catálogo como cards de la misma tienda que usa el picker. Tocar una
  abre el mismo modal de detalle (indicaciones + configuración + abrir
  externo) — acá sin botón de "vincular", porque no hay ningún caso en
  contexto.
- Linkeada desde el home (`index.html`, tile "Apps y recursos de
  terceros", ya no `data-soon`) y con "← Inicio" para volver, mismo
  patrón que Apps EpE.
- El modal de detalle en sí (`js/core/tercero-detalle.js`, namespace
  `EpeTerceroDetalle`) y la grilla tipo tienda
  (`css/components/catalogo-tienda.css` + `css/components/tercero-detalle.css`)
  quedaron como componentes compartidos entre esta página y el picker del
  espacio personal — un solo lugar para no mantener dos copias del mismo
  modal.
- Las dos entradas de ejemplo (MakeyMakey) en `catalogo-actividades.js`
  siguen siendo placeholder: falta que se defina qué recursos reales se
  van a sumar y con qué indicaciones, para reemplazarlas.

## Espacio personal (local, pre-Supabase)

Antes de migrar a Supabase, se decidió validar la UX del espacio personal
con una capa de datos local: más rápido de iterar, y permite probar el
flujo real de crear/editar casos sin depender de tener el backend armado.

**Qué SÍ se puede validar así:** el dashboard completo (Perfil, Gestión de
casos, Mis dispositivos como placeholder), el alta/baja de casos, agregar y
quitar actividades vinculadas, y cargar notas/evaluaciones/sesiones.

**Qué NO se puede validar así, y por qué:** el login real y compartir casos
con otra persona. Ninguno de los dos es un tema de terminar de programarlo
bien — son imposibles sin backend por definición: `localStorage` vive
aislado por navegador y por dispositivo, así que no hay forma de que un
dato "salga" de la computadora de quien lo creó. Por eso:

- `js/features/perfil/auth-mock.js` es un login **falso**: cualquier
  email/contraseña no vacíos entran. Sirve para probar el flujo de
  pantallas (login → dashboard → salir), no para autenticar a nadie.
- Los toggles de "Compartir" en un caso (Institución / Colega /
  dis+capacidad) están visibles y guardan su estado en el navegador, pero
  no comparten nada de verdad todavía — están marcados así en la propia
  interfaz.

**Cómo está armado para que la migración a Supabase no sea una reescritura:**
`js/features/perfil/data/store.js` es la única pieza que sabe que hoy los
datos viven en `localStorage`. Expone funciones con la firma que van a
tener contra Supabase (`getCasos()`, `createCaso()`, `addEntrada()`, etc.);
el resto del código (`casos.js`, `perfil.js`, `dashboard.js`) solo llama a
esas funciones. El día que se conecte Supabase, se reescribe `store.js`
entero (y se reemplaza `auth-mock.js` por Supabase Auth de verdad) y el
resto de la app no debería necesitar cambios. `data/schema.js` tiene los
mismos enums que van a ser columnas reales (`caso_entradas.tipo`,
`caso_shares.tipo`), para no repetir esos strings a mano en otro lado.

Modelo de datos (hoy en `localStorage`, mañana tablas de Supabase con RLS
por dueño): `profiles` (nombre, profesión, institución), `casos` (nombre
libre, no fuerza identificar paciente), `caso_actividades` (actividades
recomendadas vinculadas a un caso), `caso_entradas` (tabla única para
nota/evaluación/sesión, con columna `tipo`), `caso_shares` (tipo:
`institucion | colega | dismascapacidad` — sin la palabra "mentor": no es
un rol jerárquico, es una opción más de para quién se hace visible el
caso).

## Despliegue y backend (decidido, todavía no implementado)

- **Repo**: uno nuevo, propio, separado del repo del configurador
  (`Configurador-de-productos-dismascapacidad`). Por ahora se trabaja en
  local, sin repo — se crea y se sincroniza más adelante.
- **Hosting**: GitHub Pages, igual que el configurador.
- **Dominio**: `equiparparaequipar.com.ar` o un subdominio de ese dominio.
- **Backend**: Supabase (Postgres + Auth), con login por Google o con
  password propio — las dos opciones disponibles, a elección del usuario.

  Ojo con esto: la sección 6 del documento ejecutivo
  (`Plataforma_EpE_Documento_Ejecutivo.docx`, carpeta padre) dice hoy
  "preferentemente sin Google, para facilitar el acceso desde dispositivos
  no propios" — lo contrario de sumar Google como opción. Puede ser que la
  decisión haya cambiado a "las dos opciones" a propósito, pero quedó
  anotado acá para que se resuelva esa contradicción en el documento cuando
  se retome esa sección, no porque haya que decidir nada ahora.

## Regla de estructura (no negociable)

JS, CSS y HTML siempre en archivos separados, organizados por funcionalidad.
Nunca todo en un solo archivo. Concretamente:

```
plataforma-epe/
  index.html
  css/
    base/         reset, tokens de marca, tokens de tema (claro/oscuro), tipografía
    components/   piezas reutilizables (botones, tarjetas) — sin layout de página
    layout/       composición de página (el shell, la grilla del home)
  js/
    core/         punto de entrada, utilidades compartidas
    components/   lógica de UI compartida entre secciones
    features/
      configurador/  el configurador embebido (placeholder por ahora)
      apps-epe/      una subcarpeta por app/juego propio
      perfil/        espacio personal + Supabase (placeholder por ahora)
  assets/
    img/
```

Cuando una sección (configurador, una app EpE, el perfil) tenga su propia
lógica no trivial, sigue esta misma regla puertas adentro: su propio
`css/` y `js/` si hace falta, no todo mezclado en un archivo gigante — es
exactamente lo que el configurador legado no hizo y hoy paga como deuda
técnica (ver `PLAN_deuda_tecnica.md`).

## Stack

HTML + CSS + JavaScript vanilla. Sin framework de UI, sin bundler, sin paso
de build. Los `<script>` son clásicos, no `type="module"` — se probó con
módulos ES (`import`/`export`) y el navegador los bloquea si la página se
abre directo con `file://` (doble clic), que es como se va a abrir esto la
mayoría de las veces en este punto del proyecto. En su lugar, cada archivo
expone un único objeto de namespace (ej. `EpeTheme` en `theme.js`) y
`index.html` los carga en orden. Mismo patrón que ya usa el configurador.
El sitio se sirve tal cual desde GitHub Pages, sin cambios.

## Paleta y tipografía

Derivadas de la identidad de marca EpE (ver `css/base/tokens.css`): azul
marino + teal, tipografía DM Sans. El teal reemplaza al azul genérico
(`#2563EB`) que usa hoy el configurador — cuando se lo embeba, su paleta se
realinea a esta.

`css/base/tokens.css` tiene la paleta cruda (no cambia). `css/base/theme.css`
tiene los tokens de "rol" que sí cambian entre claro y oscuro (fondo, texto,
bordes de tile, etc.) — cualquier componente nuevo que deba adaptarse a los
dos temas usa esos tokens de rol, nunca los de marca directamente.

## Modo claro/oscuro

Claro por defecto. El toggle (ícono sol/luna en el header) guarda la
elección en `localStorage` y la aplica vía `data-theme="dark"` en `<html>`.
`js/core/theme-boot.js` es un script chico y separado que se carga sin
`type="module"` y antes que el CSS, solo para aplicar el tema guardado
antes del primer paint (si no, se ve un flash claro→oscuro al recargar en
modo oscuro). La interacción del botón en sí vive en `js/core/theme.js`.

## Cómo verlo local

Doble clic en `index.html` alcanza — no hace falta servidor. Si más adelante
se suma algo que sí lo necesite (`fetch`, Supabase, etc.), levantar uno desde
esta carpeta con `python -m http.server 8899 --bind 127.0.0.1` sirve igual
que en el configurador.

## Nota para la próxima vez que algo "no se aplique" sin error visible

Un bug real de esta primera versión: un comentario de CSS que incluía
`--navy-*/--teal-*/` como forma abreviada de listar tokens cerraba el
comentario en el primer `*/` que encontraba (es el cierre de comentario en
CSS), y todo lo que seguía se interpretaba como código — sin ningún error
en consola. Rompió la hoja de estilos entera en silencio. Moraleja: nunca
escribir `*/` dentro de un comentario CSS, ni por accidente listando cosas
separadas por `/`.
