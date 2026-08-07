import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

/** A diferencia de GET /api/servicios (público, solo activos, sin contacto), esto lista todo con el dueño. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const servicios = await prisma.servicioProveedor.findMany({
    select: {
      id: true, categoria: true, nombre: true, municipio: true, colonia: true,
      activo: true, createdAt: true,
      user: { select: { email: true, nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200, // backstop — misma razón que solicitudes-revision/route.ts
  });

  return NextResponse.json({ servicios });
}
