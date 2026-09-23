/**
 * Preparación de fotos para publicar/editar — el navegador NUNCA decide si
 * una foto "sirve".
 *
 * Reporte 2026-09-23: en Android, fotos genuinas (recibidas por WhatsApp y
 * propias) salían como "no es una imagen válida"; en iPhone todo funcionaba.
 * Causa de fondo: el formulario dependía de que el NAVEGADOR decodificara la
 * foto (`file.type`, extensión, `createImageBitmap`) solo para decidir si
 * aceptarla, y en Android eso falla por motivos ajenos a la foto (tipo vacío
 * en archivos que entrega el teléfono, archivos respaldados por un proveedor
 * de contenido que fallan al leerse después, límites de memoria). Verificado
 * en vivo el mismo día: el backend valida por los BYTES del archivo (JPEG,
 * PNG, WebP, GIF), sin mirar nombre ni tipo — un JPEG llamado ".heic" con
 * tipo vacío se acepta sin problema.
 *
 * Por eso aquí se usa la misma regla que el backend:
 *  1. Se lee el archivo completo a memoria al elegirlo (no vuelve a depender
 *     del archivo del teléfono, que puede volverse ilegible minutos después).
 *  2. El formato se detecta por los bytes.
 *  3. JPEG/PNG/WebP/GIF pasan SIN decodificar: no hay nada que pueda fallar.
 *  4. HEIC/AVIF/BMP (el backend no los acepta) se convierten a JPEG en el
 *     navegador si este sabe abrirlos (Safari HEIC, Chrome AVIF); si no, se
 *     avisa con la acción concreta, nunca con un genérico "no válida".
 */

export type FormatoImagen = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif' | 'image/heic' | 'image/bmp';

/** Los que el backend acepta tal cual (POST /propiedades/fotos, verificado en vivo). */
const ACEPTADOS_POR_BACKEND: FormatoImagen[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Límite real de POST /propiedades/fotos (docs/BACKEND-FOTOS-CLOUDINARY-22082026.md). */
export const MAX_SUBIDA_BYTES = 8 * 1024 * 1024;

const EXTENSION: Record<FormatoImagen, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/avif': 'avif', 'image/heic': 'heic', 'image/bmp': 'bmp',
};

/** Formato según los primeros bytes (no confía en extensión ni en `file.type`). */
export function detectarFormatoImagen(b: Uint8Array): FormatoImagen | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(b.slice(from, to)));
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 12 && ascii(4, 8) === 'ftyp') {
    const marca = ascii(8, 12);
    if (marca === 'avif' || marca === 'avis') return 'image/avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif'].includes(marca)) return 'image/heic';
  }
  return null;
}

export type MotivoRechazoFoto = 'vacio' | 'ilegible' | 'no-es-imagen' | 'formato-no-soportado';

export type ResultadoPreparacion =
  | { ok: true; file: File; convertida: boolean; formatoOriginal: FormatoImagen }
  | { ok: false; motivo: MotivoRechazoFoto; formato?: FormatoImagen; error: string };

const nombreError = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 160) : String(e).slice(0, 160));

function leerBytes(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error ?? new Error('No se pudo leer el archivo'));
    r.readAsArrayBuffer(file);
  });
}

function nombreConExtension(nombre: string, formato: FormatoImagen): string {
  const base = nombre.replace(/\.[^./\\]+$/, '').trim() || 'foto';
  return `${base}.${EXTENSION[formato]}`;
}

interface ImagenAbierta {
  dibujable: CanvasImageSource;
  width: number;
  height: number;
  liberar: () => void;
}

const ESPERA_MAX_IMG_MS = 10_000;

/** createImageBitmap y, si falla, un <img> normal — con tope de espera para no colgarse. */
async function abrirImagen(blob: Blob): Promise<ImagenAbierta | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    return { dibujable: bitmap, width: bitmap.width, height: bitmap.height, liberar: () => bitmap.close() };
  } catch { /* se intenta con <img> */ }

  return new Promise((resolve) => {
    let url: string;
    try { url = URL.createObjectURL(blob); } catch { resolve(null); return; }
    const img = new Image();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); resolve(null); }, ESPERA_MAX_IMG_MS);
    img.onload = () => {
      clearTimeout(timer);
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ dibujable: img, width: img.naturalWidth, height: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) });
      } else { URL.revokeObjectURL(url); resolve(null); }
    };
    img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/** Decodifica, reduce a `maxLado` y devuelve un JPEG; `null` si este navegador no puede abrir la imagen. */
