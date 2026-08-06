/**
 * Construye el link de login que regresa al usuario exactamente a donde
 * estaba — no a un destino fijo. Se usa en cualquier acción que requiera
 * sesión sobre una página que en sí misma es pública (contactar, guardar en
 * favoritos), a diferencia de /publicar o /dashboard, que están protegidas
 * como página completa en el proxy (src/proxy.ts).
 */
export function loginRedirectUrl(currentPath: string): string {
  return `/auth/login?next=${encodeURIComponent(currentPath)}`;
}
