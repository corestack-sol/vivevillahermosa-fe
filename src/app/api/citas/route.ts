import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');

  const citas = await prisma.cita.findMany({
    where: {
      userId: session.userId,
      ...(desde || hasta ? {
        fecha: {
          ...(desde ? { gte: new Date(desde) } : {}),
          ...(hasta ? { lte: new Date(hasta) } : {}),
        },
      } : {}),
    },
    orderBy: { fecha: 'asc' },
  });

  return NextResponse.json({ citas });
}

const schema = z.object({
  propiedadId: z.string().optional().nullable(),
  titulo: z.string().min(2).max(150),
  nombreCliente: z.string().min(2).max(100),
  telefonoCliente: z.string().max(30).optional().nullable(),
  emailCliente: z.string().email().optional().nullable().or(z.literal('')),
  notas: z.string().max(1000).optional().nullable(),
  fecha: z.string().datetime().or(z.string().min(1)), // ISO string desde el cliente
  duracionMin: z.number().int().positive().max(480).default(30),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const limited = checkRateLimit(`citas-crear:${session.userId}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return rateLimitResponse(limited.resetAt);

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const fecha = new Date(parsed.data.fecha);
  if (Number.isNaN(fecha.getTime())) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
  }

  const cita = await prisma.cita.create({
    data: {
      userId: session.userId,
      propiedadId: parsed.data.propiedadId || null,
      titulo: parsed.data.titulo,
      nombreCliente: parsed.data.nombreCliente,
      telefonoCliente: parsed.data.telefonoCliente || null,
      emailCliente: parsed.data.emailCliente || null,
      notas: parsed.data.notas || null,
      fecha,
      duracionMin: parsed.data.duracionMin,
    },
  });

  return NextResponse.json({ cita });
}
