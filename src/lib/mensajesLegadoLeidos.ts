// El sistema viejo de contacto (contacto_propiedad) nunca expuso una
// acción de "marcar leído" en el backend — confirmado en vivo 2026-09-06,
// el campo `leido` de cada mensaje siempre vuelve tal cual se guardó, sin
// endpoint para cambiarlo. Se rastrea del lado del navegador (mismo
// patrón que recentlyViewed.ts) para que al menos en ESTE dispositivo el
// punto de "no leído" desaparezca después de abrir el mensaje — es un
// recordatorio por-navegador, no un estado real sincronizado entre
// dispositivos (eso necesitaría el endpoint que el backend no tiene).
// Escaneado por cuenta (auditoría 2026-09-11, mismo patrón que
// recentlyViewed.ts/recentSearches.ts) — impacto real bajo (cada mensajeId
// ya es único por conversación, no hay fuga de contenido entre cuentas),
// pero sin esto una cuenta nueva en el mismo navegador podía heredar
// puntos de "leído" que en realidad pertenecen a la sesión anterior.
function clave(userId: string | null): string {
  return userId ? `mensajesLegadoLeidos:${userId}` : 'mensajesLegadoLeidos:anon';
}

function leerSet(userId: string | null): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(clave(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function estaLegadoLeido(mensajeId: string, userId: string | null): boolean {
  return leerSet(userId).has(mensajeId);
}

export function marcarLegadoLeido(mensajeId: string, userId: string | null): void {
  const set = leerSet(userId);
  if (set.has(mensajeId)) return;
  set.add(mensajeId);
  try {
    localStorage.setItem(clave(userId), JSON.stringify([...set]));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena) — no es crítico.
  }
}
