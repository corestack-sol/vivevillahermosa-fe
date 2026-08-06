/**
 * Lectura/escritura de JSON en localStorage con manejo de errores — extraído
 * del try/catch que estaba duplicado en src/lib/estadoOverrides.ts. No es un
 * framework de persistencia, solo evita repetir el mismo guard (localStorage
 * puede no estar disponible en SSR, modo privado, o con la cuota llena) en
 * cada módulo nuevo que necesite simular persistencia en el navegador.
 */
export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena) — no es crítico.
  }
}
