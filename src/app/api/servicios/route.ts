import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { publishServicioSchema } from '@/lib/publishServicioSchema';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

/**
 * Directorio de servicios — exploratorio, no conectado a la navegación
 * principal todavía (ver docs/BACKEND.md). A
 * diferencia de /api/propiedades (catálogo estático), esto sí es una tabla
 * real en Prisma desde el día uno.
 *
 * GET es público — igual que el catálogo de propiedades, la lista/búsqueda
 * de proveedores no tiene nada sensible (el contacto vive aparte, ver
 * [id]/contacto/route.ts). NUNCA selecciona telefono/whatsapp/email aquí.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoria = searchParams.get('categoria') ?? undefined;
  const municipio = searchParams.get('municipio') ?? undefined;

  const servicios = await prisma.servicioProveedor.findMany({
    where: {
      activo: true,
      ...(categoria ? { categoria } : {}),
      ...(municipio ? { municipio } : {}),
    },
    select: {
      id: true, categoria: true, nombre: true, descripcion: true,
      municipio: true, colonia: true, fotoDataUrl: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(servicios);
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Inicia sesión para publicar un servicio' }, { status: 401 });

    const ip = getClientIp(request);
    const limited = checkRateLimit(`servicios:crear:${ip}`, 10, 10 * 60 * 1000);
    if (!limited.ok) return rateLimitResponse(limited.resetAt);

    const body = await request.json();
    const parsed = publishServicioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const servicio = await prisma.servicioProveedor.create({
      data: {
        userId: session.userId,
        categoria: parsed.data.categoria,
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion,
        municipio: parsed.data.municipio,
        colonia: parsed.data.colonia || null,
        telefono: parsed.data.telefono.replace(/\s+/g, ''),
        whatsapp: parsed.data.telefono.replace(/\s+/g, ''),
        email: parsed.data.email || null,
      },
    });

    return NextResponse.json({ id: servicio.id });
  } catch {
    return NextResponse.json({ error: 'Error al publicar el servicio' }, { status: 500 });
  }
}
