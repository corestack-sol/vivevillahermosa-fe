import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

/**
 * Primer consumidor real de esta tabla — antes de este panel, cada intento
 * confirmado se guardaba (ver registrarIntentoSospechoso en
 * src/lib/moderacionBusqueda.ts) pero nadie lo revisaba nunca: la propia
 * función que lee un historial por usuario, `obtenerHistorialSospechoso`,
 * ya admitía en su comentario "no hay todavía una vista de admin que lo
 * consuma".
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') ?? undefined;

  const intentos = await prisma.intentoSospechoso.findMany({
    where: userId ? { userId } : undefined,
    include: { user: { select: { email: true, nombre: true, bloqueado: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ intentos });
}
