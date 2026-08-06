import { prisma } from './db';
import { sendAlertaEmail } from './email';

export interface PropiedadCandidata {
  id: string;
  titulo: string;
  tipo: string;
  operacion: string;
  municipio: string;
  precio: number;
  riesgoInundacion: 'alto' | 'medio' | 'bajo';
}

function alertaLabel(a: { municipio: string | null; tipo: string | null; operacion: string | null; precioMax: number | null; sinRiesgo: boolean }): string {
  const parts: string[] = [];
  if (a.operacion) parts.push(a.operacion === 'renta' ? 'Renta' : 'Venta');
  if (a.tipo) parts.push(a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1));
  if (a.municipio) parts.push(a.municipio === 'Centro' ? 'Villahermosa' : a.municipio);
  if (a.precioMax) parts.push(`hasta $${a.precioMax.toLocaleString('es-MX')}`);
  if (a.sinRiesgo) parts.push('zona segura');
  return parts.length ? parts.join(' · ') : 'Todas las propiedades';
}

/**
 * Compara una propiedad recién "publicada" contra todas las alertas
 * guardadas, crea una Notificacion real por cada coincidencia y dispara el
 * correo (ver src/lib/email.ts). No filtra por Dos Bocas: PublishForm no
 * captura ese dato hoy, así que ese criterio de la alerta se ignora en la
 * comparación (documentado en docs/BACKEND.md).
 *
 * `propiedadId` en la notificación queda null a propósito: la propiedad no
 * se persiste en el catálogo real todavía (Módulo 1 pendiente), así que no
 * hay una ficha pública a la que enlazar.
 */
export async function notificarAlertasCoincidentes(candidata: PropiedadCandidata): Promise<number> {
  const alertas = await prisma.alerta.findMany({ include: { user: true } });

  const matches = alertas.filter((a) => {
    if (a.municipio && a.municipio !== candidata.municipio) return false;
    if (a.tipo && a.tipo !== candidata.tipo) return false;
    if (a.operacion && a.operacion !== candidata.operacion) return false;
    if (a.precioMax != null && candidata.precio > a.precioMax) return false;
    if (a.sinRiesgo && candidata.riesgoInundacion !== 'bajo') return false;
    return true;
  });

  await Promise.all(matches.map(async (m) => {
    const label = alertaLabel(m);
    await prisma.notificacion.create({
      data: {
        userId: m.userId,
        tipo: 'alerta_match',
        titulo: 'Nueva propiedad que coincide con tu alerta',
        mensaje: `${candidata.titulo} — coincide con tu alerta: ${label}`,
        propiedadId: null,
      },
    });
    await sendAlertaEmail({
      to: m.user.email,
      nombre: m.user.nombre,
      propertyTitle: candidata.titulo,
      propertyUrl: null,
      alertaLabel: label,
    });
  }));

  return matches.length;
}
