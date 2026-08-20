import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backendApi';

// Health-check mínimo — docs/PLAN-AUDITORIA-FASE1-MVP.md hallazgo #14.
// No reemplaza monitoreo real (hallazgo #13, sigue pendiente de decidir
// herramienta), pero da un endpoint verificable para cualquier uptime
// checker externo (UptimeRobot, Better Stack, el propio Railway) mientras
// tanto. Comprueba que el backend real responda, no solo que Next.js viva.
//
// No devuelve BACKEND_URL en el body — antes cualquiera podía consultar
// este endpoint sin autenticación y aprender el origen real del backend
// (útil para escanear/atacar directo, saltándose Next.js por completo).
//
// Cache en memoria de 8s: sin esto, cada hit dispara una consulta real
// contra el backend (POST/GET /propiedades) — un loop repitiendo este
// endpoint amplifica tráfico real contra producción. No es rate limiting
// de verdad (por instancia/isolate, no global), pero colapsa una ráfaga a
// una sola llamada real mientras el isolate siga caliente.
const CACHE_MS = 8_000;
let cache: { body: Record<string, unknown>; status: number; expiresAt: number } | null = null;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.body, { status: cache.status });
  }

  const startedAt = Date.now();

  let body: Record<string, unknown>;
  let status: number;
  try {
    const res = await fetch(`${BACKEND_URL}/propiedades?perPage=1`, {
      signal: AbortSignal.timeout(5000),
    });
    const backendOk = res.ok;
    body = {
      status: backendOk ? 'ok' : 'degraded',
      backend: { reachable: backendOk },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
    status = backendOk ? 200 : 503;
  } catch {
    body = {
      status: 'degraded',
      backend: { reachable: false },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
    status = 503;
  }

  cache = { body, status, expiresAt: Date.now() + CACHE_MS };
  return NextResponse.json(body, { status });
}
