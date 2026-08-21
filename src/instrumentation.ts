/**
 * `register()` corre una sola vez cuando arranca el proceso del servidor
 * (ver node_modules/next/dist/docs/.../instrumentation.md — Next 16 lo
 * volvió estable). Lo usamos para un poller de conveniencia en desarrollo
 * que llama cada minuto al backend real (`POST /citas/recordatorios/procesar`,
 * ver docs/BACKEND.md §6) — funciona mientras el proceso de Node esté vivo
 * (`next dev` / `next start`).
 *
 * ⚠️ Este poller es SOLO para desarrollo local — no sirve en ningún
 * despliegue de producción, sea serverless (Vercel) o Workers (Cloudflare,
 * este proyecto vía @opennextjs/cloudflare): un `setInterval` que sigue
 * vivo entre requests no es un patrón soportado en esos entornos — en
 * Cloudflare Workers en particular, la CPU de esos disparos en segundo
 * plano se factura contra el request que "despierta" al isolate, lo que
 * puede disparar el error 1102 (Worker exceeded resource limits).
 * **El mecanismo real de producción es
 * `.github/workflows/citas-recordatorios.yml` en el repo del backend**
 * (cron real, cada 5 min) — este poller no lo reemplaza, solo evita
 * depender de infraestructura externa para probar el flujo completo en dev.
 *
 * 2026-08-21: antes el guard solo descartaba `NEXT_RUNTIME === 'edge'`,
 * asumiendo que cualquier otro valor era Node.js "de verdad" corriendo
 * localmente. Falso para este proyecto: OpenNext Cloudflare corre Next.js
 * sobre una capa de compatibilidad Node.js dentro de Workers
 * (`nodejs_compat` en wrangler.jsonc), así que `NEXT_RUNTIME` vale
 * `'nodejs'` ahí también — el guard no detenía nada en producción. Ahora
 * se exige explícitamente `NODE_ENV !== 'production'`, sin importar qué
 * plataforma sea: el poller nace y muere en desarrollo local, punto.
 *
 * 2026-08-13: antes este poller procesaba `Cita` de la base de datos LOCAL
 * de este repo (Prisma propio) — huérfana desde que Citas se migró al
 * backend nuevo (nada vuelve a escribir esa tabla), así que "funcionaba"
 * sin ningún efecto real. Corregido para llamar al backend de verdad.
 */
export async function register() {
  if (process.env.NODE_ENV === 'production') return;

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
