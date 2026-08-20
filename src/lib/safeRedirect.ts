/**
 * Sanitiza un destino de redirección post-login (`?next=...`) — sin esto,
 * un link como `/auth/login?next=https://sitio-malicioso.com` reenviaría al
 * usuario fuera del sitio justo después de autenticarse (open redirect).
 * Solo se aceptan rutas internas: empiezan con "/" y no con "//" ni con un
 * esquema (`https://` codificado, etc.).
 */
export function safeRedirectPath(path: string | null | undefined, fallback = '/dashboard'): string {
  if (!path) return fallback;
  // "\" cuenta como bypass real: los navegadores normalizan backslashes a
  // "/" al resolver una URL con esquema especial, así que "/\evil.com" (pasa
  // los 3 chequeos de abajo tal cual) puede resolver a "//evil.com" —
  // protocolo-relativo, redirect externo. Se rechaza cualquier backslash,
  // no solo el patrón exacto "//" al inicio.
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://') || path.includes('\\')) return fallback;
  return path;
}
