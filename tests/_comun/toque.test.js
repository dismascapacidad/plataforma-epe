import {
  zonasToque,
  zonaDeToque,
  nombresZonas,
  crearFiltroToque,
  MANTENER_OPCIONES_MS,
  ESPERA_OPCIONES_MS,
  ESPERA_POR_DEFECTO_MS,
} from '../../js/features/apps-epe/_comun/toque.js';

describe('zonas de la pantalla', () => {
  it('automático: un solo evento ocupa toda la pantalla', () => {
    expect(zonasToque(['seleccionar'])).toEqual(['seleccionar']);
    expect(zonaDeToque(0, 800, ['seleccionar'])).toBe('seleccionar');
    expect(zonaDeToque(799, 800, ['seleccionar'])).toBe('seleccionar');
  });
  it('dirigido: izquierda avanza, derecha selecciona', () => {
    const zonas = zonasToque(['avanzar', 'seleccionar']);
    expect(zonas).toEqual(['avanzar', 'seleccionar']);
    expect(zonaDeToque(100, 800, zonas)).toBe('avanzar');
    expect(zonaDeToque(399, 800, zonas)).toBe('avanzar');
    expect(zonaDeToque(400, 800, zonas)).toBe('seleccionar');
    expect(zonaDeToque(700, 800, zonas)).toBe('seleccionar');
  });
  it('con retroceso: tres franjas, Retroceder a la izquierda', () => {
    const zonas = zonasToque(['seleccionar', 'avanzar', 'retroceder']);
    expect(zonas).toEqual(['retroceder', 'avanzar', 'seleccionar']);
    expect(zonaDeToque(50, 900, zonas)).toBe('retroceder');
    expect(zonaDeToque(450, 900, zonas)).toBe('avanzar');
    expect(zonaDeToque(850, 900, zonas)).toBe('seleccionar');
  });
  it('Reproducir queda en la franja más a la izquierda', () => {
    expect(zonasToque(['seleccionar', 'reproducir'])).toEqual(['reproducir', 'seleccionar']);
  });
  it('un toque fuera del área va a la franja del borde', () => {
    const zonas = ['avanzar', 'seleccionar'];
    expect(zonaDeToque(-20, 800, zonas)).toBe('avanzar');
    expect(zonaDeToque(900, 800, zonas)).toBe('seleccionar');
  });
  it('datos inválidos no dan zona', () => {
    expect(zonaDeToque(10, 800, [])).toBeNull();
    expect(zonaDeToque(10, 0, ['seleccionar'])).toBeNull();
    expect(zonaDeToque(NaN, 800, ['seleccionar'])).toBeNull();
  });
});

describe('nombres de las franjas', () => {
  it('hay un nombre por franja, de izquierda a derecha', () => {
    expect(nombresZonas(1)).toEqual(['Toda la pantalla']);
    expect(nombresZonas(2)).toEqual(['Izquierda', 'Derecha']);
    expect(nombresZonas(3)).toEqual(['Izquierda', 'Centro', 'Derecha']);
    expect(nombresZonas(4)).toHaveLength(4);
  });
});

describe('opciones de la interfaz', () => {
  it('el valor por defecto de espera es una de las opciones', () => {
    expect(ESPERA_OPCIONES_MS).toContain(ESPERA_POR_DEFECTO_MS);
    expect(MANTENER_OPCIONES_MS).toContain(0);
  });
});

/** Reloj y temporizadores falsos para no esperar de verdad. */
function entorno(opciones) {
  let t = 1000;
  let proximoId = 1;
  /** @type {Map<number, {en:number, fn:() => void}>} */
  const timers = new Map();
  const activadas = [];
  const filtro = crearFiltroToque({
    leer: () => opciones,
    alActivar: (z) => activadas.push(z),
    ahora: () => t,
    programar: (fn, ms) => {
      const id = proximoId++;
      timers.set(id, { en: t + ms, fn });
      return id;
    },
    cancelarTemporizador: (id) => timers.delete(id),
  });
  return {
    filtro,
    activadas,
    avanzar(ms) {
      t += ms;
      for (const [id, tm] of [...timers]) {
        if (tm.en <= t) {
          timers.delete(id);
          tm.fn();
        }
      }
    },
  };
}

