import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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

  // Toggle idempotente ante carrera: dos POST casi simultáneos (doble tap
  // en el corazón, o un reintento de red) pueden leer el mismo estado
  // "existing" antes de que cualquiera escriba. En vez de evitar la
  // carrera, se acepta que las dos escrituras compitan y se atrapa el
  // error esperado del perdedor — el resultado que importa (favorito
  // creado o borrado) ya lo logró el ganador, así que el perdedor solo
  // confirma el mismo estado final en vez de tronar con un 500.
  const existing = await prisma.favorito.findUnique({
    where: { userId_propiedadId: { userId: session.userId, propiedadId } },
  });

  if (existing) {
    try {
      await prisma.favorito.delete({ where: { id: existing.id } });
    } catch (err) {
      // P2025 = ya no existía (otro POST concurrente lo borró primero) —
      // el estado final deseado (sin favorito) ya se logró de todos modos.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025')) throw err;
    }
    return NextResponse.json({ favorito: false });
  }

  try {
    await prisma.favorito.create({ data: { userId: session.userId, propiedadId } });
  } catch (err) {
    // P2002 = ya existía (otro POST concurrente lo creó primero) — el
    // estado final deseado (favorito) ya se logró de todos modos.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
  }
  return NextResponse.json({ favorito: true });
}
