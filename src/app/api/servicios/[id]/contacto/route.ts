import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

/**
 * Mismo patrón exacto que /api/propiedades/[id]/contacto: revelado
 * instantáneo con sesión iniciada, cero acceso anónimo — sin esto, el
 * teléfono de cualquier proveedor sería raspable en lote por cualquiera.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Inicia sesión para ver el contacto' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limited = checkRateLimit(`servicios-contacto:ip:${ip}`, 30, 10 * 60 * 1000);
  if (!limited.ok) return rateLimitResponse(limited.resetAt);

  const { id } = await params;
  const servicio = await prisma.servicioProveedor.findFirst({
    where: { id, activo: true },
    select: { telefono: true, whatsapp: true, email: true },
  });
  if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });

  return NextResponse.json(servicio);
}
