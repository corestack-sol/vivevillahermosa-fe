import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { safeRedirectPath } from '@/lib/safeRedirect';

export async function GET(request: Request) {
  if (!process.env.FACEBOOK_APP_ID) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/auth/login?error=config`
    );
  }

  const state = randomBytes(16).toString('hex');
  const next  = safeRedirectPath(new URL(request.url).searchParams.get('next'));

  const params = new URLSearchParams({
    client_id:     process.env.FACEBOOK_APP_ID,
    redirect_uri:  `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/facebook/callback`,
    response_type: 'code',
    scope:         'email,public_profile',
    state,
  });

  const res = NextResponse.redirect(
    `https://www.facebook.com/v19.0/dialog/oauth?${params}`
  );

  res.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  res.cookies.set('oauth_next', next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return res;
}
