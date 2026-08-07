/**
 * Vuelve admin a una cuenta ya existente — no hay ni debe haber un camino
 * público para esto (nadie debería poder auto-promoverse). Uso manual,
 * una sola vez por cada primer admin de un ambiente:
 *
 *   npx tsx scripts/hacer-admin.ts correo@ejemplo.com
 *
 * Admins adicionales después de este primero se promueven desde el propio
 * panel (/admin/usuarios, POST /api/admin/usuarios/:id/promover) por un
 * admin ya existente — este script es solo para arrancar el primero.
 */
import { prisma } from '../src/lib/db';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: npx tsx scripts/hacer-admin.ts correo@ejemplo.com');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No existe ninguna cuenta con el correo "${email}".`);
    process.exit(1);
  }

  if (user.esAdmin) {
    console.log(`"${email}" ya es admin — nada que hacer.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { esAdmin: true } });
  console.log(`Listo — "${email}" (${user.nombre}) ahora es admin.`);
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
