import { cookies } from 'next/headers';
import { SESSION_COOKIE as COOKIE, type BackendUser } from './backendApi';
import { backendFetchServer } from './backendApiServer';

export interface SessionPayload {
  userId: string;
  email: string;
  nombre: string;
  rol: string;
  /**
   * ⚠️ 2026-08-10 — con la sesión ahora emitida y verificada por el backend
   * separado (docs/BACKEND.md §13), este campo ya NO se puebla nunca aquí:
   * GET /auth/me del backend no expone `esAdmin` (el panel /admin sigue
   * corriendo contra Prisma local, con su propio corte pendiente). El
   * resultado es que requireAdmin() (src/lib/adminAuth.ts) niega a todos
   * hasta que ese corte pase — falla cerrado, no es una regresión de
   * seguridad, pero si /admin deja de funcionar en desarrollo es por esto,
   * no un bug.
   */
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
    };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE } from './backendApi';
