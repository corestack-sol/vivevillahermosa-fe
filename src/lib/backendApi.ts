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
// Bug real 2026-08-19: este valor no coincidía con el COOKIE_NAME real del
// backend en Railway ("vv_session") — el navegador sí mandaba la cookie
// real automáticamente (por eso el header/menú se veía bien logueado),
// pero getSession()/backendFetchServer() la buscaban server-side por este
// nombre exacto, nunca la encontraban, y mandaban a /auth/login rutas
// protegidas (/publicar, /dashboard, /favoritos, /alertas,
// /servicios/publicar) aunque la sesión sí existiera. Confirmado por el
// equipo de backend contra las variables reales de Railway.
export const SESSION_COOKIE = 'vv_session';

/** Forma real de GET /auth/me y equivalentes del backend (AuthService.PublicUser). */
export interface BackendUser {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  emailVerificado: boolean;
  esAdmin: boolean;
}

export const MENSAJE_LIMITE_PETICIONES = 'Hay muchas peticiones al servidor en este momento. Espera un minuto e inténtalo de nuevo.';

/** Un límite de una hora o más ya no es "espera un minuto": es el cupo diario global de IA, no un pico de tráfico. */
const UMBRAL_CUPO_DIARIO_S = 3600;

/**
 * Mensaje del límite de peticiones (429), con el tiempo de espera real cuando el backend lo
 * manda (cabecera `Retry-After`). POST /ia/analizar-imagen la manda desde el 2026-09-27
 * (docs/BACKEND-LIMITES-Y-DUPLICADOS-23092026.md): 10 min por IP, o hasta 24h si se agotó
 * el cupo global diario (18/día, gratuito de Gemini, compartido entre todo el sitio) — vale
 * la pena distinguir ese caso, no es lo mismo "espera un poco" que "hasta mañana".
 */
export function mensajeLimitePeticiones(retryAfterSegundos?: number): string {
  if (retryAfterSegundos === undefined || retryAfterSegundos <= 0) return MENSAJE_LIMITE_PETICIONES;
  if (retryAfterSegundos >= UMBRAL_CUPO_DIARIO_S) {
    return 'Por hoy ya se acabó el cupo gratuito para analizar imágenes con IA. Puedes seguir publicando sin ese análisis; vuelve a intentarlo mañana.';
  }
  return `Hay muchas peticiones al servidor en este momento. Intenta de nuevo en ${retryAfterSegundos}s.`;
}

export function esLimiteDePeticiones(e: unknown): e is BackendApiError {
  return e instanceof BackendApiError && e.status === 429;
}

export class BackendApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    /** Cabecera `Retry-After` del 429, en segundos, si el backend la mandó. */
    public readonly retryAfterSegundos?: number,
  ) {
    super(BackendApiError.extraerMensaje(status, body, retryAfterSegundos));
  }

  // BACKEND-AUDITORIA-EXHAUSTIVA-20082026: el ValidationPipe de NestJS (con
  // varios campos inválidos a la vez) manda `message` como un ARREGLO de
  // strings, no uno solo — `String(mensaje)` sobre un arreglo usa el join
  // implícito de JS (comas sin espacio, ej.
  // "email debe ser un correo,la contraseña es muy corta"), ilegible para
  // quien lo ve. Un solo campo inválido sigue mandando `message` como
  // string normal, eso no cambia.
  private static extraerMensaje(status: number, body: unknown, retryAfterSegundos?: number): string {
    // 429 (ThrottlerException): el texto crudo del backend ("ThrottlerException:
    // Too Many Requests") no le dice nada a quien lo ve — reporte 2026-09-23.
    if (status === 429) return mensajeLimitePeticiones(retryAfterSegundos);
    if (typeof body !== 'object' || !body || !('message' in body)) {
      return `Backend respondió ${status}`;
    }
    const mensaje = (body as { message: unknown }).message;
    if (Array.isArray(mensaje)) {
      return mensaje.map(String).join('. ');
    }
    return String(mensaje);
  }
}

/**
 * `Retry-After` acepta dos formatos por RFC 7231: segundos ("120") o una fecha HTTP
 * ("Wed, 21 Oct 2026 07:28:00 GMT"). Hoy el backend solo manda segundos, pero si algún
 * día cambia a fecha, `Number(crudo)` da `NaN` — sin este segundo intento, se perdía el
 * valor real en silencio (undefined) en vez de usarlo.
 */
function parseRetryAfter(crudo: string | null): number | undefined {
  if (crudo === null) return undefined;
  const segundos = Number(crudo);
  if (Number.isFinite(segundos)) return segundos;
  const fecha = Date.parse(crudo);
  return Number.isNaN(fecha) ? undefined : Math.max(0, Math.round((fecha - Date.now()) / 1000));
}

export async function parseResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const retryAfterSegundos = parseRetryAfter(response.headers.get('Retry-After'));
    throw new BackendApiError(response.status, body, retryAfterSegundos);
  }
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
