import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';
import { prisma } from '@/lib/db';

const schema = z.object({
  propiedadId: z.string().min(1),
  motivo: z.enum(['info_falsa', 'precio_sospechoso', 'contenido_inapropiado', 'posible_fraude', 'otro']),
  comentario: z.string().max(500).optional(),
});

/**
 * Persiste en `ReporteAnuncio` (antes era un stub que solo hacía
 * console.log, ver historial de este archivo) — un admin lo revisa desde
 * /admin/reportes (GET/POST /api/admin/reportes, requireAdmin()).
 *
 * `propiedadId` es una referencia libre sin FK, no valida contra ningún
 * catálogo — el reportado puede ser una propiedad del catálogo estático o
 * una publicada solo en el navegador de quien reporta (localStorage,
 * src/lib/propiedadesLocales.ts); en ese segundo caso un admin no podrá
 * verla desde el panel (no existe del lado del servidor), /admin/reportes
 * lo indica explícitamente en vez de mostrar un enlace roto en silencio.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  // Sin este límite, cualquiera podía spamear reportes falsos contra un
  // anuncio de la competencia para sacarlo de circulación.
  const limited = checkRateLimit(`reportar:ip:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return rateLimitResponse(limited.resetAt);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Reporte inválido' }, { status: 400 });
  }

  const session = await getSession();

  await prisma.reporteAnuncio.create({
    data: {
      propiedadId: parsed.data.propiedadId,
      motivo: parsed.data.motivo,
      comentario: parsed.data.comentario,
      userId: session?.userId ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
