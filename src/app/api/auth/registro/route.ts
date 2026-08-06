import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

const BCRYPT_COST = 12; // subido de 10 — guía actual recomienda 12+ (hallazgo M4)

const schema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  // Mínimo subido de 6 a 10 caracteres (hallazgo H4) — 6 es trivialmente
  // fuerza-bruteable y hoy es la única barrera real de la cuenta, ya que
  // aún no existe verificación de correo ni MFA.
  password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres'),
  rol: z.enum(['buscador', 'propietario', 'agente']).default('buscador'),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = checkRateLimit(`registro:ip:${ip}`, 8, 60 * 60 * 1000);
    if (!limited.ok) return rateLimitResponse(limited.resetAt);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { nombre, email, password, rol } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, BCRYPT_COST);
    const user = await prisma.user.create({ data: { nombre, email, password: hashed, rol } });

    const token = await createSession({ userId: user.id, email: user.email, nombre: user.nombre, rol: user.rol });
    const { name, value, options } = setSessionCookie(token);

    const res = NextResponse.json({ user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } });
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]);
    return res;
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
