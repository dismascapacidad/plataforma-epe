# Configurar dispositivo — guía para apps propias y de terceros

El widget «Configurar dispositivo» deja el dispositivo dis+capacidad (disMouse,
disHub…) listo para usar una app: pregunta a qué botón físico va cada acción,
manda los comandos, y ofrece deshacer y restaurar. Esta guía es el contrato
para quien arma o integra una app, propia o de terceros, presente o futura.

Principio: se configura **lo mínimo para que el recurso funcione**. La
personalización fina es del configurador, no de la plataforma.

## Cómo se invoca

Apps propias (scripts clásicos, vía el puente):

```js
window.EpeConfigurarDispositivo
  .abrir(entradas, { titulo: 'Configurar dispositivo — Mi app', combinar: true })
  .then((resultado) => { /* ver "Qué devuelve" */ });
```

Recursos de terceros: no se llama al widget a mano. El recurso se carga en
`catalogo_actividades` con su columna `teclas` (jsonb) y la plataforma hace el
resto (`externo.js`).

`entradas` es una lista de requisitos (`{ id, etiqueta, tipo, ... }`, ver
`teclas-externas.js`). Las apps propias pueden seguir pasando
`{ id, etiqueta, tecla }`, que se toma como tipo `tecla`.

## Las cuatro clases de requisito

| Clase | Forma en el catálogo | Usa botón |
|---|---|---|
| tecla | `{"id","etiqueta","tecla","mods"?}` | sí |
| mouse | `{"id","etiqueta","mouse"}` (clic, clic-derecho, clic-central, doble-clic, scroll-arriba, scroll-abajo) | sí |
| cursor | `{"id","etiqueta","cursor":true}` | no (las flechas mueven el cursor) |
| arrastrar | `{"id","etiqueta","arrastrar":true}` | sí |

De 1 a 8 ítems; como mucho un `cursor` y un `arrastrar`. Cualquier valor
inválido descarta la lista entera (no se aceptan listas a medias).

## Un botón, dos eventos (Tap-Hold)

Con firmware `-TH<n>`, un mismo botón puede dar dos eventos: un **toque corto**
y una **pulsación larga** (por defecto desde 1000 ms; la persona lo ajusta
entre 100 y 5000 ms en el resumen). Sirve cuando hay más acciones que botones,
por ejemplo para un solo pulsador con barrido (avanzar + seleccionar).

Es **opt-in**: nada se combina si la app o el recurso no lo declara.

### Cómo se declara

- **App propia, para todas sus acciones:** `abrir(entradas, { combinar: true })`.
- **Recurso de terceros, acción por acción:** `"combinable": true` en el ítem.
  Es lo que permite que un recurso tolere la combinación en unas acciones y no
  en otras.

```json
[
  {"id":"avanzar","etiqueta":"Avanzar","tecla":"k","combinable":true},
  {"id":"seleccionar","etiqueta":"Seleccionar","tecla":"l","combinable":true},
  {"id":"pausa","etiqueta":"Pausa","tecla":"p"}
]
```

Reglas:

1. Para compartir botón, **las dos acciones** tienen que admitirlo (app con
   `combinar`, o ambas con `combinable`).
2. Misma clase: dos teclas, o dos de mouse. Doble clic no puede ser la larga.
3. `cursor` y `arrastrar` nunca se combinan; en el catálogo, `combinable` en
   ellos (o con un valor que no sea `true`) invalida la lista entera.
4. Solo si el firmware conectado soporta Tap-Hold. Si no, el flujo es el de
   siempre y, si faltan botones, se avisa qué acciones quedaron sin configurar.
5. Si no hay lugar para alguna acción (sin botón libre ni con quién
   combinarla), el asistente sigue al resumen y las lista como «Sin configurar».

### Cuándo NO usarlo

