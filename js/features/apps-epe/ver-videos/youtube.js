/**
 * youtube.js
 * Envoltorio del reproductor de YouTube (IFrame Player API) para "Ver videos con
 * pulsadores". Esconde los detalles de la API: carga el script de YouTube recién
 * cuando hace falta, crea el reproductor y ofrece cinco operaciones simples
 * (cargar, reproducir, pausar, siguiente, detener).
 *
 * Decisiones:
 * - NADA se pide a YouTube hasta que la persona elige una lista: ni el script ni
 *   el iframe. Mientras tanto la página no le avisa a Google de nada.
 * - Reproductor desde youtube-nocookie.com (no deja cookies hasta reproducir),
 *   sin controles propios (los botones son los de la app), sin teclado propio
 *   (`disablekb`), sin pantalla completa y sin videos relacionados de otros canales.
 * - El script `iframe_api` lo sirve Google: no admite versión fija ni SRI.
 * - Foco: el reproductor es otro documento. Si recibe el foco (por un toque o un
 *   clic), la página deja de recibir las teclas del pulsador. Por eso el iframe
 *   no entra en el orden de tabulación y, si igual toma el foco, se lo devolvemos
 *   a la página. NO se tapa el reproductor con una capa: las políticas de YouTube
 *   prohíben bloquear su funcionalidad.
 * - Si un video no se puede reproducir (error 100/101/150…), en una lista se salta
 *   al siguiente (hasta MAX_ERRORES_SEGUIDOS veces seguidas, para no girar sin fin).
 *
 * Script clásico. Namespace: EpeYoutube.
 */

var EpeYoutube = (function () {
  var API_SRC = "https://www.youtube.com/iframe_api";
  var HOST = "https://www.youtube-nocookie.com";
  var ESPERA_API_MS = 12000;
  var MAX_ERRORES_SEGUIDOS = 5;

  // Estados de YT.PlayerState.
  var ESTADO = { SIN_EMPEZAR: -1, TERMINO: 0, REPRODUCIENDO: 1, PAUSA: 2, CARGANDO: 3, LISTO: 5 };

  var promesaApi = null;

  // Carga el script de la API una sola vez. Si falla, el próximo intento reintenta.
  function cargarApi() {
    if (promesaApi) return promesaApi;
    promesaApi = new Promise(function (resolve, reject) {
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
        return;
      }
      var previo = window.onYouTubeIframeAPIReady;
      var timer = window.setTimeout(function () {
        reject(new Error("tiempo-agotado"));
      }, ESPERA_API_MS);
      window.onYouTubeIframeAPIReady = function () {
        window.clearTimeout(timer);
        if (typeof previo === "function") previo();
        resolve(window.YT);
      };
      var s = document.createElement("script");
      s.src = API_SRC;
      s.async = true;
      s.onerror = function () {
        window.clearTimeout(timer);
        reject(new Error("sin-conexion"));
      };
      document.head.appendChild(s);
    });
    promesaApi.catch(function () {
      promesaApi = null;
    });
    return promesaApi;
  }

  // Si el iframe se queda con el foco del teclado, se lo devolvemos a la página.
  function protegerFoco(iframe) {
    iframe.tabIndex = -1;
    window.addEventListener("blur", function () {
      window.setTimeout(function () {
        if (document.activeElement === iframe) {
          iframe.blur();
          window.focus();
        }
      }, 0);
    });
  }

  // opciones: { alEstado(codigo), alError(codigo, saltado), alBloqueo() }
  // Devuelve una promesa del controlador.
  function crear(contenedor, opciones) {
    return cargarApi().then(function (YT) {
      return new Promise(function (resolve) {
        var destino = document.createElement("div");
        contenedor.appendChild(destino);

        var variables = {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
        };
        // `origin` solo existe con http(s): con file:// no hay origen que declarar.
        if (/^https?:$/.test(window.location.protocol)) variables.origin = window.location.origin;

        var cargado = null; // { tipo, id } de lo que se pidió reproducir
        var errores = 0;
        var bucleAplicado = false;
        var player = null;

        function alCambiarEstado(ev) {
          if (ev.data === ESTADO.REPRODUCIENDO) errores = 0;
          // Una lista tiene que dar la vuelta al llegar al final: así "Siguiente" nunca
          // se queda sin respuesta. Se pide una vez, cuando ya hay lista cargada.
          if (cargado && cargado.tipo === "lista" && !bucleAplicado && ev.data !== ESTADO.SIN_EMPEZAR) {
            bucleAplicado = true;
            try {
              player.setLoop(true);
            } catch (e) {
              // Sin bucle: al terminar la lista, termina.
            }
          }
          if (opciones.alEstado) opciones.alEstado(ev.data);
        }

        function alFallar(ev) {
          errores++;
          var saltado = false;
          if (cargado && cargado.tipo === "lista" && ev.data !== 2 && errores <= MAX_ERRORES_SEGUIDOS) {
            try {
              player.nextVideo();
              saltado = true;
            } catch (e) {
              // Si no se puede saltar, se avisa igual.
            }
          }
          if (opciones.alError) opciones.alError(ev.data, saltado, errores > MAX_ERRORES_SEGUIDOS);
        }

        player = new YT.Player(destino, {
          host: HOST,
          width: "100%",
          height: "100%",
          playerVars: variables,
          events: {
            onReady: function () {
              var iframe = player.getIframe();
              iframe.title = "Reproductor de YouTube";
              protegerFoco(iframe);
              resolve({
                cargar: function (item) {
                  cargado = { tipo: item.tipo, id: item.id };
                  errores = 0;
                  bucleAplicado = false;
                  if (item.tipo === "lista") {
                    player.loadPlaylist({ list: item.id, listType: "playlist", index: 0 });
                  } else {
                    player.loadVideoById(item.id);
                  }
                },
                reproducir: function () {
                  if (cargado) player.playVideo();
                },
                pausar: function () {
                  if (cargado) player.pauseVideo();
                },
                // "ok", "video-unico" o "nada-cargado": la interfaz decide qué decir.
                siguiente: function () {
                  if (!cargado) return "nada-cargado";
                  if (cargado.tipo !== "lista") return "video-unico";
                  player.nextVideo();
                  return "ok";
                },
                detener: function () {
                  cargado = null;
                  try {
                    player.stopVideo();
                  } catch (e) {
                    // El reproductor ya no está.
                  }
                },
              });
            },
            onStateChange: alCambiarEstado,
            onError: alFallar,
            onAutoplayBlocked: function () {
              if (opciones.alBloqueo) opciones.alBloqueo();
            },
          },
        });
      });
    });
  }

  return { crear: crear, ESTADO: ESTADO };
})();
