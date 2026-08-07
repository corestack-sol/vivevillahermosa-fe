import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

/** Visor de AccionAdmin — sin esto este log tendría el mismo problema de "nadie lo lee" que ya tenía IntentoSospechoso. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(request.url);
  const adminId = searchParams.get('adminId') ?? undefined;
  const accion = searchParams.get('accion') ?? undefined;

  const acciones = await prisma.accionAdmin.findMany({
    where: {
      ...(adminId ? { adminId } : {}),
      ...(accion ? { accion } : {}),
    },
    include: { admin: { select: { email: true, nombre: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ acciones });
}