El toque corto con Tap-Hold llega **al soltar el botón** (o al cumplirse el
umbral), no al apretarlo: el firmware tiene que esperar para distinguir un
toque de una pulsación larga. Por eso no conviene declarar `combinable` en
acciones donde importan la **respuesta inmediata** o la **duración real de la
pulsación**:

- Medición de tiempos de reacción o de duración de pulsación. (Duración de
  pulsación no usa esta función: necesita el tiempo real que se mantiene el
  botón y con Tap-Hold la app recibe una tecla puntual.)
- Acciones que dependen de mantener la tecla apretada.
- Juegos de ritmo o con respuesta muy exigente en tiempo.

Las apps que miden tiempo y sí se combinan (Stroop, SimoNeuro) lo avisan en
su resumen: el tiempo de respuesta puede incluir la espera del dispositivo.
La latencia real todavía no se midió con hardware.

### Qué devuelve `abrir`

`{ ok, motivo?, snapshot?, restaurar?, continuar?, combinados? }`.

`combinados` (solo si se aplicó una configuración) lista los botones que
quedaron con dos eventos: `[{ corto, largo, umbral }]`, donde `corto` y
`largo` son los `id` de las acciones y `umbral` está en ms. Vacío o ausente =
ninguno combinado. Una app que mide tiempos lo usa para avisar (ver arriba).

## Requisitos de firmware

- Tap-Hold: firmware con sufijo `-TH<n>` (el núcleo lo detecta con
  `supportsTapHold`). Sin eso, `combinar` y `combinable` no tienen efecto.
- Todo lo que arma el widget pasa por la lista blanca del núcleo
  (`esComandoDeConfiguracion`) antes de enviarse.

## Cargar un recurso de terceros (ejemplo SQL)

Siguiendo `supabase/018`–`021`: una fila por recurso, `teclas` como jsonb.

```sql
update public.catalogo_actividades
set teclas = '[
  {"id":"avanzar","etiqueta":"Avanzar","tecla":"k","combinable":true},
  {"id":"seleccionar","etiqueta":"Seleccionar","tecla":"l","combinable":true}
]'::jsonb
where url = 'https://ejemplo.org/recurso/';
```

No cambia tablas ni policies. Antes de tocar la base real: exportar la tabla y
tener la vuelta atrás (`set teclas = null` o el valor anterior).

## Checklist para una app nueva

1. Declarar las acciones como requisitos (`id`, `etiqueta`, tecla o mouse…).
2. Decidir si tolera Tap-Hold: ¿le sirve que el toque llegue al soltar?
   Si sí → `combinar: true` (propia) o `combinable: true` (tercero).
3. Si mide tiempos, avisar en el resumen cuando `resultado.combinados` no esté
   vacío.
4. Guardar `resultado.restaurar` y usar `confirmarSalida(restaurar)` antes de
   salir de la app, para devolver el dispositivo a como estaba.
5. Probar con el dispositivo simulado (`dev/transporte-simulado.js`, firmware
   `R019-TH1`, y uno sin `-TH` para ver el caso sin Tap-Hold).
6. Agregar o actualizar tests en `tests/dispositivo/`.

## Archivos

- `widget.js` — el asistente (módulo ES + puente `window.EpeConfigurarDispositivo`).
- `comandos.js` — funciones puras: de requisito a comandos, reglas de combinación.
- `teclas-externas.js` — validación estricta de lo que viene de la base.
- `externo.js` — flujo para recursos de terceros (configurar, abrir, restaurar).
- `conexion-activa.js`, `pendiente.js` — conexión compartida y respaldo del estado original.

## Apps que lo usan hoy

Propias con `combinar: true`: Barrido, Torre de Hanói, N-back, Stroop, SimoNeuro.
Duración de pulsación usa el widget pero no combina (mide el tiempo real de
pulsación). Piano, Lado Correcto y Vincular imagen-botón no usan barrido y por
ahora tampoco combinan. Sumar una app más es una línea en su llamada a `abrir`.
