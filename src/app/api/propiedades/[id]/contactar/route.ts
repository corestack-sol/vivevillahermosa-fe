import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPropertyById } from '@/lib/api';
import { sendContactoPropiedadEmail } from '@/lib/email';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

const schema = z.object({
  nombre: z.string().min(2).max(150),
  telefono: z.string().min(10).max(20),
  email: z.string().email().max(200),
  mensaje: z.string().min(10).max(2000),
});

/**
 * Reemplaza la exposición directa del WhatsApp del propietario (ver el
 * comentario en `../contacto/route.ts`): en vez de revelarle el número a
 * cualquier visitante, este endpoint le manda un correo real con el
 * mensaje — es el propietario quien decide si responde y comparte su
 * número, no la plataforma quien lo expone de entrada.
 *
 * Funciona igual para una cuenta particular que para una inmobiliaria: no
 * depende de `rol`/panel profesional ni de `Property.userId` (que hoy no
 * existe en una base de datos real) — usa `emailCuenta`
 * (`src/types/property.ts`), el correo de la cuenta que publicó, guardado
 * sin importar qué `metodoContacto` haya elegido mostrar públicamente.
 *
 * ⚠️ BACKEND (docs/BACKEND.md): sin `Property.userId`
 * real, no se puede crear todavía una notificación dentro del panel
 * (`Notificacion` en Prisma) para este evento — el correo es el único
 * canal confiable hoy. Agregar esa notificación en cuanto exista esa
 * relación real.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIp(request);
    const limited = checkRateLimit(`contactar:ip:${ip}`, 10, 10 * 60 * 1000);
    if (!limited.ok) return rateLimitResponse(limited.resetAt);

    const { id } = await params;
    const property = getPropertyById(id);
    if (!property) {
      return NextResponse.json({ error: 'Propiedad no encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const destinatario = property.emailCuenta ?? property.agente.email;
    if (!destinatario) {
      return NextResponse.json(
        { error: 'Este propietario no tiene un correo de contacto configurado todavía' },
        { status: 400 },
      );
    }

    const enviado = await sendContactoPropiedadEmail({
      to: destinatario,
      propertyTitle: property.titulo,
      propertyUrl: `${BASE}/propiedades/${property.slug}`,
      interesado: parsed.data,
    });

    // A diferencia de las alertas/recordatorios (donde el correo es un
    // efecto secundario de algo que ya se guardó en la base de datos),
    // aquí el correo ES el mensaje completo — no hay ningún otro registro
    // de respaldo. Si Resend falla, el mensaje del visitante se perdió de
    // verdad, así que no se le puede decir que se envió con éxito.
    if (!enviado) {
      console.error(`[contactar] No se pudo enviar el correo de contacto para la propiedad ${id}`);
      return NextResponse.json({ error: 'No se pudo enviar el mensaje, intenta de nuevo en unos minutos' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al enviar el mensaje' }, { status: 500 });
  }
}
