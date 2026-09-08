const KEY = 'recentlyViewedProperties';
const MAX = 8;

// Set separado, SIN tope — el de arriba (KEY/MAX) es para el carrusel "vistos
// recientemente" (correcto que muestre solo los últimos 8). El dashboard
// reusaba `getRecentlyViewedIds().length` como si fuera "cuántas propiedades
// distintas viste en total" — bug real reportado 2026-09-08: pasadas 8
// propiedades distintas, ese número queda pegado en 8 para siempre por más
// que se sigan viendo propiedades nuevas, aunque el carrusel de abajo sí
// rotaba bien. Dos conceptos distintos necesitan dos datos distintos.
const KEY_TOTAL = 'viewedPropertiesAllTimeIds';

export function getRecentlyViewedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function getViewedCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(KEY_TOTAL);
    return raw ? (JSON.parse(raw) as string[]).length : 0;
  } catch {
    return 0;
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
  try {
    const raw = localStorage.getItem(KEY_TOTAL);
    const todas: string[] = raw ? JSON.parse(raw) : [];
    if (!todas.includes(propertyId)) {
      todas.push(propertyId);
      localStorage.setItem(KEY_TOTAL, JSON.stringify(todas));
    }
  } catch {
    // Mismo caso que arriba — no crítico.
  }
}
