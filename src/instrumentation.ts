/**
 * `register()` corre una sola vez cuando arranca el proceso del servidor
 * (ver node_modules/next/dist/docs/.../instrumentation.md — Next 16 lo
 * volvió estable). Lo usamos para un poller en memoria que revisa cada
 * minuto si hay recordatorios de citas pendientes de enviar — funciona
 * mientras el proceso de Node esté vivo (`next dev` / `next start`).
 *
 * ⚠️ Esto NO sirve en un despliegue serverless (Vercel, etc.): una función
 * serverless no queda corriendo en segundo plano entre requests, así que
 * `setInterval` nunca vuelve a dispararse después del primer request. En
 * producción hace falta un cron real apuntando a
 * `POST /api/citas/recordatorios/procesar` — ver
 * docs/BACKEND.md. Aun así vale la pena tener este poller
 * para poder probar el flujo completo en desarrollo sin depender de
 * infraestructura externa.
 */
export async function register() {
  // Igual que el patrón de la documentación oficial: se descarta
  // explícitamente el runtime Edge (Prisma no corre ahí) y se deja correr
  // en cualquier otro caso. Un check `!== 'nodejs'` parecía equivalente
  // pero no lo es: si `NEXT_RUNTIME` llega undefined en algún entorno/
  // versión (no está garantizado que Next siempre lo setee para el
  // runtime por defecto), esa condición sería true y el poller nunca
  // arrancaría, en silencio, sin ningún error visible.
  if (process.env.NEXT_RUNTIME === 'edge') return;

  // globalThis en vez de una variable de módulo — Turbopack/webpack pueden
  // re-evaluar este módulo en hot-reload durante `next dev`, y no queremos
  // dos intervalos corriendo en paralelo mandando correos duplicados.
  const g = globalThis as unknown as { __citasRecordatoriosPoller?: NodeJS.Timeout };
  if (g.__citasRecordatoriosPoller) return;

  const { procesarRecordatoriosPendientes } = await import('./lib/citasRecordatorios');

  g.__citasRecordatoriosPoller = setInterval(async () => {
    try {
      await procesarRecordatoriosPendientes();
    } catch (err) {
      console.error('[citas] Error procesando recordatorios', err);
    }
  }, 60_000);
}
