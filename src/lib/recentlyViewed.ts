const KEY = 'recentlyViewedProperties';
const MAX = 8;

export function getRecentlyViewedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(propertyId: string): void {
  if (!propertyId) return;
  const current = getRecentlyViewedIds().filter((id) => id !== propertyId);
  const next = [propertyId, ...current].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena) — no es crítico.
  }
}
