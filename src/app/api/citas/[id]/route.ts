import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const schema = z.object({
  titulo: z.string().min(2).max(150).optional(),
  nombreCliente: z.string().min(2).max(100).optional(),
  telefonoCliente: z.string().max(30).optional().nullable(),
  emailCliente: z.string().email().optional().nullable().or(z.literal('')),
  notas: z.string().max(1000).optional().nullable(),
  fecha: z.string().min(1).optional(),
  duracionMin: z.number().int().positive().max(480).optional(),
  estado: z.enum(['confirmada', 'cancelada', 'completada']).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.cita.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

  const { fecha, emailCliente, telefonoCliente, notas, ...rest } = parsed.data;

  // A diferencia de POST /api/citas, aquí faltaba validar que `fecha` (si
  // se manda) sea una fecha real antes de guardarla — un string mal
  // formado producía un Invalid Date que Prisma intenta persistir tal cual.
  let fechaValidada: Date | undefined;
  if (fecha) {
    fechaValidada = new Date(fecha);
    if (Number.isNaN(fechaValidada.getTime())) {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
    }
  }

  const cita = await prisma.cita.update({
    where: { id },
    data: {
      ...rest,
      ...(fechaValidada ? { fecha: fechaValidada, recordatorioEnviado: false } : {}),
      ...(emailCliente !== undefined ? { emailCliente: emailCliente || null } : {}),
      ...(telefonoCliente !== undefined ? { telefonoCliente: telefonoCliente || null } : {}),
      ...(notas !== undefined ? { notas: notas || null } : {}),
    },
  });

  return NextResponse.json({ cita });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.cita.findFirst({ where: { id, userId: session.userId } });
  if (!existing) return NextResponse.json({ error: 'Cita no encontrada' }, { status: 404 });

  await prisma.cita.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
