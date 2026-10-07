/**
 * voz.js
 * Lógica pura de la voz: partir en oraciones y elegir voz. La reproducción
 * (speechSynthesis) vive en voz-web.js.
 *
 * Por qué se parte: en Chrome/Edge una locución larga se corta a los ~14 s.
 * Partir por oraciones (y, si una oración es muy larga, por palabras) lo evita.
 *
 * Movido desde js/features/apps-epe/comunicacion-cabeza/ (06/10/2026): lo
 * usa también SimoNeuro, así que pasa a ser compartido entre apps en vez de
 * vivir adentro de una sola — mismo criterio que teclas.js/entrada.js/
 * acceso.js. `comunicacion-cabeza/main.js` importa desde acá ahora.
 */

/** Parte `texto` en trozos de a lo sumo `maxLargo` caracteres. */
export function partirOraciones(texto, maxLargo = 180) {
  const limpio = String(texto || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!limpio) return [];
  const oraciones = limpio.match(/[^.!?¡¿]+[.!?]*/g) || [limpio];
  const trozos = [];
  for (const o of oraciones) {
    const oracion = o.trim();
    if (!oracion) continue;
    if (oracion.length <= maxLargo) {
      trozos.push(oracion);
      continue;
    }
    let actual = '';
    for (const palabra of oracion.split(' ')) {
      if (actual && (actual + ' ' + palabra).length > maxLargo) {
        trozos.push(actual);
        actual = palabra;
      } else {
        actual = actual ? actual + ' ' + palabra : palabra;
      }
    }
    if (actual) trozos.push(actual);
  }
  return trozos;
}

/** Puntaje de preferencia: es-AR > otros es-* rioplatenses > es-* locales > resto de es. */
function puntaje(v) {
  const lang = String(v.lang || '')
    .replace('_', '-')
    .toLowerCase();
  if (!lang.startsWith('es')) return -1;
  let p = 1;
  if (lang === 'es-ar') p += 10;
  else if (lang === 'es-uy') p += 6;
  else if (lang === 'es-mx' || lang === 'es-us') p += 3;
  // Las locales andan sin internet; las "online" pueden fallar sin red.
  if (v.localService) p += 2;
  if (/natural/i.test(v.name || '')) p += 1;
  return p;
}

/** Voces en español ordenadas de mejor a peor candidata. */
export function ordenarVoces(voces) {
  return (voces || [])
    .map((v) => ({ v, p: puntaje(v) }))
    .filter((x) => x.p >= 0)
    .sort((a, b) => b.p - a.p || String(a.v.name).localeCompare(String(b.v.name)))
    .map((x) => x.v);
}

/**
 * Elige la voz: la guardada por nombre si sigue existiendo; si no, la mejor.
 * Con `sinRed` se prefieren las locales.
 */
export function elegirVoz(voces, { nombrePreferido = null, sinRed = false } = {}) {
  const lista = ordenarVoces(voces);
  if (nombrePreferido) {
    const guardada = lista.find((v) => v.name === nombrePreferido);
    if (guardada && !(sinRed && !guardada.localService)) return guardada;
  }
  if (sinRed) {
    const local = lista.find((v) => v.localService);
    if (local) return local;
  }
  return lista[0] || null;
}
