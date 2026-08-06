import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Mock determinístico de actividad del usuario (vistas y contactos enviados).
 * Sustituir por conteo real (tabla Vista/Contacto en Prisma) en Fase 2 —
 * ver Módulo 12 de fase2-spec.md. El mismo userId siempre produce los mismos
 * números, para que no "salten" entre recargas.
 */
function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const seed = seedFromId(session.userId);
  const vistas = 6 + (seed % 90);
  const tasaContacto = 0.04 + ((seed >>> 3) % 10) / 100;
  const contactos = Math.max(0, Math.round(vistas * tasaContacto));

  return NextResponse.json({ vistas, contactos });
}
