import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, registrarAccionAdmin } from '@/lib/adminAuth';

const schema = z.object({ motivo: z.string().min(5, 'Explica brevemente el motivo').max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (id === admin.session.userId) {
    return NextResponse.json({ error: 'No puedes bloquear tu propia cuenta' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id },
      data: { bloqueado: true, bloqueadoMotivo: parsed.data.motivo, bloqueadoEn: new Date() },
    });
  } catch (err) {
    // Solo "no existe" se traduce a 404 — cualquier otro error real (ej.
    // base de datos caída) antes se disfrazaba igual de "no encontrado"
    // (`.catch(() => null)` atrapaba todo por igual), ocultando fallos de
    // infraestructura genuinos detrás de un mensaje que no les aplica.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    throw err;
  }

  await registrarAccionAdmin(admin.session.userId, 'bloquear_usuario', id, parsed.data.motivo);

  return NextResponse.json({ ok: true });
}
