/**
 * Inserta parámetros de transformación de Cloudinary en una URL ya subida
 * — confirmado con backend 2026-08-22 (docs/BACKEND-FOTOS-CLOUDINARY-22082026.md):
 * el backend sube el original SIN comprimir (`cloudinary.uploader.upload_stream`
 * sin transformación eager) y devuelve `secure_url` tal cual
 * (`res.cloudinary.com/<cloud>/image/upload/v<version>/propiedades/<id>.<ext>`).
 * Cloudinary genera la versión transformada la primera vez que se pide esa
 * URL exacta y la cachea después — funciona retroactivo, sin ningún cambio
 * de backend, incluso para fotos ya subidas antes de este cambio.
 *
 * Solo 2 presets fijos (no uno por breakpoint) — pedido explícito del
 * backend: cada transformación nueva que Cloudinary genera consume
 * créditos de la cuenta.
 */
const PRESETS = {
  // Miniaturas: tarjetas de listado, mapa, tira de miniaturas de la galería.
  thumb: 'f_auto,q_auto,w_400',
  // Imagen principal de la ficha y el lightbox.
  full: 'f_auto,q_auto,w_1600',
} as const;

const MARCADOR_UPLOAD = '/image/upload/';

export function cloudinaryTransform(url: string, preset: keyof typeof PRESETS): string {
  // Defensivo: URLs que no son de Cloudinary (ej. las de muestra de
  // Unsplash que trae el catálogo semilla) se devuelven sin tocar.
  if (!url.includes('res.cloudinary.com') || !url.includes(MARCADOR_UPLOAD)) return url;
  return url.replace(MARCADOR_UPLOAD, `${MARCADOR_UPLOAD}${PRESETS[preset]}/`);
}
