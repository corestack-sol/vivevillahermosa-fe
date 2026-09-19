export type ResultadoSesion<U> =
  | { tipo: 'usuario'; user: U }
  | { tipo: 'sin-sesion' }
  | { tipo: 'error' };

interface Opciones {
  /** Reintentos después del primer intento (default 1). */
  reintentos?: number;
  esperarMs?: number;
  dormir?: (ms: number) => Promise<void>;
  /** ¿Este error significa "la sesión de verdad no es válida" (401/403)? */
  esSinSesion?: (err: unknown) => boolean;
}

const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Pregunta quién es la persona con sesión, distinguiendo tres casos que
 * antes se trataban igual (todo error = "sin sesión"):
 * - `usuario` / `sin-sesion`: el backend respondió (con `user: null` o con un
 *   401/403). Ese estado es definitivo.
 * - `error`: fallo de red, timeout o 5xx. NO es "cerró sesión" — quien llama
 *   debe conservar lo que ya sabía en vez de mostrar "Entrar" a alguien que sí
 *   tiene sesión (hasta que recargue).
 * Un fallo transitorio se reintenta antes de rendirse.
 */
export async function pedirSesion<U>(
  pedir: () => Promise<{ user: U | null }>,
  { reintentos = 1, esperarMs = 1500, dormir = dormirReal, esSinSesion = () => false }: Opciones = {},
): Promise<ResultadoSesion<U>> {
  for (let intento = 0; intento <= reintentos; intento++) {
    try {
      const { user } = await pedir();
      return user ? { tipo: 'usuario', user } : { tipo: 'sin-sesion' };
    } catch (err) {
      if (esSinSesion(err)) return { tipo: 'sin-sesion' };
      if (intento === reintentos) return { tipo: 'error' };
      await dormir(esperarMs);
    }
  }
  return { tipo: 'error' };
}
