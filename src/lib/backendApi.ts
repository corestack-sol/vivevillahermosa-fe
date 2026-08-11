// Backend NestJS separado (docs/BACKEND.md §13). Sin valor de respaldo: sin
// esto no hay a dónde apuntar ninguna llamada real — mismo criterio que
// JWT_SECRET en auth.ts.
const rawUrl = process.env.NEXT_PUBLIC_API_URL;
if (!rawUrl) {
  throw new Error('NEXT_PUBLIC_API_URL ausente (ver .env.example).');
}
export const BACKEND_URL = rawUrl.replace(/\/$/, '');

// Única fuente de verdad para el nombre de la cookie de sesión — debe
// coincidir con COOKIE_NAME del backend (mismo secreto compartido, ver
// "Decisiones abiertas" punto 1 de docs/BACKEND.md). auth.ts la reexporta
// para no romper a quien ya la importaba desde ahí.
export const SESSION_COOKIE = 'vivevillahermosa_session';

/** Forma real de GET /auth/me y equivalentes del backend (AuthService.PublicUser). */
export interface BackendUser {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  emailVerificado: boolean;
  esAdmin: boolean;
}

export class BackendApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Backend respondió ${status}`,
    );
  }
}

export async function parseResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new BackendApiError(response.status, body);
  return body as T;
}

/**
 * Uso desde Client Components ('use client'). El navegador manda la cookie
 * de sesión sola (credentials: 'include') — mismo sitio que el backend
 * (subdominios del mismo dominio raíz en producción, mismo host en
 * localhost), ver "Decisiones abiertas" punto 1 de docs/BACKEND.md.
 *
 * Sin dependencias de 'next/headers' a propósito — este archivo lo importan
 * Client Components (ej. AuthContext.tsx), y Next.js prohíbe esa API fuera
 * de Server Components incluso si el propio Client Component nunca llama a
 * la función que la usa (ver backendApiServer.ts, que sí puede importarla
 * porque solo lo consumen Server Components).
 */
export async function backendFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  // FormData (ej. POST /propiedades/fotos) necesita que el navegador ponga
  // su propio Content-Type con el boundary del multipart — forzar
  // 'application/json' encima rompe el request.
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  return parseResponse<T>(response);
}
