/**
 * Ejecuta tareas de una en una y, cuando una choca con un límite de
 * peticiones (429), deja de llamar al servidor durante `cooldownMs` — las
 * tareas siguientes reciben el resultado de respaldo sin salir a la red.
 *
 * Reporte 2026-09-23 ("muchas peticiones al servidor"): medido en vivo,
 * POST /ia/analizar-imagen responde 429 desde la primera petición y durante
 * minutos; el formulario lo llamaba una vez por foto, todas a la vez, y
 * otra vez por cada foto en cada reintento — cada llamada bloqueada seguía
 * sumando peticiones. Con esto, tras el primer 429 no se insiste.
 */
export function crearEjecutorConEnfriamiento({ cooldownMs, esLimite, ahora = () => Date.now() }: {
  cooldownMs: number;
  esLimite: (e: unknown) => boolean;
  ahora?: () => number;
}) {
  let cola: Promise<unknown> = Promise.resolve();
  let bloqueadoHasta = 0;

  function ejecutar<T>(tarea: () => Promise<T>, respaldo: () => T): Promise<T> {
    const resultado = cola.then(async () => {
      if (ahora() < bloqueadoHasta) return respaldo();
      try {
        return await tarea();
      } catch (e) {
        if (esLimite(e)) {
          bloqueadoHasta = ahora() + cooldownMs;
          return respaldo();
        }
        throw e;
      }
    });
    cola = resultado.catch(() => undefined);
    return resultado;
  }

  return { ejecutar, estaBloqueado: () => ahora() < bloqueadoHasta };
}
