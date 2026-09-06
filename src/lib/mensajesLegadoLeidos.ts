// El sistema viejo de contacto (contacto_propiedad) nunca expuso una
// acción de "marcar leído" en el backend — confirmado en vivo 2026-09-06,
// el campo `leido` de cada mensaje siempre vuelve tal cual se guardó, sin
// endpoint para cambiarlo. Se rastrea del lado del navegador (mismo
// patrón que recentlyViewed.ts) para que al menos en ESTE dispositivo el
// punto de "no leído" desaparezca después de abrir el mensaje — es un
// recordatorio por-navegador, no un estado real sincronizado entre
// dispositivos (eso necesitaría el endpoint que el backend no tiene).
const KEY = 'mensajesLegadoLeidos';

function leerSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function estaLegadoLeido(mensajeId: string): boolean {
  return leerSet().has(mensajeId);
}

export function marcarLegadoLeido(mensajeId: string): void {
  const set = leerSet();
  if (set.has(mensajeId)) return;
  set.add(mensajeId);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena) — no es crítico.
  }
}
