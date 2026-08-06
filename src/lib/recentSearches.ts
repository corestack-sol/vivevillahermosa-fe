const KEY = 'recentSearches';
const MAX = 5;

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const q = query.trim();
  if (!q) return;
  const current = getRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase());
  const next = [q, ...current].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena) — no es crítico.
  }
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
