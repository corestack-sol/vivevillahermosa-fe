import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin, registrarAccionAdmin } from '@/lib/adminAuth';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;

  try {
    await prisma.user.update({ where: { id }, data: { esAdmin: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    throw err;
  }

  await registrarAccionAdmin(admin.session.userId, 'promover_admin', id);

  return NextResponse.json({ ok: true });
}
