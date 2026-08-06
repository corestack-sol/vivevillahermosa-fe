import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { trabajoServicioSchema, MAX_TRABAJOS_POR_SERVICIO } from '@/lib/publishServicioSchema';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

/**
 * Portafolio de un proveedor — más reciente primero, como un blog. Si la
 * ficha está pausada (`activo: false`), se comporta igual que el resto de
 * la plataforma: invisible para cualquiera que no sea el dueño (antes esto
 * seguía siendo público sin importar el pausado, inconsistente con
 * `GET /api/servicios/[id]`, que sí lo respeta). El propio dueño sigue
 * viendo sus fotos aquí aunque esté pausada, para poder seguir gestionando
 * el portafolio desde el panel.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const servicio = await prisma.servicioProveedor.findUnique({ where: { id }, select: { userId: true, activo: true } });
  if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });

  if (!servicio.activo) {
    const session = await getSession();
    if (session?.userId !== servicio.userId) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
    }
  }

  const trabajos = await prisma.trabajoServicio.findMany({
    where: { servicioId: id },
    select: { id: true, imagenDataUrl: true, descripcion: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(trabajos);
}

/**
 * Agregar una entrada al portafolio — solo el dueño real. Pensado para
 * llenarse poco a poco (una foto hoy, otra la próxima semana), pero con un
 * tope (`MAX_TRABAJOS_POR_SERVICIO`) para no crecer sin límite: cada
 * entrada pesa hasta ~1.8MB en SQLite y la ficha pública no pagina.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const ip = getClientIp(request);
  const limited = checkRateLimit(`servicios-trabajos:ip:${ip}`, 20, 10 * 60 * 1000);
  if (!limited.ok) return rateLimitResponse(limited.resetAt);

  const { id } = await params;
  const servicio = await prisma.servicioProveedor.findUnique({ where: { id } });
  if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  if (servicio.userId !== session.userId) {
    return NextResponse.json({ error: 'No tienes permiso para editar este portafolio' }, { status: 403 });
  }

  const totalActual = await prisma.trabajoServicio.count({ where: { servicioId: id } });
  if (totalActual >= MAX_TRABAJOS_POR_SERVICIO) {
    return NextResponse.json(
      { error: `Llegaste al máximo de ${MAX_TRABAJOS_POR_SERVICIO} fotos en tu portafolio. Elimina alguna para agregar una nueva.` },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = trabajoServicioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const descripcion = parsed.data.descripcion?.trim();
  const trabajo = await prisma.trabajoServicio.create({
    data: {
      servicioId: id,
      imagenDataUrl: parsed.data.imagenDataUrl,
      descripcion: descripcion || null,
    },
  });
  return NextResponse.json({ id: trabajo.id });
}
