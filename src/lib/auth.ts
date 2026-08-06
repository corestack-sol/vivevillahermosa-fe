import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './db';

// Sin valor de respaldo: si falta o es débil, la app no debe arrancar —
// un secreto conocido/públicamente comprometido permite forjar sesiones de
// cualquier usuario. Ver auditoría de seguridad, hallazgo C2.
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret || rawSecret.length < 32) {
  throw new Error(
    'JWT_SECRET ausente o demasiado corto (mínimo 32 caracteres). ' +
    'Genera uno con: openssl rand -base64 32'
  );
}
const SECRET = new TextEncoder().encode(rawSecret);

const COOKIE = 'vivevillahermosa_session';
const TTL = 60 * 60 * 24 * 7; // 7 días

export interface SessionPayload {
  userId: string;
  email: string;
  nombre: string;
  rol: string;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;

  // Revocación en tiempo real para cuentas bloqueadas (ver
  // src/lib/moderacionBusqueda.ts) — el JWT es stateless y válido hasta
  // expirar (7 días) sin importar qué pase con la cuenta después de
  // emitirlo; no existe todavía una tabla de revocación real (ver
  // docs/BACKEND.md, sección "Revocación de sesiones"), así que este
  // chequeo aquí es lo que evita que alguien bloqueado a la mitad de esa
  // ventana siga con
  // acceso completo hasta que su sesión expire sola. Costo real: un query
  // extra a la base de datos en cada request autenticado — aceptable a la
  // escala actual (SQLite, pre-lanzamiento); revisar si el tráfico crece
  // mucho y esto empieza a pesar.
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { bloqueado: true } });
  if (user?.bloqueado) return null;

  return payload;
}

export function setSessionCookie(token: string): { name: string; value: string; options: object } {
  return {
    name: COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: TTL,
      path: '/',
    },
  };
}

export const SESSION_COOKIE = COOKIE;
