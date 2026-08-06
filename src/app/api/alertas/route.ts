import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  municipio: z.string().optional(),
  tipo: z.string().optional(),
  operacion: z.enum(['venta', 'renta']).optional(),
  precioMax: z.number().positive().optional(),
  dosBocas: z.boolean().default(false),
  sinRiesgo: z.boolean().default(false),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const alertas = await prisma.alerta.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ alertas });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const alerta = await prisma.alerta.create({
    data: { userId: session.userId, ...parsed.data },
  });
  return NextResponse.json({ alerta });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  await prisma.alerta.deleteMany({ where: { id, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
