# Núcleo del dispositivo

Módulos ES **sin interfaz** que saben hablar con los dispositivos dis+capacidad (disMouse, disJoystick, disButton, disHub…): conectar por USB o Bluetooth, detectar el modelo, leer y aplicar configuración, y volver atrás. Es la base del widget "Configurar dispositivo" (Etapa 2 del plan) y de la futura página del configurador.

Se importa todo desde un solo archivo:

```js
import { crearConexionUsb, resumirConfiguracion } from '/js/features/dispositivo/index.js';

const { conexion } = crearConexionUsb();
const info = await conexion.conectar();          // selector del navegador + WHO
const respaldo = await conexion.tomarSnapshot(); // lee todo (GETALL), no modifica nada
await conexion.aplicar(['CFG:BR:K:P:0:s:-:-']);  // ¡queda guardado en el dispositivo!
const r = await conexion.restaurar(respaldo);    // vuelve atrás y verifica releyendo
```

## Regla de oro

**Cada comando queda guardado en la memoria del dispositivo apenas se envía.** No existe un modo de prueba que se pierda al desenchufar. Por eso el núcleo:

- solo deja pasar comandos de configuración bien formados con `aplicar()` (lista blanca `esComandoDeConfiguracion`): nunca `SAVE`, `RESET` ni comandos crudos;
- tiene métodos aparte y explícitos para `SAVE` (`guardarEnMemoria`) y `RESET` (`restablecerDeFabrica({ confirmado: true })`), y **nunca los llama solo**;
- ofrece `tomarSnapshot()` / `restaurar()`, y `restaurar()` relee el dispositivo y devuelve las diferencias que hayan quedado;
- valida que un respaldo sea del mismo modelo que el dispositivo conectado antes de restaurarlo, e informa si una lectura salió incompleta (`snapshot.faltantes`).

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.js` | API pública (`crearConexionUsb`, `crearConexionBle` y reexportaciones). |
| `conexion.js` | Orquestador: `conectar`, `leerConfig`, `tomarSnapshot`, `aplicar`, `restaurar`, `guardarEnMemoria`, `restablecerDeFabrica`. Serializa las operaciones para que no se mezclen. |
| `transporte-usb.js` | Web Serial (o polyfill WebUSB en Android). `reconectarEnSilencio()` reabre un puerto ya autorizado sin selector. |
| `transporte-ble.js` | Web Bluetooth + Nordic UART. Paquetes de 20 bytes. Siempre requiere selector. |
| `polyfill-webusb.js` | Web Serial sobre WebUSB (código de terceros, Apache-2.0, sin modificar salvo el envoltorio). |
| `protocolo.js` | Construcción y lectura de comandos (`CFG`, `WHO`, `GETALL`…). Extraído del configurador con sus 20 tests originales. |
| `productos.js` | Datos de cada modelo: entradas, etiquetas, colores, y cómo se traduce el nombre que informa `WHO`. |
| `firmware.js` | Lectura y comparación de versiones (`R019-TH1` → 19). |
| `configuracion.js` | Copiar, comparar, restaurar, resumir en texto legible y exportar respaldos (JSON y CSV del configurador). |
| `lineas.js` | Armado de líneas a partir de trozos de bytes y partición en paquetes. |
| `errores.js` | `ErrorDeTransporte` con códigos estables (`cancelado`, `puerto-ocupado`, `hid-windows`…). |

## Probar

Tests automáticos (requieren Node; **correrlos en un disco local, no dentro de Google Drive**, porque `node_modules` no se lleva bien con la sincronización):

```
npm install
npm run check      # lint + tipos + tests
```

Prueba con hardware real: el arnés `dev/arnes-dispositivo.html`. Solo necesita Python:

```
python -m http.server 8899 --bind 127.0.0.1
# sin hardware, para ver cómo funciona:  http://localhost:8899/dev/arnes-dispositivo.html?simulado=1
# con hardware:                          http://localhost:8899/dev/arnes-dispositivo.html
```

El arnés obliga a sacar un respaldo antes de tocar nada, nunca manda `SAVE` ni `RESET`, y termina cada prueba restaurando el respaldo y verificándolo.

## Diferencias con el configurador actual (a propósito)

- `modo 3` ("una vez por pulsación") ahora se restaura como `O`; antes caía a `P`.
- La versión de firmware se lee como número + sufijo (`R019-TH1` no da 191).
- `aplicar()` valida todos los comandos antes de enviar el primero.
- Los campos de modificadores/flags de la restauración salen como `-` (sin el espacio final que dejaba `cfgToCommands`).
- La respuesta de `GETALL` se da por terminada tras 1 s de silencio (tope 5 s) en vez de esperar una cantidad fija.
