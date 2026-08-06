/**
 * Rate limiter en memoria — mitigación provisional del lado del frontend
 * mientras no exista un backend real con almacenamiento compartido.
 *
 * ⚠️ LIMITACIÓN CONOCIDA: este contador vive en la memoria del proceso de
 * Node. Funciona correctamente en un servidor de un solo proceso (`next
 * start` / VPS / contenedor único), pero en un despliegue serverless con
 * múltiples instancias (Vercel, AWS Lambda) cada instancia tiene su propio
 * contador — un atacante distribuido entre instancias puede eludir el
 * límite. Ver docs/BACKEND.md para el reemplazo
 * recomendado (Upstash Redis o tabla en la base de datos) antes de escalar
 * a producción multi-instancia.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Evita que el Map crezca sin límite en un proceso de larga duración.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * @param key       Identificador único del sujeto limitado (ej. `login:${ip}`).
 * @param limit     Número máximo de solicitudes permitidas por ventana.
 * @param windowMs  Duración de la ventana en milisegundos.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/**
 * IP del cliente a partir de las cabeceras estándar de proxy/CDN.
 *
 * ⚠️ VULNERABILIDAD CONFIRMADA CON PRUEBAS REALES: `X-Forwarded-For` es una
 * cabecera que CUALQUIER cliente puede mandar directamente — sin un proxy
 * de confianza en frente (Vercel, Cloudflare, nginx configurado para
 * sobrescribirla) que la reemplace antes de que llegue aquí, alguien puede
 * poner un valor distinto en cada solicitud y obtener un bucket de rate
 * limit nuevo cada vez, evadiendo el límite por completo. Confirmado:
 * `curl -H "X-Forwarded-For: 10.0.0.1"` (y .2, .3, ...) contra cualquier
 * ruta de IA nunca se topa con el límite.
 *
 * Por eso ninguna ruta de IA (ver src/app/api/ia/*\/route.ts) depende
 * SOLO del límite por IP — todas también tienen un backstop global (una
 * sola cuenta compartida por ruta, sin importar la IP) que sí acota el
 * peor caso: alguien agotando la cuota gratuita del proveedor completa con
 * IPs falsas. El backstop es una protección más burda (afecta a todos los
 * usuarios reales por igual si se dispara), no un reemplazo real del
 * límite por IP — ver docs/BACKEND.md para el
 * reemplazo correcto (verificar la IP real del socket, o confiar en esta
 * cabecera solo detrás de un proxy conocido) antes de producción.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export function rateLimitResponse(resetAt: number) {
  const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return Response.json(
    { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}
