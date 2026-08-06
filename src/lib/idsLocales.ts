/**
 * Ids/slugs para propiedades creadas en el navegador (Publicar / Importar
 * CSV) — nunca chocan con los ids `prop-00N` del catálogo estático porque
 * llevan el prefijo `local-`. Ver src/lib/propiedadesLocales.ts.
 */
export function generarIdLocal(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function esPropiedadLocal(id: string): boolean {
  return id.startsWith('local-');
}

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function generarSlugLocal(titulo: string): string {
  const base = slugify(titulo) || 'propiedad';
  return `${base}-${Date.now().toString(36)}`;
}
