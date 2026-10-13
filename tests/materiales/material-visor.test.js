// @ts-nocheck
// Los scripts clásicos (namespaces Epe*) no son módulos: se cargan leyendo el
// archivo y evaluándolo, con un EpeModal mínimo de reemplazo.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

function cargar(ruta, nombre) {
  const codigo = readFileSync(ruta, 'utf8');
  return new Function('EpeModal', 'EpeCatalogoMateriales', `${codigo}\nreturn ${nombre};`)({}, {});
}

const EpeMaterialVisor = cargar('js/core/material-visor.js', 'EpeMaterialVisor');
const { urlDriveValida } = EpeMaterialVisor;

describe('urlDriveValida', () => {
  it('acepta links https de Drive y Docs', () => {
    expect(urlDriveValida('https://drive.google.com/file/d/abc123/view')).toBe(
      'https://drive.google.com/file/d/abc123/view'
    );
    expect(urlDriveValida('  https://docs.google.com/document/d/xyz/edit  ')).toBe(
      'https://docs.google.com/document/d/xyz/edit'
    );
  });

  it('rechaza http, otros dominios y dominios que solo lo imitan', () => {
    expect(urlDriveValida('http://drive.google.com/file/d/1')).toBeNull();
    expect(urlDriveValida('https://example.com/file')).toBeNull();
    expect(urlDriveValida('https://drive.google.com.evil.com/x')).toBeNull();
    expect(urlDriveValida('https://evil.com/drive.google.com/')).toBeNull();
    expect(urlDriveValida('https://sub.drive.google.com/x')).toBeNull();
  });

  it('rechaza usuario, contraseña, puerto y esquemas peligrosos', () => {
    expect(urlDriveValida('https://user@drive.google.com/x')).toBeNull();
    expect(urlDriveValida('https://u:p@drive.google.com/x')).toBeNull();
    expect(urlDriveValida('https://drive.google.com:8443/x')).toBeNull();
    expect(urlDriveValida('javascript:alert(1)')).toBeNull();
  });

  it('rechaza vacíos, no-texto y links de más de 500 caracteres', () => {
    expect(urlDriveValida('')).toBeNull();
    expect(urlDriveValida('   ')).toBeNull();
    expect(urlDriveValida(null)).toBeNull();
    expect(urlDriveValida(42)).toBeNull();
    expect(urlDriveValida('https://drive.google.com/' + 'a'.repeat(500))).toBeNull();
  });
});
