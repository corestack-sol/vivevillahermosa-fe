import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const config = await prisma.configuracionAgenda.findUnique({ where: { userId: session.userId } });
  return NextResponse.json({ config });
}

const DIA_REGEX = /^[0-6](,[0-6]){0,6}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const schema = z.object({
  diasLaborables: z.string().regex(DIA_REGEX, 'Formato de días inválido').optional(),
  horaInicio: z.string().regex(HORA_REGEX, 'Formato de hora inválido (HH:mm)').optional(),
  horaFin: z.string().regex(HORA_REGEX, 'Formato de hora inválido (HH:mm)').optional(),
  duracionCitaMin: z.number().int().positive().max(480).optional(),
  recordatorioMinAntes: z.number().int().min(5).max(1440).optional(),
});

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.horaInicio && parsed.data.horaFin && parsed.data.horaInicio >= parsed.data.horaFin) {
    return NextResponse.json({ error: 'La hora de inicio debe ser antes que la hora de fin' }, { status: 400 });
  }

  const config = await prisma.configuracionAgenda.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json({ config });
}
