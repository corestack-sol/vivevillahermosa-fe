// Fricción anti-spam del lado cliente (auditoría 2026-09-11): el reporte
// de anuncios es anónimo por diseño (ReportButton.tsx no requiere sesión),
// así que esto es memoria de NAVEGADOR, no de cuenta — a propósito NO se
// escanea por userId (a diferencia de recentlyViewed.ts/publishDraft.ts):
// lo que se recuerda es "esta propiedad ya se reportó desde este
// navegador", sin importar si hay sesión iniciada o con cuál cuenta. Esto
// no reemplaza una defensa real del backend (rate-limit/deduplicación por
// IP+propiedadId) — cualquiera puede saltarlo borrando localStorage — solo
// evita el caso más tonto: cerrar y reabrir el modal, o recargar la
// página, para reenviar el mismo reporte varias veces sin querer.
const KEY = 'reportedProperties';

function leerSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function yaReportada(propiedadId: string): boolean {
  return leerSet().has(propiedadId);
}

export function marcarReportada(propiedadId: string): void {
  const set = leerSet();
  if (set.has(propiedadId)) return;
  set.add(propiedadId);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena) — no es crítico.
  }
}
