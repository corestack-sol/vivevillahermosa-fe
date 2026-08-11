import { cookies } from 'next/headers';
import { BACKEND_URL, SESSION_COOKIE, parseResponse } from './backendApi';

/**
 * Uso desde Server Components / generateMetadata. El servidor de Next.js le
 * hace fetch al backend por su cuenta — no hay cookie de navegador que
 * viaje sola, hay que reenviar la sesión a mano leyéndola de next/headers.
 * Separado de backendApi.ts porque 'next/headers' no puede importarse desde
 * ningún archivo que un Client Component también importe.
 */
export async function backendFetchServer<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}),
      ...init?.headers,
    },
  });
  return parseResponse<T>(response);
}
