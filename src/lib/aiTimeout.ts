/**
 * Compartido entre todos los clientes de IA de la plataforma (Gemini,
 * OpenRouter — ver geminiClient.ts / openRouterClient.ts). Modelos
 * "flash"/preview o de
 * proveedores nuevos pueden tardar mucho más de lo normal bajo demanda alta
 * (se observaron llamadas reales a Gemini tardando entre 15 y 119 segundos
 * en pruebas) — inaceptable para cualquier flujo donde alguien está
 * esperando en pantalla (la barra de búsqueda sobre todo). Cada función de
 * IA debe envolver su llamada con esto para que un proveedor lento caiga a
 * su fallback rápido en vez de dejar al usuario esperando minutos. Nunca
 * usar esto como sustituto de manejar el error real — solo acota cuánto se
 * espera antes de darlo por perdido.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, proveedor = 'El servicio de IA'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${proveedor} no respondió en ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
