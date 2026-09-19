import { describe, it, expect } from 'vitest';
import { esErrorDeChunk, esScriptDeNextFallido, debeRecargar } from './chunkRecovery';

describe('esErrorDeChunk', () => {
  it('detecta ChunkLoadError por nombre', () => {
    const e = new Error('x');
    e.name = 'ChunkLoadError';
    expect(esErrorDeChunk(e)).toBe(true);
  });
  it('detecta los mensajes de Turbopack, webpack y de import dinámico', () => {
    expect(esErrorDeChunk(new Error('Failed to load chunk /_next/static/chunks/abc.js from module 123'))).toBe(true);
    expect(esErrorDeChunk(new Error('Loading chunk 42 failed.'))).toBe(true);
    expect(esErrorDeChunk(new TypeError('Failed to fetch dynamically imported module: https://x/a.js'))).toBe(true);
  });
  it('también acepta un string', () => {
    expect(esErrorDeChunk('ChunkLoadError: Loading chunk 7 failed')).toBe(true);
  });
  it('no confunde errores normales', () => {
    expect(esErrorDeChunk(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(esErrorDeChunk(new TypeError('Failed to fetch'))).toBe(false);
    expect(esErrorDeChunk(undefined)).toBe(false);
    expect(esErrorDeChunk({ message: 'ChunkLoadError' })).toBe(false);
  });
});

describe('esScriptDeNextFallido', () => {
  it('solo cuenta un <script> servido desde /_next/static/', () => {
    expect(esScriptDeNextFallido({ tagName: 'SCRIPT', src: 'https://x.com/_next/static/chunks/a.js' })).toBe(true);
  });
  it('ignora scripts de terceros, otras etiquetas y null', () => {
    expect(esScriptDeNextFallido({ tagName: 'SCRIPT', src: 'https://pagead2.googlesyndication.com/a.js' })).toBe(false);
    expect(esScriptDeNextFallido({ tagName: 'IMG', src: 'https://x.com/_next/static/a.png' })).toBe(false);
    expect(esScriptDeNextFallido(null)).toBe(false);
  });
});

describe('debeRecargar (candado anti-bucle)', () => {
  it('recarga la primera vez', () => {
    expect(debeRecargar(1_000_000, null)).toBe(true);
  });
  it('no recarga otra vez dentro de 30 s', () => {
    expect(debeRecargar(1_010_000, 1_000_000)).toBe(false);
    expect(debeRecargar(1_030_000, 1_000_000)).toBe(false);
  });
  it('vuelve a permitirlo pasada la ventana', () => {
    expect(debeRecargar(1_030_001, 1_000_000)).toBe(true);
  });
});
