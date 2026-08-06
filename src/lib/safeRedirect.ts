/**
 * Sanitiza un destino de redirección post-login (`?next=...`) — sin esto,
 * un link como `/auth/login?next=https://sitio-malicioso.com` reenviaría al
 * usuario fuera del sitio justo después de autenticarse (open redirect).
 * Solo se aceptan rutas internas: empiezan con "/" y no con "//" ni con un
 * esquema (`https://` codificado, etc.).
 */
export function safeRedirectPath(path: string | null | undefined, fallback = '/dashboard'): string {
  if (!path) return fallback;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) return fallback;
  return path;
}
