import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';

const SELECT_USUARIO = {
  id: true, email: true, nombre: true, rol: true, esAdmin: true,
  bloqueado: true, bloqueadoMotivo: true, bloqueadoEn: true, createdAt: true,
} as const;

const perPage = 20;
// Tope del candidate set cuando hay texto de búsqueda — ver comentario
// más abajo sobre por qué el filtro de acentos no puede vivir en SQL.
const MAX_CANDIDATOS_BUSQUEDA = 1000;

// SQLite pliega mayúsculas/minúsculas de `contains` solo para ASCII — "Andrés"
// no matchea buscando "andres" (acento distinto), y Prisma no soporta
// `mode: 'insensitive'` para SQLite (a diferencia de Postgres). Se
// normaliza (minúsculas + sin diacríticos) para comparar en JS.
function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const soloBloqueados = searchParams.get('bloqueados') === '1';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const whereBase = soloBloqueados ? { bloqueado: true } : {};

  if (!q) {
    const [usuarios, total] = await Promise.all([
      prisma.user.findMany({
        where: whereBase,
        select: SELECT_USUARIO,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.user.count({ where: whereBase }),
    ]);
    return NextResponse.json({ usuarios, total, page, perPage });
  }

  // Con búsqueda: se trae un candidate set acotado (no toda la tabla —
  // ver hallazgo de queries sin límite) filtrado por `bloqueados` en SQL,
  // y el match de texto (acento-insensible) se hace en JS sobre ese set.
  const candidatos = await prisma.user.findMany({
    where: whereBase,
    select: SELECT_USUARIO,
    orderBy: { createdAt: 'desc' },
    take: MAX_CANDIDATOS_BUSQUEDA,
  });

  const qNormalizado = normalizar(q);
  const coincidencias = candidatos.filter(
    (u) => normalizar(u.email).includes(qNormalizado) || normalizar(u.nombre).includes(qNormalizado)
  );

  const total = coincidencias.length;
  const usuarios = coincidencias.slice((page - 1) * perPage, page * perPage);
  return NextResponse.json({ usuarios, total, page, perPage });
}
