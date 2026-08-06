import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const notificaciones = await prisma.notificacion.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const noLeidas = notificaciones.filter((n) => !n.leida).length;
  return NextResponse.json({ notificaciones, noLeidas });
}

const schema = z.union([
  z.object({ id: z.string().min(1) }),
  z.object({ all: z.literal(true) }),
]);

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }

  if ('all' in parsed.data) {
    await prisma.notificacion.updateMany({
      where: { userId: session.userId, leida: false },
      data: { leida: true },
    });
  } else {
    await prisma.notificacion.updateMany({
      where: { id: parsed.data.id, userId: session.userId },
      data: { leida: true },
    });
  }

  return NextResponse.json({ ok: true });
}
