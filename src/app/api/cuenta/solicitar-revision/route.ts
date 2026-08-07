import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

const schema = z.object({
  email: z.string().email('Correo inválido').trim().toLowerCase(),
  motivo: z.string().min(10, 'Cuéntanos con un poco más de detalle qué pasó').max(1000),
});

const MENSAJE_GENERICO = { ok: true, mensaje: 'Recibimos tu solicitud — la revisaremos y te avisaremos por correo.' };

// Piso de duración mínima de respuesta — sin esto, el branch que SÍ existe
// (findUnique + create) tarda medible/sistemáticamente más que el branch
// que no encuentra nada, filtrando por tiempo de respuesta exactamente lo
// que el mensaje genérico de abajo busca ocultar (si el correo existe).
const DURACION_MINIMA_MS = 200;

/**
 * Público a propósito, sin sesión — una cuenta bloqueada NO PUEDE iniciar
 * sesión (login/OAuth la rechazan, y getSession() invalida hasta una
 * sesión ya activa, ver src/lib/auth.ts), así que nunca podría llegar a un
 * endpoint que la exigiera. Es el único camino real que tiene alguien para
 * pedir que se revise un bloqueo que cree injusto.
 *
 * Responde SIEMPRE el mismo mensaje genérico y en tiempo aproximadamente
 * constante, exista o no la cuenta, y sin importar si de verdad está
 * bloqueada — más estricto que el resto de la plataforma (registro/login
 * sí revelan si un correo existe), justificado porque el estado de
 * bloqueo de alguien es más sensible que la sola existencia de su cuenta.
 */
export async function POST(request: Request) {
  const inicio = Date.now();

  const ip = getClientIp(request);
  const limited = checkRateLimit(`solicitar-revision:ip:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return rateLimitResponse(limited.resetAt);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  // Solo cuentas REALMENTE bloqueadas — antes cualquier email existente
  // generaba una fila, aunque la cuenta nunca hubiera estado bloqueada,
  // ensuciando la cola de admin y arriesgando un correo confuso
  // ("reactivamos tu cuenta") a alguien que nunca perdió acceso.
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, bloqueado: true },
  });

  if (user?.bloqueado) {
    // Como mucho una solicitud pendiente a la vez por cuenta — reintentos
    // repetidos actualizan el motivo de la ya existente en vez de
    // amontonar filas nuevas en la cola.
    const pendiente = await prisma.solicitudRevision.findFirst({ where: { userId: user.id, estado: 'pendiente' } });
    if (pendiente) {
      await prisma.solicitudRevision.update({ where: { id: pendiente.id }, data: { motivo: parsed.data.motivo } });
    } else {
      await prisma.solicitudRevision.create({ data: { userId: user.id, motivo: parsed.data.motivo } });
    }
  }

  const transcurrido = Date.now() - inicio;
  if (transcurrido < DURACION_MINIMA_MS) {
    await new Promise((resolve) => setTimeout(resolve, DURACION_MINIMA_MS - transcurrido));
  }

  return NextResponse.json(MENSAJE_GENERICO);
}
