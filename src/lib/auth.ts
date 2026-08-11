import { cookies } from 'next/headers';
import { SESSION_COOKIE as COOKIE, type BackendUser } from './backendApi';
import { backendFetchServer } from './backendApiServer';

export interface SessionPayload {
  userId: string;
  email: string;
  nombre: string;
  rol: string;
  esAdmin?: boolean;
}

/**
 * Ya no verifica un JWT localmente — la sesión vive del lado del backend
 * separado (docs/BACKEND.md, "Decisiones abiertas" punto 1: secreto
 * compartido + cookie httpOnly). Este helper solo le pregunta al backend
 * quién es, reenviando la cookie que ya llegó en el request actual.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  if (!cookieStore.get(COOKIE)?.value) return null;

  try {
    const { user } = await backendFetchServer<{ user: BackendUser | null }>(
      '/auth/me',
    );
    if (!user) return null;
    return {
      userId: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      esAdmin: user.esAdmin,
    };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE } from './backendApi';
