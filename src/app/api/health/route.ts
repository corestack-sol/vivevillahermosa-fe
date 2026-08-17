import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backendApi';

// Health-check mínimo — docs/PLAN-AUDITORIA-FASE1-MVP.md hallazgo #14.
// No reemplaza monitoreo real (hallazgo #13, sigue pendiente de decidir
// herramienta), pero da un endpoint verificable para cualquier uptime
// checker externo (UptimeRobot, Better Stack, el propio Railway) mientras
// tanto. Comprueba que el backend real responda, no solo que Next.js viva.
export async function GET() {
  const startedAt = Date.now();

  try {
    const res = await fetch(`${BACKEND_URL}/propiedades?perPage=1`, {
      signal: AbortSignal.timeout(5000),
    });
    const backendOk = res.ok;
    return NextResponse.json(
      {
        status: backendOk ? 'ok' : 'degraded',
        backend: { url: BACKEND_URL, reachable: backendOk },
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: backendOk ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        backend: { url: BACKEND_URL, reachable: false },
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
