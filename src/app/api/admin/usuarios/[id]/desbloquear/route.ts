import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin, registrarAccionAdmin } from '@/lib/adminAuth';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;

  try {
    await prisma.user.update({
      where: { id },
      // bloqueoResueltoEn marca desde cuándo cuenta el próximo ciclo de
      // strikes (ver moderacionBusqueda.ts) — sin esto, el historial
      // acumulado de antes re-bloquearía a la cuenta con un solo intento
      // nuevo en vez de 3.
      data: { bloqueado: false, bloqueadoMotivo: null, bloqueadoEn: null, bloqueoResueltoEn: new Date() },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    throw err;
  }

  // Si había una SolicitudRevision pendiente de esta persona, este
  // desbloqueo manual la deja huérfana (nunca se marca resuelta) — sigue
  // apareciendo como "pendiente" en /admin/solicitudes aunque el problema
  // ya se resolvió por otra vía. Se cierra aquí para que la cola refleje
  // la realidad.
  await prisma.solicitudRevision.updateMany({
    where: { userId: id, estado: 'pendiente' },
    data: {
      estado: 'aprobada',
      respuestaAdmin: 'Cuenta desbloqueada directamente por un administrador (fuera de esta solicitud).',
      resueltoPorId: admin.session.userId,
      resueltoEn: new Date(),
    },
  });

  await registrarAccionAdmin(admin.session.userId, 'desbloquear_usuario', id);

  return NextResponse.json({ ok: true });
}
