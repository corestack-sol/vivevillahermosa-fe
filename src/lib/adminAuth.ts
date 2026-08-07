import { NextResponse } from 'next/server';
import { getSession, type SessionPayload } from './auth';
import { prisma } from './db';

/**
 * Puerta de entrada real para cada ruta /api/admin/** — `esAdmin` se lee
 * fresco de la base de datos dentro de getSession() (nunca del JWT, ver el
 * comentario en SessionPayload), así que revocar el permiso de un admin
 * corta el acceso de inmediato, sin esperar a que expire su sesión.
 *
 * Mismo estilo que ya usa el resto de las rutas de este proyecto
 * (`if (!session) return NextResponse.json(...)`) — sin excepciones ni
 * control de flujo nuevo, solo un valor que quien llama revisa antes de
 * seguir.
 */
export async function requireAdmin(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Inicia sesión' }, { status: 401 }) };
  }
  if (!session.esAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'No tienes permiso de administrador' }, { status: 403 }) };
  }
  return { ok: true, session };
}

/**
 * Registra una acción de admin — sin esto, `AccionAdmin` tendría el mismo
 * problema que ya tenía `IntentoSospechoso` antes de este panel (se
 * escribe, nadie lo puede revisar); ver /admin/auditoria. Se llama después
 * de que la acción de verdad se aplicó, nunca antes.
 */
export async function registrarAccionAdmin(adminId: string, accion: string, objetivoId: string, detalle?: string): Promise<void> {
  await prisma.accionAdmin.create({ data: { adminId, accion, objetivoId, detalle } });
}
