import { NextResponse } from 'next/server';
import { getPropertyById } from '@/lib/api';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';
import { getSession } from '@/lib/auth';

/**
 * Devuelve el contacto del agente (tel/whatsapp/correo) solo a quien tiene
 * sesión iniciada — un visitante anónimo recibe 401 y ningún dato, sin
 * importar el rate limit. Antes este endpoint solo devolvía `email` y
 * ocultaba tel/whatsapp para todos, forzando el flujo de "manda un mensaje
 * primero" incluso para quien ya está registrado; pero en este mercado ya
 * es normal ver el número directo en una lona de "se renta" o en un grupo
 * informal — el riesgo real no es que una persona real lo vea, es que un
 * bot lo scrapee en lote sin fricción. Exigir sesión cierra ese vector sin
 * sacrificar la inmediatez que la gente ya espera. El propietario puede
 * optar por el flujo de mensaje-primero de todas formas marcando
 * `Property.requiereMensajePrimero` al publicar (ver PublishForm.tsx);
 * en ese caso el frontend (AgentCard.tsx) simplemente no llama a este
 * endpoint para tel/whatsapp y dirige a ContactForm en su lugar.
 *
 * Rate limit por IP se mantiene además del login: una cuenta comprometida o
 * un usuario real automatizando requests no debería poder scrapear en lote
 * solo por estar autenticado.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Inicia sesión para ver el contacto' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limited = checkRateLimit(`contacto:ip:${ip}`, 30, 10 * 60 * 1000);
  if (!limited.ok) return rateLimitResponse(limited.resetAt);

  const { id } = await params;
  const property = getPropertyById(id);
  if (!property) {
    return NextResponse.json({ error: 'Propiedad no encontrada' }, { status: 404 });
  }

  const { tel, email, whatsapp } = property.agente;
  return NextResponse.json({ tel, email, whatsapp });
}
