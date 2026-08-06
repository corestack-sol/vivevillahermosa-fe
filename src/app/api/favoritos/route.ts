import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const favoritos = await prisma.favorito.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ favoritos: favoritos.map((f) => f.propiedadId) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { propiedadId } = await request.json();
  if (!propiedadId) return NextResponse.json({ error: 'propiedadId requerido' }, { status: 400 });

  const existing = await prisma.favorito.findUnique({
    where: { userId_propiedadId: { userId: session.userId, propiedadId } },
  });

  if (existing) {
    await prisma.favorito.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorito: false });
  }

  await prisma.favorito.create({ data: { userId: session.userId, propiedadId } });
  return NextResponse.json({ favorito: true });
}
