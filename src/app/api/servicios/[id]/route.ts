import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { publishServicioSchema } from '@/lib/publishServicioSchema';

/** Ficha pública de un proveedor — mismos campos que la lista, nunca contacto (ver contacto/route.ts). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const servicio = await prisma.servicioProveedor.findFirst({
    where: { id, activo: true },
    select: {
      id: true, categoria: true, nombre: true, descripcion: true,
      municipio: true, colonia: true, fotoDataUrl: true, createdAt: true,
    },
  });
  if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  return NextResponse.json(servicio);
}

/** Editar — solo el dueño real (userId real desde el día uno, sin el parche de emailCuenta que necesita Property). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const existente = await prisma.servicioProveedor.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  if (existente.userId !== session.userId) {
    return NextResponse.json({ error: 'No tienes permiso para editar este servicio' }, { status: 403 });
  }

  const body = await request.json();
  // `activo` es aparte del contenido validado por publishServicioSchema —
  // es el toggle de Pausar/Reactivar del panel "Mis servicios", no un
  // campo que la persona "escriba".
  const { activo, ...contenido } = body ?? {};
  const parsed = publishServicioSchema.partial().safeParse(contenido);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const servicio = await prisma.servicioProveedor.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.telefono ? { telefono: parsed.data.telefono.replace(/\s+/g, '') } : {}),
      ...(typeof activo === 'boolean' ? { activo } : {}),
    },
  });
  return NextResponse.json({ id: servicio.id });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const existente = await prisma.servicioProveedor.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  if (existente.userId !== session.userId) {
    return NextResponse.json({ error: 'No tienes permiso para eliminar este servicio' }, { status: 403 });
  }

  await prisma.servicioProveedor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
