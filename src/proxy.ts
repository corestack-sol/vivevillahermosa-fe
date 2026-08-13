import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Red de seguridad server-side para rutas protegidas (hallazgo M1 de la
// auditoría): antes de esto, /dashboard, /favoritos y /alertas dependían
// únicamente de un useEffect del lado del cliente para redirigir si no
// había sesión. Las APIs ya validaban sesión por su cuenta, pero nada
// garantizaba que la próxima página o ruta protegida lo recordara.
//
// /publicar se agregó por pedido explícito: solo un usuario con sesión
// iniciada puede publicar una propiedad. /publicar/gracias queda protegida
// también (mismo prefijo) — nadie llega ahí sin pasar primero por el
// formulario autenticado.
//
// /servicios/publicar (directorio de servicios, exploratorio — ver
// docs/BACKEND.md) protege SOLO el formulario, no
// `/servicios` a secas — el directorio y las fichas siguen públicos, igual
// que el catálogo de propiedades.
//
// Nota: en Next.js 16 este archivo se llama `proxy.ts` (antes
// `middleware.ts`) — ver node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
// /admin: esto solo exige que exista una sesión válida (defensa en
// profundidad) — la verificación real de que además sea un admin
// (esAdmin, leído fresco del backend en cada request vía getSession())
// pasa server-side en src/app/admin/layout.tsx, nunca aquí: el edge
// runtime de este archivo solo puede validar la firma del JWT.
const PROTECTED_PATHS = ['/dashboard', '/favoritos', '/alertas', '/publicar', '/servicios/publicar', '/admin'];
const COOKIE = 'vivevillahermosa_session';

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  if (!isProtected(request.nextUrl.pathname)) return NextResponse.next();

  const token = request.cookies.get(COOKIE)?.value;
  const secret = process.env.JWT_SECRET;

  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      return NextResponse.next();
    } catch {
      // token inválido o expirado — cae a la redirección de abajo
    }
  }

  const loginUrl = new URL('/auth/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/favoritos/:path*', '/alertas/:path*', '/publicar/:path*', '/servicios/publicar/:path*', '/admin/:path*'],
};
