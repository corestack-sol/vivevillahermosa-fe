/**
 * Subida de fotos al publicar/editar, pensada para NO multiplicar
 * peticiones.
 *
 * Reporte 2026-09-23 ("muchas peticiones al servidor", "solo se debería
 * enviar una vez"): al presionar Publicar se subían todas las fotos a la
 * vez, y si algo fallaba (o la persona reintentaba) se volvían a subir TODAS
 * desde cero — cada intento costaba N+1 peticiones y empujaba al límite del
 * servidor. Aquí:
 *  - lo ya subido se guarda por foto y un reintento solo envía lo que falta;
 *  - máximo `concurrencia` subidas simultáneas (no todas de golpe);
 *  - un 429 se reintenta unas pocas veces con espera creciente antes de rendirse.
 */

export interface FalloSubida {
  indice: number;
  error: unknown;
  /** El fallo fue por límite de peticiones (429), no por la foto en sí. */
  limite: boolean;
}

export interface ResultadoSubida {
  /** URL por foto, en el orden original; `null` si esa foto falló. */
  urls: (string | null)[];
  fallos: FalloSubida[];
  /** Cuántas fotos se reutilizaron de un intento anterior (no se volvieron a enviar). */
  reutilizadas: number;
}

export interface OpcionesSubida {
  concurrencia: number;
  reintentosPorLimite: number;
  esperaMs: (intento: number) => number;
  esLimite: (e: unknown) => boolean;
  dormir?: (ms: number) => Promise<void>;
}

const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * `clave` identifica cada foto entre intentos (en el formulario, el `File`:
 * el objeto de la foto se recrea al actualizar su análisis, el archivo no).
 */
export async function subirFotos<T, K extends object>(
  items: T[],
  cache: Map<K, string>,
  clave: (item: T) => K,
  subirUna: (item: T) => Promise<string>,
  opciones: OpcionesSubida,
): Promise<ResultadoSubida> {
  const dormir = opciones.dormir ?? dormirReal;
  const urls: (string | null)[] = items.map((it) => cache.get(clave(it)) ?? null);
  const reutilizadas = urls.filter((u) => u !== null).length;
  const fallos: FalloSubida[] = [];
  const pendientes = items.map((_, i) => i).filter((i) => urls[i] === null);

  async function subirConReintento(indice: number): Promise<void> {
    for (let intento = 0; ; intento++) {
      try {
        const url = await subirUna(items[indice]);
        cache.set(clave(items[indice]), url);
        urls[indice] = url;
        return;
      } catch (error) {
        const limite = opciones.esLimite(error);
        if (limite && intento < opciones.reintentosPorLimite) {
          await dormir(opciones.esperaMs(intento));
          continue;
        }
        fallos.push({ indice, error, limite });
        return;
      }
    }
  }

  let siguiente = 0;
  async function trabajador() {
    while (siguiente < pendientes.length) {
      const indice = pendientes[siguiente++];
      await subirConReintento(indice);
    }
  }
  await Promise.all(Array.from({ length: Math.min(opciones.concurrencia, pendientes.length) }, trabajador));

  fallos.sort((a, b) => a.indice - b.indice);
  return { urls, fallos, reutilizadas };
}
