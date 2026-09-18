/**
 * Construye el link de login que regresa al usuario exactamente a donde
 * estaba — no a un destino fijo. Se usa en cualquier acción que requiera
 * sesión sobre una página que en sí misma es pública (contactar, guardar en
 * favoritos), a diferencia de /publicar o /dashboard, que están protegidas
 * como página completa por el layout de su carpeta (getSession()).
 *
 * Desde una página de /auth (login, registro...) no se manda `next`: volver
 * ahí después de iniciar sesión dejaba a la persona en el formulario de
 * login aunque ya tenía sesión.
 */
export function loginRedirectUrl(currentPath: string): string {
  if (currentPath === '/auth' || currentPath.startsWith('/auth/')) return '/auth/login';
  return `/auth/login?next=${encodeURIComponent(currentPath)}`;
}

/**
 * Destino del botón "Publicar gratis". /publicar exige sesión (rebota a
 * login del lado del servidor) — sin sesión conocida se manda directo al
 * login con `next`, en vez de pasar por /publicar solo para que el servidor
 * rebote: esa ida y vuelta se veía como un salto entre páginas, sobre todo
 * estando ya en el login. Mientras la sesión carga se asume que sí hay una,
 * para no mandar a login a quien ya la tiene.
 */
export function publicarHref(cargandoSesion: boolean, hayUsuario: boolean): string {
  return !cargandoSesion && !hayUsuario ? loginRedirectUrl('/publicar') : '/publicar';
}
