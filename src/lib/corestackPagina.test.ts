import { describe, it, expect } from 'vitest';
import { construirPagina, escaparScript, fuenteTitulo, RUTA_LOGO } from './corestackPagina';

describe('página independiente de /corestack', () => {
  const html = construirPagina('window.__efecto=1;');

  it('es un documento completo, sin indexar y con el efecto incrustado', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta name="robots" content="noindex,nofollow">');
    expect(html).toContain('<script>window.__efecto=1;</script>');
  });
  it('trae los elementos que el efecto busca (escena, dos capas y el logo oclusor)', () => {
    for (const id of ['escena', 'rayos-fondo', 'rayos-sobre']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('data-rayos-oclusor');
    expect(html).toContain(`src="${RUTA_LOGO}"`);
  });
  it('precarga el logo con prioridad alta (es lo primero que se ve)', () => {
    expect(html).toMatch(/<link rel="preload" as="image" href="\/corestack\/logo\.png" fetchpriority="high">/);
  });
  it('no carga nada externo: ni scripts, ni estilos, ni fuentes', () => {
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
    expect(html).not.toMatch(/https?:\/\//);
  });
  it('escapa un "</script" dentro del código para no cerrar la etiqueta antes de tiempo', () => {
    expect(escaparScript('a</script>b</SCRIPT>')).toBe(String.raw`a<\/script>b<\/SCRIPT>`);
    expect(construirPagina('x="</script>"').match(/<\/script>/g)).toHaveLength(1);
  });
  it('incrusta la fuente del título como data URI (sin pedirla aparte) y la usa en el título', () => {
    const conFuente = construirPagina('x', 'QUJD');
    expect(conFuente).toContain(fuenteTitulo('QUJD'));
    expect(conFuente).toContain('src:url(data:font/woff2;base64,QUJD)');
    expect(conFuente).toMatch(/\.titulo\{[^}]*font-family:'Orbitron'/);
    expect(conFuente).not.toMatch(/url\((?!data:)[^)]*woff2/);
  });
});
