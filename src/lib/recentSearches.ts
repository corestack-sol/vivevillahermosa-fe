const MAX = 5;

// Escaneadas por cuenta (auditoría 2026-09-11 — mismo bug real que ya se
// corrigió en recentlyViewed.ts/publishDraft.ts/CompareContext.tsx: sin
// esto, cerrar sesión en una computadora compartida dejaba las búsquedas de
// texto libre de una persona visibles para la siguiente que usara el mismo
// navegador). `userId` null para quien no tiene sesión iniciada.
function clave(userId: string | null): string {
  return userId ? `recentSearches:${userId}` : 'recentSearches:anon';
}

export function getRecentSearches(userId: string | null): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(clave(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string, userId: string | null): void {
  const q = query.trim();
  if (!q) return;
  const current = getRecentSearches(userId).filter((s) => s.toLowerCase() !== q.toLowerCase());
  const next = [q, ...current].slice(0, MAX);
  try {
    localStorage.setItem(clave(userId), JSON.stringify(next));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena) — no es crítico.
  }
}

export function clearRecentSearches(userId: string | null): void {
  try {
    localStorage.removeItem(clave(userId));
  } catch {}
}
