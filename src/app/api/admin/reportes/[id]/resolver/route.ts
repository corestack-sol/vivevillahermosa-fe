import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, registrarAccionAdmin } from '@/lib/adminAuth';

const schema = z.object({ estado: z.enum(['revisado', 'descartado']) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const existe = await prisma.reporteAnuncio.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });

  // updateMany con `estado: 'pendiente'` en el WHERE — mismo criterio que
  // solicitudes-revision/[id]/resolver: una sola operación atómica evita
  // que se pueda "resolver" el mismo reporte más de una vez (antes no
  // había ningún guard, solo el botón oculto en el frontend una vez
  // resuelto — trivial de saltar llamando la API directo, y dejaba
  // duplicar la entrada de auditoría).
  const claimed = await prisma.reporteAnuncio.updateMany({
    where: { id, estado: 'pendiente' },
    data: { estado: parsed.data.estado },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: 'Este reporte ya fue resuelto' }, { status: 400 });
  }

  await registrarAccionAdmin(admin.session.userId, 'resolver_reporte', id, parsed.data.estado);

  return NextResponse.json({ ok: true });
}
