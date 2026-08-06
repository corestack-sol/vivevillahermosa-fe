import type { MiPropiedad } from './misPropiedadesDemo';

/**
 * Llama a /api/ia/resumen-reporte desde el navegador — separado de
 * src/lib/ai.ts (que instancia el cliente de Gemini con la API key) porque
 * este archivo sí se importa desde componentes de cliente y nunca debe
 * arrastrar el SDK ni la key al bundle del navegador.
 */
export async function obtenerResumenReporte(propiedades: MiPropiedad[]): Promise<string | null> {
  if (propiedades.length === 0) return null;

  const porEstado: Record<string, number> = {};
  for (const p of propiedades) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1;

  try {
    const res = await fetch('/api/ia/resumen-reporte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalPropiedades: propiedades.length,
        totalVistas: propiedades.reduce((a, p) => a + p.vistas, 0),
        totalContactos: propiedades.reduce((a, p) => a + p.contactos, 0),
        totalFavoritos: propiedades.reduce((a, p) => a + p.favoritos, 0),
        porEstado,
        propiedades: propiedades.map((p) => ({
          titulo: p.property.titulo, vistas: p.vistas, contactos: p.contactos, favoritos: p.favoritos, estado: p.estado,
        })),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.resumen === 'string' ? data.resumen : null;
  } catch {
    return null;
  }
}
