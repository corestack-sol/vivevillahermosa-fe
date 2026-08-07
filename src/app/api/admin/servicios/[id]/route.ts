import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, registrarAccionAdmin } from '@/lib/adminAuth';

const schema = z.object({ activo: z.boolean() });

/** Toggle de activo con permiso de admin — bypassa el chequeo de dueño que tiene PATCH /api/servicios/:id. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const servicio = await prisma.servicioProveedor.update({
    where: { id },
    data: { activo: parsed.data.activo },
  }).catch(() => null);
  if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });

  await registrarAccionAdmin(admin.session.userId, parsed.data.activo ? 'activar_servicio' : 'desactivar_servicio', id);

  return NextResponse.json({ ok: true });
}
