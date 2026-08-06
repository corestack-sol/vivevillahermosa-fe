import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import { safeRedirectPath } from '@/lib/safeRedirect';

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieHeader = request.headers.get('cookie') ?? '';
  const savedState   = cookieHeader.match(/oauth_state=([^;]+)/)?.[1];
  const next         = safeRedirectPath(cookieHeader.match(/oauth_next=([^;]+)/)?.[1]);

  // Si el login con Google falla, vuelve a /auth/login conservando a dónde
  // quería llegar el usuario (ej. /publicar), para no perder ese contexto.
  const fail = (err: string) => NextResponse.redirect(
    `${BASE}/auth/login?error=${err}${next !== '/dashboard' ? `&next=${encodeURIComponent(next)}` : ''}`
  );

  if (!code || !state || state !== savedState) return fail('state');

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  `${BASE}/api/auth/google/callback`,
    }),
  });

  if (!tokenRes.ok) return fail('token');
  const tokens = await tokenRes.json() as { access_token: string };

  // Fetch Google profile
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileRes.ok) return fail('profile');
  const profile = await profileRes.json() as {
    sub: string; email: string; name: string; picture?: string;
  };

  if (!profile.email) return fail('no_email');

  // Busca por googleId primero — vincular solo por email sin más prueba
  // permite "account pre-hijacking": alguien registra una cuenta con
  // contraseña usando el correo de otra persona, y cuando la víctima
  // después inicia sesión con Google, quedaría fusionada con la cuenta que
  // el atacante ya controla (hallazgo C1 de la auditoría). Mientras no
  // exista verificación de correo en /api/auth/registro, no se debe
  // vincular automáticamente una cuenta social a una cuenta con contraseña
  // ya existente.
  let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });

    if (existingByEmail) {
      if (existingByEmail.password) {
        return fail('account_exists');
      }
      // Cuenta creada previamente por otro proveedor social (Facebook) sin
      // contraseña — vincular aquí es seguro porque ningún atacante pudo
      // "reservar" el correo con un secreto que él controla.
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data:  { googleId: profile.sub, avatar: profile.picture ?? existingByEmail.avatar },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email:    profile.email,
          nombre:   profile.name,
          googleId: profile.sub,
          avatar:   profile.picture,
          rol:      'buscador',
        },
      });
    }
  }

  // Mismo bloqueo que el login por contraseña (ver moderacionBusqueda.ts) —
  // sin esto, una cuenta bloqueada podía sortearlo simplemente entrando por
  // Google en vez de con su contraseña.
  if (user.bloqueado) return fail('bloqueado');

  const token = await createSession({
    userId: user.id, email: user.email, nombre: user.nombre, rol: user.rol,
  });
  const { name, value, options } = setSessionCookie(token);

  const res = NextResponse.redirect(`${BASE}${next}`);
  res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]);
  res.cookies.delete('oauth_state');
  res.cookies.delete('oauth_next');
  return res;
}
