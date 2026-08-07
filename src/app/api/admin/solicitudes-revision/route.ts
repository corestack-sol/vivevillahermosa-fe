import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado') ?? undefined;

  const solicitudes = await prisma.solicitudRevision.findMany({
    where: estado ? { estado } : undefined,
    include: { user: { select: { email: true, nombre: true, bloqueado: true, bloqueadoMotivo: true, bloqueadoEn: true } } },
    orderBy: { createdAt: 'desc' },
    // Backstop — sin esto, la lista crece sin cota con el tiempo (mismo
    // criterio que ya usan intentos-sospechosos y auditoria).
    take: 200,
  });

  return NextResponse.json({ solicitudes });
}
