import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generarDescripcionAnuncio } from '@/lib/ai';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';
import { getSession } from '@/lib/auth';

// Ver comentario equivalente en analizar-fraude/route.ts (hallazgo M3).
const schema = z.object({
  tipo: z.string().max(50),
  operacion: z.string().max(20),
  colonia: z.string().max(150),
  municipio: z.string().max(100),
  metros: z.number().nonnegative(),
  precio: z.number().nonnegative(),
  recamaras: z.number().nonnegative().optional(),
  banos: z.number().nonnegative().optional(),
  amenidades: z.array(z.string().max(80)).max(30).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = checkRateLimit(`ia:anuncio:${ip}`, 20, 10 * 60 * 1000);
    if (!limited.ok) return rateLimitResponse(limited.resetAt);
    // Backstop global — ver comentario equivalente en
    // busqueda-inteligente/route.ts (el límite por IP se evade con
    // X-Forwarded-For falso).
    const global = checkRateLimit('ia:anuncio:global', 150, 10 * 60 * 1000);
    if (!global.ok) return rateLimitResponse(global.resetAt);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // Ver comentario equivalente en analizar-fraude/route.ts.
    const session = await getSession();
    const descripcion = await generarDescripcionAnuncio(parsed.data, session?.userId);
    return NextResponse.json({ descripcion });
  } catch {
    return NextResponse.json({ error: 'Error al generar descripción' }, { status: 500 });
  }
}
