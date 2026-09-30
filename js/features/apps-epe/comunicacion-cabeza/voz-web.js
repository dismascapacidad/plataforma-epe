/**
 * voz-web.js
 * Reproducción por voz con la Web Speech API. La lógica pura (partir en
 * oraciones, elegir voz) está en voz.js.
 *
 * Detalles que importan:
 * - Las voces cargan de forma asíncrona (`voiceschanged`): la lista puede
 *   estar vacía al principio.
 * - Se habla por oraciones, en cola: evita el corte de ~14 s de Chrome/Edge.
 * - Cancelar (`cancel()`) dispara `error: interrupted/canceled` en la
 *   locución en curso; eso no es una falla y no se informa como tal.
 * - Las voces "online" (es-AR Natural en Edge) necesitan red: si falla, se
 *   avisa y no se queda callada en silencio.
 */
import { partirOraciones } from './voz.js';

export function crearVoz() {
  const sintetizador = window.speechSynthesis || null;
  let generacion = 0; // invalida colas viejas al parar o volver a hablar

  function listarVoces() {
    return sintetizador ? sintetizador.getVoices() : [];
  }

  function alCambiarVoces(cb) {
    if (!sintetizador) return;
    sintetizador.addEventListener('voiceschanged', cb);
  }

  function parar() {
    generacion += 1;
    if (sintetizador) sintetizador.cancel();
  }

  /**
   * @param {string} texto
   * @param {{voz?:SpeechSynthesisVoice|null, velocidad?:number,
   *   alEmpezar?:()=>void, alTerminar?:()=>void, alFallar?:(motivo:string)=>void}} op
   */
  function hablar(texto, { voz = null, velocidad = 1, alEmpezar, alTerminar, alFallar } = {}) {
    if (!sintetizador) {
      alFallar?.('Este navegador no tiene texto a voz.');
      return;
    }
    const trozos = partirOraciones(texto);
    if (trozos.length === 0) return;
    parar();
    const miGeneracion = generacion;
    let i = 0;

    const siguiente = () => {
      if (miGeneracion !== generacion) return;
      if (i >= trozos.length) {
        alTerminar?.();
        return;
      }
      const u = new SpeechSynthesisUtterance(trozos[i]);
      u.lang = voz?.lang || 'es-AR';
      if (voz) u.voice = voz;
      u.rate = velocidad;
      if (i === 0) u.onstart = () => alEmpezar?.();
      u.onend = () => {
        i += 1;
        siguiente();
      };
      u.onerror = (e) => {
        if (miGeneracion !== generacion) return; // cancelada a propósito
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        alFallar?.(
          voz && !voz.localService
            ? 'La voz elegida necesita internet y no respondió. Probá con una voz local.'
            : `La voz falló (${e.error}).`,
        );
      };
      sintetizador.speak(u);
    };
    siguiente();
  }

  return { disponible: !!sintetizador, listarVoces, alCambiarVoces, hablar, parar };
}
