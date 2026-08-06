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

  // Ver comentario equivalente en google/callback/route.ts — conserva el
  // destino original si el login con Facebook falla.
  const fail = (err: string) => NextResponse.redirect(
    `${BASE}/auth/login?error=${err}${next !== '/dashboard' ? `&next=${encodeURIComponent(next)}` : ''}`
  );

  if (!code || !state || state !== savedState) return fail('state');

  // Exchange code for access token
  const tokenParams = new URLSearchParams({
    client_id:     process.env.FACEBOOK_APP_ID!,
    client_secret: process.env.FACEBOOK_APP_SECRET!,
    code,
    redirect_uri:  `${BASE}/api/auth/facebook/callback`,
  });

  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams}`
  );
  if (!tokenRes.ok) return fail('token');
  const tokens = await tokenRes.json() as { access_token: string };

  // Fetch Facebook profile
  const profileRes = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokens.access_token}`
  );
  if (!profileRes.ok) return fail('profile');

  const profile = await profileRes.json() as {
    id: string; name: string; email?: string;
    picture?: { data?: { url?: string } };
  };

  const email  = profile.email ?? `fb_${profile.id}@social.vivevillahermosa.mx`;
  const avatar = profile.picture?.data?.url;

  // Ver comentario equivalente en google/callback/route.ts — no vincular
  // automáticamente por coincidencia de email a una cuenta con contraseña
  // ya existente previene "account pre-hijacking" (hallazgo C1).
  let user = await prisma.user.findUnique({ where: { facebookId: profile.id } });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({ where: { email } });

    if (existingByEmail) {
      if (existingByEmail.password) {
        return fail('account_exists');
      }
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data:  { facebookId: profile.id, avatar: avatar ?? existingByEmail.avatar },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          nombre:     profile.name,
          facebookId: profile.id,
          avatar,
          rol:        'buscador',
        },
      });
    }
  }

  // Mismo bloqueo que el login por contraseña (ver moderacionBusqueda.ts).
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