describe('filtro de toques: sin tiempos', () => {
  it('activa al apoyar', () => {
    const e = entorno({ mantenerMs: 0, esperaMs: 0 });
    expect(e.filtro.apoyar('seleccionar')).toBe(true);
    expect(e.activadas).toEqual(['seleccionar']);
  });
  it('un segundo dedo con el primero apoyado no cuenta', () => {
    const e = entorno({ mantenerMs: 0, esperaMs: 0 });
    e.filtro.apoyar('avanzar');
    expect(e.filtro.apoyar('seleccionar')).toBe(false);
    expect(e.activadas).toEqual(['avanzar']);
    e.filtro.soltar();
    e.filtro.apoyar('seleccionar');
    expect(e.activadas).toEqual(['avanzar', 'seleccionar']);
  });
  it('una zona nula no activa nada', () => {
    const e = entorno({ mantenerMs: 0, esperaMs: 0 });
    expect(e.filtro.apoyar(null)).toBe(false);
    expect(e.activadas).toEqual([]);
  });
});

describe('filtro de toques: esperar entre toques', () => {
  it('ignora lo que llega dentro del tiempo de espera', () => {
    const e = entorno({ mantenerMs: 0, esperaMs: 500 });
    e.filtro.apoyar('seleccionar');
    e.filtro.soltar();
    e.avanzar(200);
    expect(e.filtro.apoyar('seleccionar')).toBe(false);
    e.filtro.soltar();
    expect(e.activadas).toEqual(['seleccionar']);
  });
  it('acepta pasado el tiempo de espera', () => {
    const e = entorno({ mantenerMs: 0, esperaMs: 500 });
    e.filtro.apoyar('seleccionar');
    e.filtro.soltar();
    e.avanzar(500);
    expect(e.filtro.apoyar('avanzar')).toBe(true);
    expect(e.activadas).toEqual(['seleccionar', 'avanzar']);
  });
  it('un toque descartado por la espera no se activa aunque se sostenga', () => {
    const e = entorno({ mantenerMs: 0, esperaMs: 1000 });
    e.filtro.apoyar('seleccionar');
    e.filtro.soltar();
    e.avanzar(100);
    e.filtro.apoyar('seleccionar');
    e.avanzar(2000);
    expect(e.activadas).toEqual(['seleccionar']);
  });
});

describe('filtro de toques: mantener al menos', () => {
  it('no activa al apoyar: espera a que pase el tiempo', () => {
    const e = entorno({ mantenerMs: 500, esperaMs: 0 });
    expect(e.filtro.apoyar('seleccionar')).toBe(true);
    expect(e.activadas).toEqual([]);
    e.avanzar(499);
    expect(e.activadas).toEqual([]);
    e.avanzar(1);
    expect(e.activadas).toEqual(['seleccionar']);
  });
  it('un toque corto no cuenta', () => {
    const e = entorno({ mantenerMs: 500, esperaMs: 0 });
    e.filtro.apoyar('seleccionar');
    e.avanzar(200);
    e.filtro.soltar();
    e.avanzar(1000);
    expect(e.activadas).toEqual([]);
  });
  it('un toque interrumpido por el navegador no cuenta', () => {
    const e = entorno({ mantenerMs: 500, esperaMs: 0 });
    e.filtro.apoyar('seleccionar');
    e.avanzar(100);
    e.filtro.cancelar();
    e.avanzar(1000);
    expect(e.activadas).toEqual([]);
  });
  it('la espera entre toques corre desde que se activó, no desde que se apoyó', () => {
    const e = entorno({ mantenerMs: 500, esperaMs: 400 });
    e.filtro.apoyar('seleccionar');
    e.avanzar(500); // activa
    e.filtro.soltar();
    e.avanzar(300);
    expect(e.filtro.apoyar('seleccionar')).toBe(false);
    e.filtro.soltar();
    e.avanzar(100);
    expect(e.filtro.apoyar('seleccionar')).toBe(true);
  });
});

describe('filtro de toques: los ajustes se leen en cada toque', () => {
  it('cambiar la configuración tiene efecto sin recrear el filtro', () => {
    const op = { mantenerMs: 0, esperaMs: 0 };
    const e = entorno(op);
    e.filtro.apoyar('seleccionar');
    e.filtro.soltar();
    op.esperaMs = 5000;
    e.avanzar(10);
    expect(e.filtro.apoyar('seleccionar')).toBe(false);
    expect(e.activadas).toEqual(['seleccionar']);
  });
});
