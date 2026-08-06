import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const perfil = await prisma.perfilInmobiliaria.findUnique({ where: { userId: session.userId } });
  return NextResponse.json({ perfil });
}

// El logo se redimensiona y comprime en el navegador antes de llegar aquí
// (ver src/app/dashboard/perfil/page.tsx) — este límite es una segunda
// barrera contra un data URI gigante llegando directo a la API.
const MAX_LOGO_LENGTH = 400_000;

const schema = z.object({
  nombreEmpresa: z.string().trim().max(100).optional().nullable(),
  logoDataUrl: z.string()
    .max(MAX_LOGO_LENGTH, 'La imagen es demasiado grande')
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/, 'Formato de imagen inválido')
    .optional()
    .nullable(),
});

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { nombreEmpresa, logoDataUrl } = parsed.data;

  const perfil = await prisma.perfilInmobiliaria.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, nombreEmpresa, logoDataUrl },
    update: {
      ...(nombreEmpresa !== undefined ? { nombreEmpresa } : {}),
      ...(logoDataUrl !== undefined ? { logoDataUrl } : {}),
    },
  });

  return NextResponse.json({ perfil });
}
