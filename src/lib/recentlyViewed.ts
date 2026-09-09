const MAX = 8;

// Escaneadas por cuenta — bug real reportado 2026-09-09: las claves de
// localStorage NO estaban asociadas a ninguna cuenta, sino al NAVEGADOR.
// Al eliminar una cuenta y registrar una nueva en el mismo navegador, "Mi
// panel" seguía mostrando el historial de la cuenta anterior (ej. "8
// vistos" en una cuenta recién creada que nunca vio nada) — y si dos
// personas distintas usan el mismo dispositivo, sus historiales se
// mezclaban sin ningún aviso. `userId` (o `null` para alguien sin sesión —
// el carrusel "vistos recientemente" del Home funciona igual sin login)
// separa cada cuenta en su propia clave — cuentas nuevas siempre arrancan
// en 0 porque nunca comparten clave con ninguna cuenta anterior (los IDs
// de cuenta son únicos, nunca se reciclan). El historial de ANTES de este
// cambio (una sola clave global, sin dueño claro) queda huérfano a
// propósito — no se migra a ninguna cuenta específica, sería perpetuar la
// misma mezcla que se está corrigiendo.
function claveRecientes(userId: string | null): string {
  return userId ? `recentlyViewedProperties:${userId}` : 'recentlyViewedProperties:anon';
}
function claveTotal(userId: string | null): string {
  return userId ? `viewedPropertiesAllTimeIds:${userId}` : 'viewedPropertiesAllTimeIds:anon';
}

export function getRecentlyViewedIds(userId: string | null): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(claveRecientes(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function getViewedCount(userId: string | null): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(claveTotal(userId));
    const todas = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    // Mismo criterio que la migración anterior (2026-09-08): el conteo
    // nunca debe ser menor que la lista "recientes" ya visible, se unen en
    // la LECTURA sin reescribir nada.
    for (const id of getRecentlyViewedIds(userId)) todas.add(id);
    return todas.size;
  } catch {
    return 0;
  }
}

export function addRecentlyViewed(propertyId: string, userId: string | null): void {
  if (!propertyId) return;
  const current = getRecentlyViewedIds(userId).filter((id) => id !== propertyId);
  const next = [propertyId, ...current].slice(0, MAX);
  try {
    localStorage.setItem(claveRecientes(userId), JSON.stringify(next));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena) — no es crítico.
  }
  try {
    const raw = localStorage.getItem(claveTotal(userId));
    const todas: string[] = raw ? JSON.parse(raw) : [];
    if (!todas.includes(propertyId)) {
      todas.push(propertyId);
      localStorage.setItem(claveTotal(userId), JSON.stringify(todas));
    }
  } catch {
    // Mismo caso que arriba — no crítico.
  }
}
