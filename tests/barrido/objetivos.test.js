import {
  PALABRAS_DEFAULT,
  quitarTildes,
  palabraDesdeTexto,
  evaluarCopia,
  crearPractica,
  MAX_LARGO_PALABRA,
} from '../../js/features/apps-epe/barrido/objetivos.js';

describe('palabras', () => {
  it('quitar tildes conserva la Ñ', () => {
    expect(quitarTildes('MAMÁ')).toBe('MAMA');
    expect(quitarTildes('AÑO CANCIÓN')).toBe('AÑO CANCION');
  });
  it('las palabras con tilde se pronuncian con ella y se escriben sin ella', () => {
    const mama = PALABRAS_DEFAULT.find((p) => p.escritura === 'MAMA');
    expect(mama.pronunciacion).toBe('MAMÁ');
  });
});

describe('agregar una palabra propia', () => {
  it('acepta una palabra con tilde y guarda las dos formas', () => {
    const r = palabraDesdeTexto('canción');
    expect(r).toEqual({ ok: true, palabra: { escritura: 'CANCION', pronunciacion: 'CANCIÓN' } });
  });
  it('acepta varias palabras con un espacio entre ellas', () => {
    const r = palabraDesdeTexto('  buen    día ');
    expect(r.ok && r.palabra.escritura).toBe('BUEN DIA');
  });
  it('rechaza vacío, repetida, muy larga o con caracteres que el tablero no tiene', () => {
    expect(palabraDesdeTexto('   ').ok).toBe(false);
    expect(palabraDesdeTexto('sol', PALABRAS_DEFAULT).ok).toBe(false);
    expect(palabraDesdeTexto('a'.repeat(MAX_LARGO_PALABRA + 1)).ok).toBe(false);
    expect(palabraDesdeTexto('hola123').ok).toBe(false);
    expect(palabraDesdeTexto('hola!').ok).toBe(false);
  });
});

describe('evaluar la copia', () => {
  const sol = { escritura: 'SOL', pronunciacion: 'SOL' };
  it('sin escribir nada, todo pendiente', () => {
    const r = evaluarCopia('', sol);
    expect(r.letras.map((l) => l.estado)).toEqual(['pendiente', 'pendiente', 'pendiente']);
    expect(r.completa).toBe(false);
  });
  it('marca correctas e incorrectas, sin distinguir mayúsculas', () => {
    const r = evaluarCopia('sx', sol);
    expect(r.letras.map((l) => l.estado)).toEqual(['correcta', 'incorrecta', 'pendiente']);
    expect(r.errores).toBe(1);
  });
  it('completa solo si es exactamente la palabra', () => {
    expect(evaluarCopia('sol', sol).completa).toBe(true);
    expect(evaluarCopia('sola', sol).completa).toBe(false);
    expect(evaluarCopia('sola', sol).errores).toBe(1);
  });
  it('funciona con palabras con espacio', () => {
    const p = { escritura: 'EL SOL', pronunciacion: 'EL SOL' };
    expect(evaluarCopia('el sol', p).completa).toBe(true);
  });
});

describe('recorrer la lista de palabras', () => {
  it('arranca en la primera y pasa a la siguiente', () => {
    const p = crearPractica();
    expect(p.actual().escritura).toBe('SOL');
    expect(p.siguiente().escritura).toBe('OJO');
  });
  it('después de la última vuelve a la primera', () => {
    const p = crearPractica([
      { escritura: 'A', pronunciacion: 'A' },
      { escritura: 'B', pronunciacion: 'B' },
    ]);
    p.siguiente();
    expect(p.siguiente().escritura).toBe('A');
  });
  it('agregar deja la palabra nueva elegida; elegir una inexistente no cambia nada', () => {
    const p = crearPractica();
    p.agregar({ escritura: 'LUNA', pronunciacion: 'LUNA' });
    expect(p.actual().escritura).toBe('LUNA');
    p.elegir('NO EXISTE');
    expect(p.actual().escritura).toBe('LUNA');
    p.elegir('SOL');
    expect(p.actual().escritura).toBe('SOL');
  });
  it('no comparte la lista con quien la pasó', () => {
    const base = [{ escritura: 'A', pronunciacion: 'A' }];
    const p = crearPractica(base);
    p.agregar({ escritura: 'B', pronunciacion: 'B' });
    expect(base).toHaveLength(1);
  });
});
