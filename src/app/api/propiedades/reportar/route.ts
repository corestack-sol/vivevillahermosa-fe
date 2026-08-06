import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

const schema = z.object({
  propiedadId: z.string().min(1),
  motivo: z.enum(['info_falsa', 'precio_sospechoso', 'contenido_inapropiado', 'posible_fraude', 'otro']),
  comentario: z.string().max(500).optional(),
});

/**
 * ⚠️ BACKEND PENDIENTE (Fase 2) — este endpoint hoy es un stub que solo
 * valida la forma del reporte y responde éxito; NO persiste nada todavía.
 * Para llevarlo a producción falta:
 *
 * 1. Modelo `ReporteAnuncio` en prisma/schema.prisma:
 *      id, propiedadId, userId? (nullable — permitir reporte anónimo),
 *      motivo, comentario?, estado (pendiente|revisado|descartado),
 *      createdAt.
 * 2. Persistir el reporte con Prisma en vez de solo hacer console.log.
 * 3. Rate limiting por IP (ej. máx. 5 reportes/hora) para evitar abuso —
 *    alguien podría usar este endpoint para spamear reportes falsos contra
 *    un competidor y sacar su anuncio de circulación.
 * 4. Si una propiedad acumula N reportes (ej. 3+) de motivo
 *    "posible_fraude" o "info_falsa", marcarla automáticamente para
 *    revisión manual (`requiereModeracion = true`) en vez de esperar a
 *    que un admin la encuentre por casualidad.
 * 5. Notificar al equipo de moderación (email/Slack) cuando entre un
 *    reporte — ver Módulo 11 "Panel Admin Básico" en fase2-spec.md, que
 *    ya prevé una cola de moderación; este reporte debería alimentarla.
 *
 * El campo `userId` de abajo ya captura la sesión si existe, para que
 * cuando se implemente la persistencia no haya que tocar el frontend.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  // Sin este límite, cualquiera podía spamear reportes falsos contra un
  // anuncio de la competencia para sacarlo de circulación (riesgo señalado
  // en el punto 3 del comentario de arriba).
  const limited = checkRateLimit(`reportar:ip:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return rateLimitResponse(limited.resetAt);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Reporte inválido' }, { status: 400 });
  }

  const session = await getSession();

  // TODO: Fase 2 — reemplazar este log por prisma.reporteAnuncio.create({...})
  console.log('[reportar-anuncio] Nuevo reporte (no persistido):', {
    ...parsed.data,
    userId: session?.userId ?? null,
    fecha: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
