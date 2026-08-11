import { Resend } from 'resend';

// Sin RESEND_API_KEY el envío se salta con un aviso en consola — no falla
// de forma ruidosa (a diferencia de JWT_SECRET) porque un correo caído no
// debe tumbar el flujo de alertas/notificaciones, solo degradar sin enviar.
// Ver docs/BACKEND.md.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.EMAIL_FROM || 'Vive Villahermosa <onboarding@resend.dev>';

/**
 * Todos los correos de esta plataforma interpolan texto que viene del
 * usuario (nombre de cuenta, título/notas de una cita, nombre de un
 * cliente) directo dentro de un template HTML. Sin escapar, alguien podría
 * meter `<img src=x onerror=...>` o un link falso en, por ejemplo, el
 * campo "notas" de una cita, y ese HTML llegaría tal cual al correo del
 * destinatario. La mayoría de los clientes de correo no ejecutan <script>,
 * pero sí renderizan HTML — suficiente para spoofing visual o un link de
 * phishing disfrazado. Se escapa antes de interpolar, en vez de confiar en
 * que el HTML del cliente de correo lo neutralice.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface AlertaEmailParams {
  to: string;
  nombre: string;
  propertyTitle: string;
  propertyUrl: string | null;
  alertaLabel: string;
}

export async function sendAlertaEmail(params: AlertaEmailParams): Promise<boolean> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY no configurado — no se envió correo a ${params.to}`);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `Nueva propiedad que coincide con tu alerta: ${params.propertyTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>Hola ${escapeHtml(params.nombre)},</p>
          <p>Se publicó una propiedad que coincide con tu alerta <strong>${escapeHtml(params.alertaLabel)}</strong>:</p>
          <p style="font-size: 16px; font-weight: bold; margin: 16px 0 4px;">${escapeHtml(params.propertyTitle)}</p>
          ${params.propertyUrl
            ? `<a href="${encodeURI(params.propertyUrl)}" style="display:inline-block;background:#0D7065;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;margin-top:8px;">Ver propiedad</a>`
            : ''}
          <p style="color:#888; font-size:12px; margin-top:24px;">Recibiste este correo porque tienes una alerta activa en Vive Villahermosa. Puedes administrarlas desde tu panel.</p>
        </div>
      `,
    });
    if (error) {
      console.error('[email] Resend devolvió un error', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Error enviando correo', err);
    return false;
  }
}

interface CitaRecordatorioEmailParams {
  to: string;
  nombreDestinatario: string;
  tituloCita: string;
  fecha: Date;
  minutosAntes: number;
  nombreCliente: string;
  notas: string | null;
}

export async function sendCitaRecordatorioEmail(params: CitaRecordatorioEmailParams): Promise<boolean> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY no configurado — no se envió recordatorio de cita a ${params.to}`);
    return false;
  }

  const hora = params.fecha.toLocaleString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
  });

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `Recordatorio: ${params.tituloCita} en ${params.minutosAntes} min`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>Hola ${escapeHtml(params.nombreDestinatario)},</p>
          <p>Tienes una cita en aproximadamente <strong>${params.minutosAntes} minutos</strong>:</p>
          <p style="font-size: 16px; font-weight: bold; margin: 16px 0 4px;">${escapeHtml(params.tituloCita)}</p>
          <p style="color:#444; margin: 4px 0;">🕒 ${hora}</p>
          <p style="color:#444; margin: 4px 0;">👤 ${escapeHtml(params.nombreCliente)}</p>
          ${params.notas ? `<p style="color:#666; margin: 12px 0 0; font-size: 14px;">${escapeHtml(params.notas)}</p>` : ''}
          <p style="color:#888; font-size:12px; margin-top:24px;">Recordatorio automático de Vive Villahermosa — puedes cambiar cuándo se envían desde tu panel.</p>
        </div>
      `,
    });
    if (error) {
      console.error('[email] Resend devolvió un error', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Error enviando correo', err);
    return false;
  }
}

interface SolicitudRevisionResueltaEmailParams {
  to: string;
  nombre: string;
  estado: 'aprobada' | 'rechazada';
  respuestaAdmin: string | null;
}

/**
 * El único canal que de verdad le llega a alguien cuando SE RECHAZA su
 * solicitud de revisión — su cuenta sigue bloqueada, así que nunca podría
 * iniciar sesión para ver la Notificacion in-app que también se crea (ver
 * POST /api/admin/solicitudes-revision/:id/resolver). Si se aprueba,
 * `bloqueado` ya se puso en false antes de llamar esto, así que además
 * puede volver a entrar y ver la notificación normal.
 */
export async function sendSolicitudRevisionResueltaEmail(params: SolicitudRevisionResueltaEmailParams): Promise<boolean> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY no configurado — no se envió resolución de revisión a ${params.to}`);
    return false;
  }

  const aprobada = params.estado === 'aprobada';

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: aprobada ? 'Tu cuenta fue reactivada' : 'Resultado de tu solicitud de revisión',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>Hola ${escapeHtml(params.nombre)},</p>
          ${aprobada
            ? '<p>Revisamos tu solicitud y <strong>reactivamos tu cuenta</strong> — ya puedes iniciar sesión normalmente.</p>'
            : '<p>Revisamos tu solicitud y, por ahora, tu cuenta <strong>sigue bloqueada</strong>.</p>'}
          ${params.respuestaAdmin
            ? `<p style="color:#444; margin: 12px 0 0; font-size: 14px;">${escapeHtml(params.respuestaAdmin)}</p>`
            : ''}
          <p style="color:#888; font-size:12px; margin-top:24px;">Vive Villahermosa.</p>
        </div>
      `,
    });
    if (error) {
      console.error('[email] Resend devolvió un error', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Error enviando correo', err);
    return false;
  }
}
