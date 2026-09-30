import {
  partirOraciones,
  ordenarVoces,
  elegirVoz,
} from '../../js/features/apps-epe/comunicacion-cabeza/voz.js';

describe('partirOraciones', () => {
  it('vacío', () => expect(partirOraciones('   ')).toEqual([]));
  it('parte por signos', () => {
    expect(partirOraciones('Hola. Como estas? Bien!')).toEqual(['Hola.', 'Como estas?', 'Bien!']);
  });
  it('texto sin puntuación queda entero', () => {
    expect(partirOraciones('quiero agua')).toEqual(['quiero agua']);
  });
  it('oración larga se parte por palabras sin pasar el máximo', () => {
    const t = Array(60).fill('palabra').join(' ');
    const p = partirOraciones(t, 50);
    expect(p.every((x) => x.length <= 50)).toBe(true);
    expect(p.join(' ')).toBe(t);
  });
});

const voz = (name, lang, localService) => ({ name, lang, localService });
const VOCES = [
  voz('Microsoft Sabina - Spanish (Mexico)', 'es-MX', true),
  voz('Microsoft Elena Online (Natural) - Spanish (Argentina)', 'es-AR', false),
  voz('Microsoft David - English (US)', 'en-US', true),
];

describe('voces', () => {
  it('descarta las que no son español', () => {
    expect(ordenarVoces(VOCES).map((v) => v.lang)).not.toContain('en-US');
  });
  it('con red prefiere es-AR', () => expect(elegirVoz(VOCES).lang).toBe('es-AR'));
  it('sin red cae a la local', () => expect(elegirVoz(VOCES, { sinRed: true }).lang).toBe('es-MX'));
  it('respeta la guardada si existe', () => {
    expect(elegirVoz(VOCES, { nombrePreferido: VOCES[0].name }).name).toBe(VOCES[0].name);
  });
  it('sin voces devuelve null', () => expect(elegirVoz([])).toBeNull());
});
