/**
 * metricas.js
 * Registro de la sesión y resumen para el profesional. Puro: recibe tiempos
 * por parámetro.
 *
 * Qué se mide y por qué:
 * - Selecciones y tiempo mediano entre ellas: ritmo real de escritura.
 * - Intentos sin efecto ("fuera" / "sin puntero"): con pulsador, distinguen
 *   mala puntería de cámara que no ve la cara.
 * - % de tiempo sin puntero y eventos/s: salud del seguimiento (los eventos
 *   por segundo NO son los fps de la cámara).
 * - Temblor (desvío estándar de la posición) en ventanas de quietud.
 */

export function mediana(valores) {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function desvioEstandar(valores) {
  const v = valores.filter((x) => Number.isFinite(x));
  if (v.length < 2) return null;
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length);
}

const redondear = (x, d = 0) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);

/**
 * @param {{modo:string, dwellMs?:number, celdaMin?:number, layout?:string,
 *   descansoTam?:string|null}} config
 */
export function crearSesion(config, inicio) {
  const s = {
    config,
    inicio,
    fin: null,
    selecciones: [], // { t, id, tipo }
    intentosSinEfecto: { fuera: 0, 'sin-puntero': 0 },
    muestras: [], // { t, hayPuntero }
    eventosPuntero: 0,
    posiciones: [], // { x, y } de una ventana de quietud
    caracteres: 0,
    habladas: 0,
    recentrados: 0,
  };

  return {
    datos: s,
    seleccion(t, celda) {
      s.selecciones.push({ t, id: celda.id, tipo: celda.tipo });
      if (celda.tipo === 'letra') s.caracteres += 1;
      if (celda.valor === 'hablar') s.habladas += 1;
    },
    intentoSinEfecto(motivo) {
      if (motivo in s.intentosSinEfecto) s.intentosSinEfecto[motivo] += 1;
    },
    /** Una muestra periódica de si hay puntero fresco. */
    muestra(t, hayPuntero) {
      s.muestras.push({ t, hayPuntero: !!hayPuntero });
    },
    /** El usuario recentró el puntero (mucho recentrado = deriva o mala postura). */
    recentrado() {
      s.recentrados += 1;
    },
    eventoPuntero() {
      s.eventosPuntero += 1;
    },
    posicion(x, y) {
      s.posiciones.push({ x, y });
    },
    cerrar(t) {
      s.fin = t;
    },
    resumen(ahora) {
      const fin = s.fin ?? ahora;
      const durS = Math.max(0, (fin - s.inicio) / 1000);
      const ts = s.selecciones.map((x) => x.t);
      const intervalos = ts.slice(1).map((t, i) => (t - ts[i]) / 1000);
      const sin = s.muestras.filter((m) => !m.hayPuntero).length;
      const dx = desvioEstandar(s.posiciones.map((p) => p.x));
      const dy = desvioEstandar(s.posiciones.map((p) => p.y));
      return {
        modo: s.config.modo,
        dwellMs: s.config.modo === 'dwell' ? (s.config.dwellMs ?? null) : null,
        celdaMinPx: s.config.celdaMin ?? null,
        layout: s.config.layout ?? null,
        descansoTam: s.config.modo === 'dwell' ? (s.config.descansoTam ?? null) : null,
        duracionS: redondear(durS, 1),
        selecciones: s.selecciones.length,
        caracteres: s.caracteres,
        habladas: s.habladas,
        recentrados: s.recentrados,
        medianaEntreSeleccionesS: redondear(mediana(intervalos), 2),
        intentosFuera: s.intentosSinEfecto.fuera,
        intentosSinPuntero: s.intentosSinEfecto['sin-puntero'],
        pctSinPuntero: s.muestras.length ? redondear((sin / s.muestras.length) * 100, 0) : null,
        eventosPunteroPorS: durS > 0 ? redondear(s.eventosPuntero / durS, 1) : null,
        temblorPx: dx === null || dy === null ? null : redondear(Math.hypot(dx, dy), 1),
      };
    },
  };
}

const MODOS = { pulsador: 'Cabeza + pulsador', dwell: 'Cabeza + permanencia (dwell)' };

/** Resumen legible y copiable para la historia clínica o el chat. */
export function resumenTexto(r) {
  const l = [];
  l.push(`Comunicación con seguimiento de cabeza — ${MODOS[r.modo] || r.modo}`);
  if (r.dwellMs) l.push(`Permanencia: ${(r.dwellMs / 1000).toLocaleString('es-AR')} s`);
  if (r.layout) l.push(`Disposición del tablero: ${r.layout === 'qwerty' ? 'QWERTY' : 'ABC'}`);
  if (r.descansoTam) l.push(`Zona de descanso central: ${r.descansoTam}`);
  if (r.celdaMinPx) l.push(`Tamaño mínimo de celda configurado: ${r.celdaMinPx} px`);
  l.push(`Duración: ${r.duracionS} s`);
  l.push(`Selecciones: ${r.selecciones} (${r.caracteres} letras, ${r.habladas} veces HABLAR)`);
  if (r.medianaEntreSeleccionesS !== null) {
    l.push(`Tiempo mediano entre selecciones: ${r.medianaEntreSeleccionesS} s`);
  }
  if (r.recentrados > 0) l.push(`Recentrados del puntero: ${r.recentrados}`);
  if (r.modo === 'pulsador') {
    l.push(`Pulsaciones fuera de celda: ${r.intentosFuera}`);
    l.push(`Pulsaciones sin puntero (cámara sin ver la cara o en pausa): ${r.intentosSinPuntero}`);
  }
  if (r.pctSinPuntero !== null) l.push(`Tiempo sin puntero: ${r.pctSinPuntero} %`);
  if (r.eventosPunteroPorS !== null) l.push(`Eventos de puntero por s: ${r.eventosPunteroPorS}`);
  if (r.temblorPx !== null) l.push(`Temblor en quietud: ${r.temblorPx} px`);
  return l.join('\n');
}
