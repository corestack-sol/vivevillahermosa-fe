import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, createSession, setSessionCookie } from '@/lib/auth';

/**
 * Activa "modo inmobiliaria" en la cuenta autenticada. No hay pasarela de
 * pago real todavía (ver docs/BACKEND.md) —
 * este endpoint solo demuestra el resultado final de esa activación
 * (rol -> 'agente', que desbloquea el panel profesional), sin fingir cobrar
 * nada. El modal que lo llama desde el home es explícito sobre esto.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Debes iniciar sesión' }, { status: 401 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { rol: 'agente' },
  });

  // El rol viaja dentro del JWT, así que hay que reemitir la sesión para
  // que el cambio se refleje sin pedir volver a iniciar sesión.
  const token = await createSession({ userId: user.id, email: user.email, nombre: user.nombre, rol: user.rol });
  const { name, value, options } = setSessionCookie(token);

  const res = NextResponse.json({ user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } });
  res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]);
  return res;
}
