/**
 * `register()` corre una sola vez cuando arranca el proceso del servidor
 * (ver node_modules/next/dist/docs/.../instrumentation.md — Next 16 lo
 * volvió estable). Lo usamos para un poller de conveniencia en desarrollo
 * que llama cada minuto al backend real (`POST /citas/recordatorios/procesar`,
 * ver docs/BACKEND.md §6) — funciona mientras el proceso de Node esté vivo
 * (`next dev` / `next start`).
 *
 * ⚠️ Este poller es SOLO para desarrollo local — no sirve en un despliegue
 * serverless (Vercel, etc.): una función serverless no queda corriendo en
 * segundo plano entre requests, así que `setInterval` nunca vuelve a
 * dispararse después del primer request. **El mecanismo real de producción
 * es `.github/workflows/citas-recordatorios.yml` en el repo del backend**
 * (cron real, cada 5 min) — este poller no lo reemplaza, solo evita
 * depender de infraestructura externa para probar el flujo completo en dev.
 *
 * 2026-08-13: antes este poller procesaba `Cita` de la base de datos LOCAL
 * de este repo (Prisma propio) — huérfana desde que Citas se migró al
 * backend nuevo (nada vuelve a escribir esa tabla), así que "funcionaba"
 * sin ningún efecto real. Corregido para llamar al backend de verdad.
 */
export async function register() {
  // Igual que el patrón de la documentación oficial: se descarta
  // explícitamente el runtime Edge, y se deja correr en cualquier otro
  // caso. Un check `!== 'nodejs'` parecía equivalente pero no lo es: si
  // `NEXT_RUNTIME` llega undefined en algún entorno/versión (no está
  // garantizado que Next siempre lo setee para el runtime por defecto), esa
  // condición sería true y el poller nunca arrancaría, en silencio, sin
  // ningún error visible.
  if (process.env.NEXT_RUNTIME === 'edge') return;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!apiUrl || !cronSecret) return;

  // globalThis en vez de una variable de módulo — Turbopack/webpack pueden
  // re-evaluar este módulo en hot-reload durante `next dev`, y no queremos
  // dos intervalos corriendo en paralelo.
  const g = globalThis as unknown as { __citasRecordatoriosPoller?: NodeJS.Timeout };
  if (g.__citasRecordatoriosPoller) return;

  g.__citasRecordatoriosPoller = setInterval(async () => {
    try {
      const res = await fetch(`${apiUrl}/citas/recordatorios/procesar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      if (!res.ok) {
        console.error(`[citas] El backend respondió ${res.status} al procesar recordatorios`);
      }
    } catch (err) {
      console.error('[citas] Error llamando al backend para procesar recordatorios', err);
    }
  }, 60_000);
}
