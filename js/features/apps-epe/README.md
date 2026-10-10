# Apps EpE

Cada app o juego propio vive en su subcarpeta (`barrido/`, `hanoi/`, `nback/`,
`stroop/`, `simoneuro/`, `duracion-pulsacion/`, `comunicacion-cabeza/`), con
su página en `apps-epe/*.html` y sus estilos en `css/features/apps-epe/` o en
los componentes compartidos. Lo común está en `_comun/` (`acceso.js`,
`entrada.js`, `teclas.js`, voz).

## Dispositivo dis+capacidad

Las apps que se manejan con el dispositivo pueden usar el widget «Configurar
dispositivo». Guía completa, incluido «un botón, dos eventos» (Tap-Hold) y
cómo declararlo en una app nueva o en un recurso de terceros:
[`../configurar-dispositivo/README.md`](../configurar-dispositivo/README.md).

| App | Widget | Un botón, dos eventos |
|---|---|---|
| Barrido | sí | sí |
| Torre de Hanói | sí | sí |
| N-back | sí | sí |
| Stroop | sí | sí (avisa en el resumen) |
| SimoNeuro | sí | sí (avisa en el resumen) |
| Duración de pulsación | sí | no: mide el tiempo real de pulsación |

Piano, Lado Correcto y Vincular imagen-botón no usan barrido y por ahora no
combinan; sumarlos es una línea en su llamada a `abrir`.
