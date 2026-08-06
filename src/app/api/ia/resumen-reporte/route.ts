import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { generarResumenReporte } from '@/lib/ai';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

const schema = z.object({
  totalPropiedades: z.number().nonnegative(),
  totalVistas: z.number().nonnegative(),
  totalContactos: z.number().nonnegative(),
  totalFavoritos: z.number().nonnegative(),
  porEstado: z.record(z.string(), z.number()),
  propiedades: z.array(z.object({
    titulo: z.string().max(200),
    vistas: z.number().nonnegative(),
    contactos: z.number().nonnegative(),
    favoritos: z.number().nonnegative(),
    estado: z.string().max(30),
  })).max(200),
});

export async function POST(request: Request) {
  try {
    // Solo tiene sentido para cuentas con sesión (el reporte es del panel
    // profesional) — a diferencia de fraude/anuncio/búsqueda, que corren
    // desde flujos públicos o de publicación.
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const ip = getClientIp(request);
    const limited = checkRateLimit(`ia:resumen:${ip}`, 15, 10 * 60 * 1000);
    if (!limited.ok) return rateLimitResponse(limited.resetAt);
    // Backstop global — menor exposición que el resto (requiere sesión),
    // pero una sola cuenta real todavía puede evadir el límite por IP con
    // X-Forwarded-For falso reusando su misma cookie de sesión.
    const global = checkRateLimit('ia:resumen:global', 100, 10 * 60 * 1000);
    if (!global.ok) return rateLimitResponse(global.resetAt);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const resumen = await generarResumenReporte(parsed.data, session.userId);
    return NextResponse.json({ resumen });
  } catch {
    return NextResponse.json({ error: 'Error al generar el resumen' }, { status: 500 });
  }
}
