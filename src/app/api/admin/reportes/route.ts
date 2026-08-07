import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado') ?? undefined;

  const reportes = await prisma.reporteAnuncio.findMany({
    where: estado ? { estado } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200, // backstop — misma razón que solicitudes-revision/route.ts
  });

  return NextResponse.json({ reportes });
}
