import { NextResponse } from 'next/server';
import { procesarRecordatoriosPendientes } from '@/lib/citasRecordatorios';

/**
 * Punto de entrada para el cron de recordatorios — no requiere sesión de
 * usuario (nadie tiene una sesión abierta cuando corre un cron), se protege
 * con un secreto compartido en su lugar. En este entorno de desarrollo,
 * `src/instrumentation.ts` llama esta misma lógica directo (sin pasar por
 * HTTP) cada minuto mientras el servidor esté corriendo. En producción hay
 * que apuntar un cron real (Vercel Cron, GitHub Actions, cron-job.org) a
 * este endpoint cada 1-5 minutos con el header de abajo. Ver
 * docs/BACKEND.md.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get('authorization');
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  const resultado = await procesarRecordatoriosPendientes();
  return NextResponse.json(resultado);
}
