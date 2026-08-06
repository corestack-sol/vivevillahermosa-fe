import { NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Elimina la cuenta autenticada de inmediato. Favoritos, alertas y
 * notificaciones se borran en cascada (ver relaciones onDelete: Cascade en
 * prisma/schema.prisma) — no queda nada huérfano. No hay periodo de gracia
 * ni confirmación por correo todavía; el modal que llama a esto ya advierte
 * que es inmediato e irreversible.
 */
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  await prisma.user.delete({ where: { id: session.userId } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
