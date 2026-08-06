import { NextResponse } from 'next/server';
import { z } from 'zod';
import { analizarFraude } from '@/lib/ai';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';
import { getSession } from '@/lib/auth';

// Antes aceptaba cualquier JSON sin validar (hallazgo M3 de la auditoría) —
// a diferencia del resto de la API, que sí usa Zod en todos los endpoints
// con entrada de usuario.
const schema = z.object({
  titulo: z.string().max(200),
  descripcion: z.string().max(5000),
  precio: z.number().nonnegative(),
  municipio: z.string().max(100),
  tipo: z.string().max(50),
  operacion: z.string().max(20),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    // Cada llamada dispara una consulta real a OpenRouter (ver src/lib/ai.ts) —
    // sin este límite, el endpoint queda abierto a abuso de costo desde
    // cualquier IP no autenticada.
    const limited = checkRateLimit(`ia:fraude:${ip}`, 20, 10 * 60 * 1000);
    if (!limited.ok) return rateLimitResponse(limited.resetAt);
    // Backstop global — ver comentario equivalente en
    // busqueda-inteligente/route.ts (el límite por IP se evade con
    // X-Forwarded-For falso).
    const global = checkRateLimit('ia:fraude:global', 200, 10 * 60 * 1000);
    if (!global.ok) return rateLimitResponse(global.resetAt);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // Con sesión iniciada, un intento de manipular el análisis se registra
    // contra la cuenta (ver moderacionBusqueda.ts) — este endpoint sigue
    // siendo llamable sin sesión (no todo publicador tiene por qué estar
    // autenticado hoy), en ese caso solo aplica el rate-limit por IP.
    const session = await getSession();
    const resultado = await analizarFraude(parsed.data, session?.userId);
    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ error: 'Error al analizar' }, { status: 500 });
  }
}
