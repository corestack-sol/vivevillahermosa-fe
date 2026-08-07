import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

/**
 * Conteos reales sobre tablas que ya existen — sin ninguna cifra de
 * propiedades: `Property` no es una tabla real todavía (ver el bloque
 * comentado al final de prisma/schema.prisma), y mostrar un tile en 0 o
 * "N/A" para eso daría a entender que sí se intentó medir algo real. Se
 * omite del todo en vez de fingir un dato.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const [
    totalUsuarios,
    usuariosBloqueados,
    solicitudesPendientes,
    reportesPendientes,
    intentosSospechosos7d,
    totalFavoritos,
    totalAlertas,
    totalCitas,
    totalServicios,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { bloqueado: true } }),
    prisma.solicitudRevision.count({ where: { estado: 'pendiente' } }),
    prisma.reporteAnuncio.count({ where: { estado: 'pendiente' } }),
    prisma.intentoSospechoso.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    prisma.favorito.count(),
    prisma.alerta.count(),
    prisma.cita.count(),
    prisma.servicioProveedor.count({ where: { activo: true } }),
  ]);

  return NextResponse.json({
    totalUsuarios,
    usuariosBloqueados,
    solicitudesPendientes,
    reportesPendientes,
    intentosSospechosos7d,
    totalFavoritos,
    totalAlertas,
    totalCitas,
    totalServicios,
    // Configuración visible sin exponer valores — ver src/lib/email.ts,
    // que hoy se salta el envío en silencio (solo console.warn) si falta
    // la API key, algo fácil de no notar en desarrollo.
    resendConfigurado: !!process.env.RESEND_API_KEY,
    openrouterConfigurado: !!process.env.OPENROUTER_API_KEY,
    geminiConfigurado: !!process.env.GEMINI_API_KEY,
  });
}