export async function convertirAJpeg(blob: Blob, maxLado: number, calidad: number): Promise<Blob | null> {
  const abierta = await abrirImagen(blob);
  if (!abierta) return null;
  try {
    const escala = Math.min(1, maxLado / Math.max(abierta.width, abierta.height));
    const w = Math.max(1, Math.round(abierta.width * escala));
    const h = Math.max(1, Math.round(abierta.height * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // JPEG no tiene transparencia: sin fondo, un PNG con alfa saldría negro.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(abierta.dibujable, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', calidad));
  } catch {
    return null;
  } finally {
    abierta.liberar();
  }
}

/**
 * Paso único al elegir una foto. Devuelve un File EN MEMORIA con el formato
 * correcto en `type` y en la extensión, listo para miniatura, análisis y
 * subida — o el motivo concreto por el que no se puede usar.
 */
export async function prepararFoto(original: File): Promise<ResultadoPreparacion> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await leerBytes(original));
  } catch (e) {
    return { ok: false, motivo: 'ilegible', error: nombreError(e) };
  }
  if (bytes.length === 0) return { ok: false, motivo: 'vacio', error: 'archivo de 0 bytes' };

  const formato = detectarFormatoImagen(bytes);
  if (!formato) return { ok: false, motivo: 'no-es-imagen', error: `tipo declarado: ${original.type || '(vacío)'}` };

  const opciones = { type: formato, lastModified: original.lastModified };
  if (ACEPTADOS_POR_BACKEND.includes(formato)) {
    return {
      ok: true, convertida: false, formatoOriginal: formato,
      file: new File([bytes as BlobPart], nombreConExtension(original.name, formato), opciones),
    };
  }

  const jpeg = await convertirAJpeg(new Blob([bytes as BlobPart], { type: formato }), 4096, 0.92);
  if (!jpeg) return { ok: false, motivo: 'formato-no-soportado', formato, error: `este navegador no abre ${formato}` };
  return {
    ok: true, convertida: true, formatoOriginal: formato,
    file: new File([jpeg], nombreConExtension(original.name, 'image/jpeg'), { type: 'image/jpeg', lastModified: original.lastModified }),
  };
}

/**
 * Lo que se sube a POST /propiedades/fotos: la foto reducida a 1920px si el
 * navegador puede abrirla; si no, el ORIGINAL tal cual (el backend valida por
 * bytes y lo acepta) mientras no pase del límite del servidor. Antes, un fallo
 * al reducir descartaba la foto en silencio al publicar.
 */
export async function blobParaSubir(file: File, maxLado = 1920, calidad = 0.92): Promise<Blob> {
  const reducida = await convertirAJpeg(file, maxLado, calidad);
  if (reducida && reducida.size > 0) return reducida;
  if (file.size <= MAX_SUBIDA_BYTES) return file;
  throw new Error(`La foto pesa ${(file.size / 1024 / 1024).toFixed(1)}MB y este navegador no pudo reducirla (máx. ${MAX_SUBIDA_BYTES / 1024 / 1024}MB).`);
}

/** Texto para la persona, según la causa real — siempre con la acción concreta. */
export function mensajeRechazoFoto(motivo: MotivoRechazoFoto, cantidad: number, formato?: FormatoImagen): string {
  const plural = cantidad !== 1;
  const sujeto = `${cantidad} archivo${plural ? 's' : ''}`;
  switch (motivo) {
    case 'vacio':
      return `${plural ? `${sujeto} llegaron` : 'El archivo llegó'} vacío${plural ? 's' : ''}. Suele pasar con fotos que están en la nube y no se descargaron: ábrela${plural ? 's' : ''} en tu galería o Google Fotos y vuelve a elegirla${plural ? 's' : ''}.`;
    case 'ilegible':
      return `No se pudo leer ${plural ? sujeto : 'el archivo'}. Si viene de WhatsApp o Drive, guárdalo primero en tu galería y elígelo desde ahí.`;
    case 'no-es-imagen':
      return `${sujeto} no ${plural ? 'son' : 'es'} una imagen (usa JPG, PNG o WebP).`;
    case 'formato-no-soportado': {
      const nombre = formato === 'image/heic' ? 'HEIC' : formato === 'image/avif' ? 'AVIF' : 'un formato';
      return `${sujeto} en formato ${nombre} que este navegador no puede convertir. Cámbiala${plural ? 's' : ''} a JPG (en la galería: compartir o guardar como JPG) e inténtalo de nuevo.`;
    }
  }
}
