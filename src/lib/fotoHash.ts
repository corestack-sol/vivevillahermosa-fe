/**
 * Hash perceptual (dHash — difference hash) para detectar fotos casi
 * idénticas, aunque cambien de tamaño/compresión — a diferencia de comparar
 * bytes o nombre de archivo, esto sigue coincidiendo aunque la imagen se
 * haya reprocesado (mismo `resizeImageToDataUrl` que ya usa PublishForm
 * antes de subir).
 *
 * Alcance a propósito: solo compara contra las fotos de las OTRAS
 * propiedades del propio dueño (ver PublishForm.tsx, ya trae
 * GET /propiedades/mias) — atrapa el caso real de "subí la misma foto dos
 * veces por error". Comparar contra el catálogo completo de la plataforma
 * (para atrapar una foto robada de OTRO anuncio) necesitaría un índice de
 * hashes del lado del backend — no algo que el navegador pueda hacer
 * bajando cientos de fotos ajenas en cada publicación. Documentado como
 * pendiente de backend, no fingido aquí.
 *
 * Fail-open en cada paso (mismo criterio que `analizarFoto` en
 * PublishForm.tsx): un CORS bloqueado, una foto que no carga, o cualquier
 * error de red nunca debe bloquear publicar — solo significa que esa
 * comparación en particular no se pudo hacer.
 */

const HASH_W = 9;
const HASH_H = 8;

async function hashDesdeBitmap(bitmap: ImageBitmap): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = HASH_W;
  canvas.height = HASH_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sin contexto 2d');
  ctx.drawImage(bitmap, 0, 0, HASH_W, HASH_H);
  const { data } = ctx.getImageData(0, 0, HASH_W, HASH_H);

  const gris: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gris.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  let bits = '';
  for (let fila = 0; fila < HASH_H; fila++) {
    for (let col = 0; col < HASH_W - 1; col++) {
      const idx = fila * HASH_W + col;
      bits += gris[idx] > gris[idx + 1] ? '1' : '0';
    }
  }

  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4).padEnd(4, '0'), 2).toString(16);
  }
  return hex;
}

/** null = no se pudo calcular (archivo corrupto, etc.) — nunca lanza. */
export async function hashImagenDesdeFile(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const hash = await hashDesdeBitmap(bitmap);
    bitmap.close();
    return hash;
  } catch {
    return null;
  }
}

/**
 * null = no se pudo calcular — típicamente un CORS bloqueado si la URL no
 * responde con encabezados permisivos, o un problema de red. Nunca lanza.
 */
export async function hashImagenDesdeUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const hash = await hashDesdeBitmap(bitmap);
    bitmap.close();
    return hash;
  } catch {
    return null;
  }
}

/** Distancia de Hamming entre dos hashes hex del mismo largo — Infinity si no son comparables. */
export function distanciaHamming(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

/**
 * A partir de qué distancia dos fotos cuentan como "la misma foto" en vez de
 * solo "parecidas" — un dHash de 60 bits (9x8-1 por fila) tolera hasta ~8
 * bits distintos por compresión/redimensión normal sin dejar de ser la
 * misma imagen; más que eso ya son fotos genuinamente distintas del mismo
 * lugar (dos ángulos de la misma sala, por ejemplo), que no debe avisarse.
 */
export const UMBRAL_HASH_SIMILAR = 8;
