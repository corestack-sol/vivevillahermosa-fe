import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    // Límite por IP (frena credential stuffing contra muchas cuentas) y por
    // IP+email (frena fuerza bruta dirigida a una sola cuenta). Mitigación
    // provisional en memoria — ver src/lib/rateLimit.ts para sus límites.
    const byIp = checkRateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
    if (!byIp.ok) return rateLimitResponse(byIp.resetAt);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { email, password } = parsed.data;

    const byAccount = checkRateLimit(`login:acct:${ip}:${email.toLowerCase()}`, 5, 15 * 60 * 1000);
    if (!byAccount.ok) return rateLimitResponse(byAccount.resetAt);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    if (user.bloqueado) {
      return NextResponse.json({
        error: 'Esta cuenta fue bloqueada por uso indebido de la plataforma. Si crees que es un error, contáctanos.',
      }, { status: 403 });
    }

    if (!user.password) {
      return NextResponse.json({
        error: 'Esta cuenta usa autenticación con Google o Facebook. Inicia sesión con ese método.',
      }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    const token = await createSession({ userId: user.id, email: user.email, nombre: user.nombre, rol: user.rol });
    const { name, value, options } = setSessionCookie(token);

    const res = NextResponse.json({ user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } });
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]);
    return res;
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
