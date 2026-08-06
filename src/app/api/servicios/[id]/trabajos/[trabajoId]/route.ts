import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; trabajoId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id, trabajoId } = await params;
  const servicio = await prisma.servicioProveedor.findUnique({ where: { id } });
  if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  if (servicio.userId !== session.userId) {
    return NextResponse.json({ error: 'No tienes permiso para editar este portafolio' }, { status: 403 });
  }

  const trabajo = await prisma.trabajoServicio.findUnique({ where: { id: trabajoId } });
  if (!trabajo || trabajo.servicioId !== id) {
    return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 });
  }

  await prisma.trabajoServicio.delete({ where: { id: trabajoId } });
  return NextResponse.json({ ok: true });
}
