import { NextResponse } from 'next/server';
import { z } from 'zod';
import { busquedaInteligente } from '@/lib/ai';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';
import { getSession } from '@/lib/auth';

const schema = z.object({
  query: z.string().min(1).max(300),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = checkRateLimit(`ia:busqueda:${ip}`, 30, 10 * 60 * 1000);
    if (!limited.ok) return rateLimitResponse(limited.resetAt);
    // Backstop global — el límite por IP de arriba se evade mandando un
    // X-Forwarded-For distinto en cada solicitud (ver getClientIp en
    // src/lib/rateLimit.ts). Esta cuenta es compartida entre todos los
    // usuarios, así que acota el peor caso aunque no distinga quién abusa.
    const global = checkRateLimit('ia:busqueda:global', 300, 10 * 60 * 1000);
    if (!global.ok) return rateLimitResponse(global.resetAt);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // Con sesión iniciada, un intento de manipular el buscador se registra
    // contra la cuenta (ver moderacionBusqueda.ts) — anónimo solo sigue el
    // rate-limit por IP de arriba, no tiene cuenta que avisar/bloquear.
    const session = await getSession();
    const filtros = await busquedaInteligente(parsed.data.query, session?.userId);
    return NextResponse.json(filtros);
  } catch {
    return NextResponse.json({ error: 'Error al interpretar la búsqueda' }, { status: 500 });
  }
}
