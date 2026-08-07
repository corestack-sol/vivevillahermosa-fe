import { prisma } from './db';

/**
 * "3 avisos" para cuentas que intentan manipular el buscador con IA — usa
 * el MISMO detector que ya protege busquedaInteligente()/analizarFraude/
 * generarDescripcionAnuncio/generarResumenReporte (marcadorDeInyeccion en
 * ai.ts), no un heurístico nuevo pensado para juzgar personas. Solo aplica
 * a cuentas con sesión iniciada — un visitante anónimo no tiene cuenta que
 * avisar ni bloquear, su límite sigue siendo el rate-limit por IP existente
 * (ver src/app/api/ia/*\/route.ts).
 *
 * Deliberadamente NO se activa por cosas como "búsqueda rara" o "precio
 * fuera de rango" — solo por el mismo patrón de manipulación deliberada
 * (jailbreak, extracción de instrucciones) que ya se demostró que casi
 * nunca aparece por accidente en una búsqueda real de propiedad.
 */
const LIMITE_INTENTOS = 3;

export interface ResultadoModeracion {
  strikes: number;
  bloqueado: boolean;
}

/**
 * Registra un intento confirmado contra la cuenta — guarda el texto EXACTO
 * de la búsqueda y qué frase lo disparó (no solo un contador), para que un
 * bloqueo se pueda auditar/explicar de verdad si alguien lo reclama, en vez
 * de depender de un número sin contexto. El conteo de intentos siempre se
 * DERIVA de este registro (`count()`), nunca de un campo cacheado aparte —
 * una sola fuente de verdad para lo que también sirve de evidencia.
 *
 * 1er y 2do intento: notificación in-app de aviso, citando la búsqueda tal
 * cual para que la persona vea exactamente qué se marcó (transparencia, no
 * "confía en nosotros"). 3er intento: la cuenta queda `bloqueado:true` — no
 * puede volver a iniciar sesión (ver login/route.ts) y `getSession()`
 * invalida incluso una sesión ya activa (ver auth.ts) — y gana el badge
 * "En revisión" visible en su AgentCard para otros usuarios (ver
 * estaEnRevision más abajo).
 *
 * Fire-and-forget desde quien llama: nunca debe hacer más lenta ni fallar
 * la búsqueda real de la persona por un problema al registrar el intento.
 */
export async function registrarIntentoSospechoso(
  userId: string,
  consulta: string,
  marcador: string
): Promise<ResultadoModeracion> {
  await prisma.intentoSospechoso.create({ data: { userId, consulta, marcador } });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { bloqueado: true, bloqueoResueltoEn: true } });
  // Cuenta solo intentos DESPUÉS del último desbloqueo (manual o por
  // apelación aprobada) — no el historial completo. Sin este filtro, una
  // cuenta reactivada con 3 IntentoSospechoso viejos se re-bloqueaba con
  // un solo intento nuevo (4to acumulado ≥ 3), no con 3 nuevos de verdad.
  // El historial completo se conserva igual (nunca se borra, sirve de
  // auditoría vía obtenerHistorialSospechoso) — solo el CONTEO que decide
  // el bloqueo se acota a la ventana desde el último desbloqueo.
  const strikes = await prisma.intentoSospechoso.count({
    where: { userId, ...(user?.bloqueoResueltoEn ? { createdAt: { gt: user.bloqueoResueltoEn } } : {}) },
  });

  if (strikes >= LIMITE_INTENTOS) {
    if (!user?.bloqueado) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          bloqueado: true,
          bloqueadoMotivo: 'Uso indebido repetido del buscador con IA (intentos de manipulación detectados 3 veces)',
          bloqueadoEn: new Date(),
        },
      });
      await prisma.notificacion.create({
        data: {
          userId,
          tipo: 'cuenta_bloqueada',
          titulo: 'Tu cuenta fue bloqueada',
          mensaje: 'Detectamos uso indebido repetido de la plataforma (intentos de manipular el buscador, 3 veces). Tu cuenta quedó bloqueada y no podrás iniciar sesión. Si crees que es un error, contáctanos y podemos revisar el registro de lo que se detectó.',
        },
      });
    }
    return { strikes, bloqueado: true };
  }

  await prisma.notificacion.create({
    data: {
      userId,
      tipo: 'aviso_uso_indebido',
      titulo: 'Detectamos un uso indebido de la plataforma',
      mensaje: `Nuestro sistema detectó un intento de manipular el buscador en esta búsqueda tuya: "${consulta}" (aviso ${strikes} de ${LIMITE_INTENTOS - 1}). Si vuelve a pasar una vez más, tu cuenta será bloqueada.`,
    },
  });
  return { strikes, bloqueado: false };
}

/**
 * Para AgentCard: ¿la cuenta detrás de este correo está bloqueada por uso
 * indebido? Se consulta por `Property.emailCuenta` (no por `Property.userId`,
 * que no existe todavía — ver docs/BACKEND.md §3) porque es el
 * mismo mecanismo ya usado para enrutar mensajes de contacto al dueño real
 * sin depender de esa relación pendiente.
 */
export async function estaEnRevision(emailCuenta: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email: emailCuenta }, select: { bloqueado: true } });
  return user?.bloqueado ?? false;
}

/**
 * Historial completo de intentos de una cuenta, más reciente primero — la
 * auditoría real en caso de aclaración. No hay todavía una vista de admin
 * que lo consuma (⚠️ BACKEND: sería el siguiente paso natural, un panel
 * simple que liste `IntentoSospechoso` por usuario), pero la función ya
 * está lista para reusarse ahí sin cambios.
 */
export async function obtenerHistorialSospechoso(userId: string) {
  return prisma.intentoSospechoso.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}
