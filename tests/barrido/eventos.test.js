import {
  eventosActivos,
  asignarTecla,
  eventoDeTecla,
  validarTecla,
  entradasParaDispositivo,
  descripcionEvento,
  TECLAS_POR_DEFECTO,
  IDS_EVENTO,
} from '../../js/features/apps-epe/barrido/eventos.js';

describe('eventos activos', () => {
  it('automático: un solo evento, Seleccionar', () => {
    expect(eventosActivos({ metodo: 'auto' })).toEqual(['seleccionar']);
  });
  it('dirigido: Avanzar y Seleccionar', () => {
    expect(eventosActivos({ metodo: 'dirigido' })).toEqual(['avanzar', 'seleccionar']);
  });
  it('dirigido con retroceso: tres eventos', () => {
    expect(eventosActivos({ metodo: 'dirigido', conRetroceso: true })).toEqual([
      'avanzar',
      'seleccionar',
      'retroceder',
    ]);
  });
  it('Retroceder no cuenta en automático aunque esté tildado', () => {
    expect(eventosActivos({ metodo: 'auto', conRetroceso: true })).toEqual(['seleccionar']);
  });
  it('la reproducción por tecla suma el evento Reproducir', () => {
    expect(eventosActivos({ metodo: 'auto', reproduccion: 'tecla' })).toEqual([
      'seleccionar',
      'reproducir',
    ]);
  });
});

describe('teclas por defecto', () => {
  it('son distintas entre sí y cubren todos los eventos', () => {
    expect(Object.keys(TECLAS_POR_DEFECTO).sort()).toEqual([...IDS_EVENTO].sort());
    expect(new Set(Object.values(TECLAS_POR_DEFECTO)).size).toBe(IDS_EVENTO.length);
  });
});

describe('asignar tecla', () => {
  it('cambia la tecla de un evento', () => {
    const r = asignarTecla(TECLAS_POR_DEFECTO, 'avanzar', 'a');
    expect(r.teclas.avanzar).toBe('a');
    expect(r.intercambio).toBeNull();
  });
  it('normaliza a minúscula', () => {
    expect(asignarTecla(TECLAS_POR_DEFECTO, 'avanzar', 'A').teclas.avanzar).toBe('a');
  });
  it('si otro evento la usaba, se intercambian', () => {
    const r = asignarTecla(TECLAS_POR_DEFECTO, 'avanzar', 'l'); // l era de Seleccionar
    expect(r.teclas.avanzar).toBe('l');
    expect(r.teclas.seleccionar).toBe('k');
    expect(r.intercambio).toBe('seleccionar');
  });
  it('nunca deja dos eventos con la misma tecla', () => {
    let t = { ...TECLAS_POR_DEFECTO };
    for (const [id, tecla] of [
      ['avanzar', 'l'],
      ['retroceder', 'k'],
      ['reproducir', 'l'],
    ]) {
      t = asignarTecla(t, id, tecla).teclas;
      expect(new Set(Object.values(t)).size).toBe(IDS_EVENTO.length);
    }
  });
  it('no modifica el objeto original', () => {
    const original = { ...TECLAS_POR_DEFECTO };
    asignarTecla(original, 'avanzar', 'l');
    expect(original).toEqual(TECLAS_POR_DEFECTO);
  });
});

describe('validar tecla', () => {
  it('acepta letras, números y teclas con nombre', () => {
    expect(validarTecla('M')).toEqual({ ok: true, tecla: 'm' });
    expect(validarTecla(' ')).toEqual({ ok: true, tecla: ' ' });
    expect(validarTecla('ArrowLeft')).toEqual({ ok: true, tecla: 'arrowleft' });
  });
  it('rechaza Esc (reabre la configuración) y las teclas que no sirven solas', () => {
    expect(validarTecla('Escape').ok).toBe(false);
    expect(validarTecla('Shift').ok).toBe(false);
    expect(validarTecla('').ok).toBe(false);
  });
});

describe('qué evento dispara una tecla', () => {
  const activos = ['avanzar', 'seleccionar'];
  it('reconoce las teclas de los eventos activos', () => {
    expect(eventoDeTecla(TECLAS_POR_DEFECTO, activos, 'K')).toBe('avanzar');
    expect(eventoDeTecla(TECLAS_POR_DEFECTO, activos, 'l')).toBe('seleccionar');
  });
  it('ignora los eventos que no están activos', () => {
    expect(eventoDeTecla(TECLAS_POR_DEFECTO, activos, 'j')).toBeNull(); // Retroceder inactivo
    expect(eventoDeTecla(TECLAS_POR_DEFECTO, activos, 'x')).toBeNull();
  });
});

describe('para el dispositivo', () => {
  it('una entrada por evento activo, con la tecla cruda', () => {
    const r = entradasParaDispositivo({ ...TECLAS_POR_DEFECTO, avanzar: ' ' }, [
      'avanzar',
      'seleccionar',
    ]);
    expect(r).toEqual([
      { id: 'avanzar', etiqueta: 'Avanzar', tecla: ' ' },
      { id: 'seleccionar', etiqueta: 'Seleccionar', tecla: 'l' },
    ]);
  });
  it('la descripción de Seleccionar aclara que en automático el barrido avanza solo', () => {
    expect(descripcionEvento('seleccionar', 'auto')).toMatch(/avanza solo/);
    expect(descripcionEvento('seleccionar', 'dirigido')).not.toMatch(/avanza solo/);
  });
});
