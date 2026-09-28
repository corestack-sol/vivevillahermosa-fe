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
export function crearEjecutorConEnfriamiento({ cooldownMs, esLimite, obtenerEsperaMs, ahora = () => Date.now() }: {
  /** Enfriamiento de respaldo cuando el error no trae su propio tiempo de espera. */
  cooldownMs: number;
  esLimite: (e: unknown) => boolean;
  /**
   * Si el 429 trae su propio tiempo de espera (`Retry-After` del servidor), úsalo en vez
   * de `cooldownMs` fijo — 2026-09-27: /ia/analizar-imagen puede estar limitada por 10 min
   * (por IP) o hasta 24h (cupo diario global agotado), y un `cooldownMs` fijo de 90s
   * insistía cada 90s durante horas sin ninguna posibilidad de éxito en el segundo caso.
   */
  obtenerEsperaMs?: (e: unknown) => number | null | undefined;
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
          const espera = obtenerEsperaMs?.(e);
          bloqueadoHasta = ahora() + (espera ?? cooldownMs);
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
