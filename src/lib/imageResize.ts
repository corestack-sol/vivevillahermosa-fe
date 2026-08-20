const MAX_SOURCE_BYTES = 8 * 1024 * 1024; // 8MB

/**
 * Redimensiona una imagen a un cuadro máximo (por defecto 320px) y la
 * devuelve como data URI PNG — corre entero en el navegador via <canvas>,
 * así el archivo que llega al servidor ya es pequeño. El límite del lado
 * servidor vive en el backend separado (NestJS, fuera de este repo desde
 * el pivote de arquitectura 2026-08-06) — este comentario antes apuntaba a
 * una ruta de este mismo repo que ya no existe.
 *
 * El límite de tamaño de salida ya está resuelto por el resize — lo que
 * faltaba era un límite de *entrada*: sin esto, elegir una foto de 40MB
 * intentaba leerla completa a un data URI en memoria (≈53MB en base64)
 * antes de siquiera llegar al canvas, lo que puede colgar la pestaña en un
 * equipo modesto. Se rechaza antes de tocar FileReader.
 */
/**
 * `format`/`quality` son opcionales y PNG sin pérdida sigue siendo el
 * default (necesario para el logo, que quiere transparencia) — pero para
 * fotos de contenido (portafolio de servicios) hay que pasar
 * 'image/jpeg' con calidad, porque un PNG sin pérdida de una foto real
 * (mucho detalle/textura) pesa varias veces más que el límite del
 * servidor, incluso ya redimensionada a un tamaño razonable.
 */
export function resizeImageToDataUrl(
  file: File,
  maxSize = 320,
  format: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  quality?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_SOURCE_BYTES) {
      reject(new Error('La imagen pesa demasiado (máximo 8MB). Elige un archivo más ligero.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No se pudo procesar la imagen')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL(format, quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
