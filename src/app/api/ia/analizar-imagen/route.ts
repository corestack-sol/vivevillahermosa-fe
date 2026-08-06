import { NextResponse } from 'next/server';
import { z } from 'zod';
import { analizarImagenPropiedad } from '@/lib/aiVision';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

const MAX_IMAGEN_LENGTH = 2_000_000;

const schema = z.object({
  imagen: z.string()
    .max(MAX_IMAGEN_LENGTH, 'La imagen es demasiado grande')
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/, 'Formato de imagen inválido'),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    // Cada foto de cada propiedad dispara una llamada real a Gemini — sin
    // límite, publicar sería un vector barato para agotar la cuota gratuita.
    const limited = checkRateLimit(`ia:imagen:${ip}`, 30, 10 * 60 * 1000);
    if (!limited.ok) return rateLimitResponse(limited.resetAt);
    // Backstop global — el límite por IP se evade con X-Forwarded-For falso
    // (ver comentario en busqueda-inteligente/route.ts). Esta ruta es la más
    // urgente de proteger así: Gemini solo da 20 solicitudes/DÍA gratis
    // (compartidas por todo el sitio, ver geminiClient.ts) — sin este
    // backstop, un puñado de solicitudes con IP falsa agotaría la cuota del
    // día entero en segundos. La ventana es de 24 horas (no 10 min) para que
    // el límite refleje el presupuesto diario real de Gemini, no solo frene
    // un pico y deje pasar el resto del día sin protección.
    const global = checkRateLimit('ia:imagen:global', 18, 24 * 60 * 60 * 1000);
    if (!global.ok) return rateLimitResponse(global.resetAt);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const resultado = await analizarImagenPropiedad(parsed.data.imagen);
    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ error: 'Error al analizar la imagen' }, { status: 500 });
  }
}
