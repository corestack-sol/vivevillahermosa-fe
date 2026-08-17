import type { MiPropiedad } from './misPropiedades';
import { backendFetch } from './backendApi';

export async function obtenerResumenReporte(propiedades: MiPropiedad[]): Promise<string | null> {
  if (propiedades.length === 0) return null;

  const porEstado: Record<string, number> = {};
  for (const p of propiedades) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1;

  try {
    const data = await backendFetch<{ resumen: string | null }>('/ia/resumen-reporte', {
      method: 'POST',
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
    return typeof data.resumen === 'string' ? data.resumen : null;
  } catch {
    return null;
  }
}
