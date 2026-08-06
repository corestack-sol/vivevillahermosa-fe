import { prisma } from './db';
import { sendCitaRecordatorioEmail } from './email';

/**
 * Revisa citas confirmadas sin recordatorio enviado y manda el correo a
 * quien ya se cumplió su ventana configurada (`recordatorioMinAntes` de
 * ConfiguracionAgenda, default 60 min). Se le avisa tanto al profesional
 * (correo de su cuenta) como al cliente (si dejó su correo al agendar).
 *
 * Esto necesita algo que lo dispare cada cierto tiempo — un cron real. En
 * este entorno de desarrollo, `src/instrumentation.ts` arranca un poller en
 * memoria mientras el servidor esté corriendo; en producción (serverless)
 * eso no sirve porque la función no queda "viva" entre requests, así que
 * hace falta un cron externo (Vercel Cron, GitHub Actions, cron-job.org)
 * pegándole a `POST /api/citas/recordatorios/procesar` cada 1-5 minutos.
 * Ver docs/BACKEND.md.
 */
export async function procesarRecordatoriosPendientes(): Promise<{ enviados: number; revisadas: number }> {
  const ahora = new Date();

  const citas = await prisma.cita.findMany({
    where: {
      estado: 'confirmada',
      recordatorioEnviado: false,
      fecha: { gte: ahora },
    },
    include: {
      user: { include: { configuracionAgenda: true } },
    },
  });

  let enviados = 0;

  for (const cita of citas) {
    const minAntes = cita.user.configuracionAgenda?.recordatorioMinAntes ?? 60;
    const disparoEn = new Date(cita.fecha.getTime() - minAntes * 60_000);
    if (ahora < disparoEn) continue;

    // Reclamo atómico antes de mandar el correo, no después. El poller local
    // corre cada minuto (ver instrumentation.ts) — si un envío tarda más de
    // un minuto (Resend lento, red congestionada), el siguiente tick vería
    // esta misma cita todavía con recordatorioEnviado=false y la volvería a
    // procesar, mandando el correo dos veces. `updateMany` con la condición
    // en el `where` es atómico a nivel de base de datos: solo una llamada
    // concurrente puede ganar la carrera (count === 1); la otra ve count 0
    // y se retira sin mandar nada.
    const reclamo = await prisma.cita.updateMany({
      where: { id: cita.id, recordatorioEnviado: false },
      data: { recordatorioEnviado: true },
    });
    if (reclamo.count === 0) continue;

    const minutosRestantes = Math.max(0, Math.round((cita.fecha.getTime() - ahora.getTime()) / 60_000));

    const destinatarios: { to: string; nombre: string }[] = [
      { to: cita.user.email, nombre: cita.user.nombre },
    ];
    if (cita.emailCliente) {
      destinatarios.push({ to: cita.emailCliente, nombre: cita.nombreCliente });
    }

    const resultados = await Promise.all(destinatarios.map((d) => sendCitaRecordatorioEmail({
      to: d.to,
      nombreDestinatario: d.nombre,
      tituloCita: cita.titulo,
      fecha: cita.fecha,
      minutosAntes: minutosRestantes,
      nombreCliente: cita.nombreCliente,
      notas: cita.notas,
    })));

    if (resultados.some(Boolean)) {
      enviados++;
    } else {
      // Ningún correo salió (ej. Resend caído) — deshacemos el reclamo para
      // que el siguiente ciclo lo vuelva a intentar en vez de darlo por
      // enviado silenciosamente.
      //
      // Nota probada en la práctica: si dos llamadas a esta función corren
      // realmente en paralelo Y ambas fallan al enviar, este revert puede
      // dejarle la puerta abierta a la otra llamada para reclamar la misma
      // cita una segunda vez dentro de esa misma ventana — es decir, el
      // reclamo atómico evita duplicar un envío EXITOSO (el caso real que
      // importa), pero no garantiza como máximo un intento cuando todos los
      // intentos fallan. Como ningún correo sale en ese escenario, el peor
      // resultado es un intento de más, no un duplicado real hacia el
      // usuario — no vale la pena una cola/lock más compleja para esto hoy.
      await prisma.cita.update({ where: { id: cita.id }, data: { recordatorioEnviado: false } });
    }
  }

  return { enviados, revisadas: citas.length };
}
