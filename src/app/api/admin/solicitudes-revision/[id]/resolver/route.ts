import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, registrarAccionAdmin } from '@/lib/adminAuth';
import { sendSolicitudRevisionResueltaEmail } from '@/lib/email';

const schema = z.object({
  estado: z.enum(['aprobada', 'rechazada']),
  respuestaAdmin: z.string().max(1000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const solicitud = await prisma.solicitudRevision.findUnique({ where: { id }, include: { user: true } });
  if (!solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  if (solicitud.estado !== 'pendiente') {
    return NextResponse.json({ error: 'Esta solicitud ya fue resuelta' }, { status: 400 });
  }

  const aprobada = parsed.data.estado === 'aprobada';
  const titulo = aprobada ? 'Tu cuenta fue reactivada' : 'Resultado de tu solicitud de revisión';
  const mensaje = aprobada
    ? 'Revisamos tu solicitud y reactivamos tu cuenta — ya puedes iniciar sesión normalmente.'
    : `Revisamos tu solicitud y tu cuenta sigue bloqueada.${parsed.data.respuestaAdmin ? ` ${parsed.data.respuestaAdmin}` : ''}`;

  // updateMany con `estado: 'pendiente'` en el WHERE (no un
  // findUnique+update separados) para que la resolución sea una sola
  // operación atómica a nivel de motor: dos resoluciones concurrentes de
  // la MISMA solicitud (doble clic, reintento de red) ya no pueden pasar
  // ambas el chequeo de "pendiente" — solo la primera en escribir gana,
  // la segunda ve count=0 y sale. Antes el chequeo de arriba (líneas
  // previas) corría separado de la escritura, dejando una ventana donde
  // las dos requests podían leer "pendiente" antes de que cualquiera
  // escribiera, duplicando el correo/notificación/auditoría.
  const claimed = await prisma.solicitudRevision.updateMany({
    where: { id, estado: 'pendiente' },
    data: {
      estado: parsed.data.estado,
      respuestaAdmin: parsed.data.respuestaAdmin,
      resueltoPorId: admin.session.userId,
      resueltoEn: new Date(),
    },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: 'Esta solicitud ya fue resuelta' }, { status: 400 });
  }

  await prisma.$transaction([
    ...(aprobada
      ? [prisma.user.update({
          where: { id: solicitud.userId },
          data: { bloqueado: false, bloqueadoMotivo: null, bloqueadoEn: null, bloqueoResueltoEn: new Date() },
        })]
      : []),
    prisma.notificacion.create({ data: { userId: solicitud.userId, tipo: 'solicitud_revision_resuelta', titulo, mensaje } }),
  ]);

  await registrarAccionAdmin(admin.session.userId, 'resolver_solicitud_revision', id, parsed.data.estado);

  // Fuera de la transacción, sin bloquear la respuesta — si el correo
  // falla, la resolución ya quedó guardada (mismo criterio que el resto de
  // esta plataforma con los correos de alertas/citas: nunca dejar que un
  // envío caído tumbe una acción que ya sucedió de verdad). Es el único
  // canal que le llega a alguien si quedó rechazado: sigue bloqueado, no
  // puede iniciar sesión para ver la Notificacion in-app.
  void sendSolicitudRevisionResueltaEmail({
    to: solicitud.user.email,
    nombre: solicitud.user.nombre,
    estado: parsed.data.estado,
    respuestaAdmin: parsed.data.respuestaAdmin ?? null,
  }).catch((err) => console.error('[admin] Error enviando correo de resolución de revisión', err));

  return NextResponse.json({ ok: true });
}
