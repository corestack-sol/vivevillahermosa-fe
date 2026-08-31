// Subido de 8MB a 20MB — 2026-08-22: bug real reportado desde el día
// anterior ("algunas fotos caen como rotas, otras sí pasan"). Root cause:
// un teléfono reciente (ej. iPhone 14/15 Pro, sensores de 48MP) produce
// fotos de cámara que fácilmente pesan 10-20MB — con el límite viejo de
// 8MB, esas se rechazaban aquí. El rechazo no se veía al agregar la foto
// (analizarFoto() en PublishForm.tsx trata cualquier error, incluido este,
// como neutral — "fail open" pensado para fallas de red, no para este
// caso), así que la foto se mostraba normal en la grilla y solo fallaba en
// silencio hasta publicar, sin explicar por qué.
//
// Este límite es sobre la memoria del NAVEGADOR de quien publica, nunca
// sobre almacenamiento — el archivo que de verdad viaja a Cloudinary
// siempre es el resultado YA redimensionado (1280px, JPEG calidad 0.85,
// unos cientos de KB), sin importar qué tan pesado era el original.
// FileReader.readAsDataURL() lee el archivo entero a un string base64
// (~33% más grande) y luego se decodifica a píxeles crudos en memoria para
// el canvas — eso es lo que puede colgar un equipo modesto con un archivo
// absurdamente grande, no el peso final subido. 20MB cubre virtualmente
// cualquier JPEG/HEIC de cámara de teléfono actual con margen de sobra.
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024; // 20MB

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
      reject(new Error('La imagen pesa demasiado (máximo 20MB). Elige un archivo más ligero.'));
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
