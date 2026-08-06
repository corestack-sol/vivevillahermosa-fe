import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { notificarAlertasCoincidentes } from '@/lib/alertaMatching';

const schema = z.object({
  id: z.string().min(1),
  titulo: z.string().min(1),
  tipo: z.string().min(1),
  operacion: z.string().min(1),
  municipio: z.string().min(1),
  precio: z.number().positive(),
  riesgoInundacion: z.enum(['alto', 'medio', 'bajo']),
});

/**
 * Dispara la comparación contra alertas guardadas cuando alguien completa el
 * formulario de publicar (ver PublishForm.tsx). No crea una propiedad real
 * en el catálogo — eso sigue pendiente del Módulo 1 (persistencia real) —
 * solo usa los datos enviados como la "candidata" a comparar. Ver
 * docs/BACKEND.md.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const limited = checkRateLimit(`alertas-notificar:${session.userId}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return rateLimitResponse(limited.resetAt);

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const matches = await notificarAlertasCoincidentes(parsed.data);
  return NextResponse.json({ matches });
}
