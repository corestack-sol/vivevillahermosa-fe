import { NextResponse } from 'next/server';
import { getAgenteContacto } from '@/lib/api';
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
 * Límite por IP y por cuenta a la vez — no alcanza con solo uno de los dos.
 * Confirmado con una prueba real (cuenta de prueba creada y borrada
 * después): `X-Forwarded-For` es un header que cualquier cliente manda
 * directo, sin proxy de confianza en frente que lo sobrescriba — variarlo
 * en cada request le daba un bucket de rate limit nuevo cada vez (60/60
 * solicitudes exitosas falsificando la IP, con la MISMA sesión). El límite
 * por IP solo, aunque exista, no protegía nada frente a una sola cuenta con
 * un script. El límite por `userId` no tiene ese problema: sale de un JWT
 * firmado en el servidor, nadie puede falsificarlo desde el cliente.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Inicia sesión para ver el contacto' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limitedPorIp = checkRateLimit(`contacto:ip:${ip}`, 30, 10 * 60 * 1000);
  if (!limitedPorIp.ok) return rateLimitResponse(limitedPorIp.resetAt);

  const limitedPorCuenta = checkRateLimit(`contacto:user:${session.userId}`, 30, 10 * 60 * 1000);
  if (!limitedPorCuenta.ok) return rateLimitResponse(limitedPorCuenta.resetAt);

  const { id } = await params;
  const contacto = getAgenteContacto(id);
  if (!contacto) {
    return NextResponse.json({ error: 'Propiedad no encontrada' }, { status: 404 });
  }

  return NextResponse.json(contacto);
}
