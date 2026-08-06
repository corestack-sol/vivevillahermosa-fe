import { NextResponse } from 'next/server';
import { obtenerColoniasDescubiertas } from '@/lib/coloniaDiscovery';

/**
 * Alimenta el caché del lado del cliente en src/lib/colonias.ts —
 * `matchColonia`/`buscarColoniaEnTexto`/`getColoniaByKey` corren también en
 * el navegador (filters.ts, PropertiesClient.tsx), donde no se puede
 * consultar Prisma directamente. Público (sin sesión): es la misma
 * información geográfica que ya vive, sin protección, en el bundle
 * estático de colonias.ts — no hay nada sensible que proteger aquí.
 *
 * Cache corto en vez de "nunca": las colonias descubiertas cambian con
 * poca frecuencia (solo cuando alguien busca algo nuevo que Nominatim
 * resuelve), pero sí cambian con el tiempo — a diferencia del catálogo
 * estático, que solo cambia con un deploy.
 */
export async function GET() {
  const colonias = await obtenerColoniasDescubiertas();
  return NextResponse.json(colonias, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
  });
}
