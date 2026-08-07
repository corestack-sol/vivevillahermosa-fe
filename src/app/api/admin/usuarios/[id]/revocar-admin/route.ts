import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin, registrarAccionAdmin } from '@/lib/adminAuth';

/**
 * Bloquea auto-revocarse cuando es el último admin — sin esto, alguien
 * podría dejar la plataforma sin ningún admin y sin ningún camino público
 * para volver a tener uno (el bootstrap, scripts/hacer-admin.ts, es manual
 * y fuera de la app, pero no hay razón para depender de eso por accidente).
 *
 * El chequeo "cuento, luego decido, luego escribo" en 3 pasos separados
 * tenía una ventana de carrera real: dos auto-revocaciones concurrentes
 * cuando quedan exactamente 2 admins podían leer `totalAdmins = 2` (pasa
 * el chequeo) ANTES de que cualquiera de las dos escribiera, dejando la
 * plataforma con 0 admins — justo lo que este chequeo existe para evitar.
 * `$transaction` con función agrupa el conteo y la escritura en una sola
 * transacción de Prisma, evitando esa ventana.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;

  let ultimoAdmin = false;
  let noEncontrado = false;

  await prisma.$transaction(async (tx) => {
    if (id === admin.session.userId) {
      const totalAdmins = await tx.user.count({ where: { esAdmin: true } });
      if (totalAdmins <= 1) {
        ultimoAdmin = true;
        return;
      }
    }
    try {
      await tx.user.update({ where: { id }, data: { esAdmin: false } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        noEncontrado = true;
        return;
      }
      throw err;
    }
  });

  if (ultimoAdmin) {
    return NextResponse.json({ error: 'No puedes quitarte el permiso de admin siendo el único que queda' }, { status: 400 });
  }
  if (noEncontrado) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  await registrarAccionAdmin(admin.session.userId, 'revocar_admin', id);

  return NextResponse.json({ ok: true });
}
