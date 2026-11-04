import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validarTeclas, urlSegura } from '../../js/features/configurar-dispositivo/teclas-externas.js';

// Lee la migración y comprueba que lo que carga pasa la validación estricta de la
// plataforma: si no, el recurso quedaría sin el botón «Configurar mi dispositivo y abrir».
const sql = readFileSync(new URL('../../supabase/028_recurso_comunicador_nogalespt.sql', import.meta.url), 'utf8');

function teclasDelSql() {
  const m = sql.match(/'(\[[\s\S]*?\])'::jsonb/);
  if (!m) throw new Error('No se encontró la lista de teclas en la migración 028');
  return JSON.parse(m[1]);
}

describe('028 — Comunicador NogalesPT', () => {
  it('las teclas pasan la validación y son flecha derecha y Enter, combinables', () => {
    const r = validarTeclas(teclasDelSql());
    expect(r).toEqual([
      { id: 'avanzar', etiqueta: 'Avanzar (flecha derecha)', tipo: 'tecla', tecla: 'arrowright', combinable: true },
      { id: 'seleccionar', etiqueta: 'Seleccionar (Enter)', tipo: 'tecla', tecla: 'enter', combinable: true },
    ]);
  });

  it('la URL es https y válida', () => {
    const m = sql.match(/'(https:\/\/nogalespt\.app\/comunicador\/)'/);
    expect(m).not.toBeNull();
    expect(urlSegura(m && m[1])).toBe('https://nogalespt.app/comunicador/');
  });

  it('trae los 7 pasos de activación del barrido', () => {
    for (let n = 1; n <= 7; n++) expect(sql).toContain(`\n${n}. `);
  });
});
