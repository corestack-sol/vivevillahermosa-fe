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
 *  3. JPEG/PNG/WebP/GIF/HEIC/HEIF/AVIF pasan SIN decodificar: el backend ya
 *     los acepta tal cual y convierte HEIC/HEIF/AVIF a JPEG él mismo con
 *     Cloudinary (docs/BACKEND-FOTOS-FORMATOS-23092026.md, PR #146,
 *     2026-09-27) — antes el navegador tenía que decodificarlos para
 *     convertirlos, y Chrome/Firefox no saben abrir HEIC nativamente, así que
 *     la mayoría de Android terminaba pidiéndole a la persona que la guardara
 *     como JPG a mano. Ya no hace falta: se sube igual que un JPEG (y si pesa
 *     más del límite, `abrirHeicConWasm` la reduce con libheif-js en
 *     cualquier navegador, sin depender de Safari).
 *  4. Solo BMP (el backend no lo acepta) se convierte a JPEG en el navegador
 *     si este sabe abrirlo; si no, se avisa con la acción concreta, nunca
 *     con un genérico "no válida".
 */

export type FormatoImagen = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif' | 'image/heic' | 'image/bmp';

/** Los que el backend acepta tal cual (POST /propiedades/fotos, verificado en vivo; HEIC/AVIF los convierte él mismo). */
const ACEPTADOS_POR_BACKEND: FormatoImagen[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/avif'];

/** Límite real de POST /propiedades/fotos: 5MB, no 8 (docs/BACKEND-FOTOS-FORMATOS-23092026.md, PR #146, confirmado 2026-09-27). */
export const MAX_SUBIDA_BYTES = 5 * 1024 * 1024;

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

/**
 * Último recurso para HEIC: Chrome/Firefox/Android no lo decodifican nativamente
 * (ni con `createImageBitmap` ni con `<img>`), así que aquí se decodifica con
 * libheif-js (WASM, ~2MB) — SOLO se importa si de verdad hace falta, nunca en
 * el camino normal (JPEG/PNG/WebP/HEIC-en-Safari ya se resuelven antes de
 * llegar aquí). Esto es lo que cierra de verdad el riesgo de HEIC pesado
 * (>5MB, típico del modo "48MP" de iPhone) bloqueando a alguien en Android:
 * ya no depende de que decodifique para poder reducirlo antes de subir.
 */
async function abrirHeicConWasm(blob: Blob): Promise<ImagenAbierta | null> {
  try {
    const bytes = new Uint8Array(await leerBytes(blob));
    const { default: libheif } = await import('libheif-js/wasm-bundle');
    const imagenes = new libheif.HeifDecoder().decode(bytes);
    if (!imagenes.length) return null;
    const imagen = imagenes[0];
    const w = imagen.get_width();
    const h = imagen.get_height();
    if (!w || !h) return null;
    const imageData = new ImageData(w, h);
    const ok = await new Promise<boolean>((resolve) => {
      imagen.display(imageData, (resultado) => resolve(!!resultado));
    });
    if (!ok) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(imageData, 0, 0);
    return { dibujable: canvas, width: w, height: h, liberar: () => imagen.free() };
  } catch {
    return null;
  }
}

/** createImageBitmap, si falla un <img> normal y, si es HEIC, libheif-js — con tope de espera para no colgarse. */
async function abrirImagen(blob: Blob): Promise<ImagenAbierta | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    return { dibujable: bitmap, width: bitmap.width, height: bitmap.height, liberar: () => bitmap.close() };
  } catch { /* se intenta con <img> */ }

  const viaImg = await new Promise<ImagenAbierta | null>((resolve) => {
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
  if (viaImg) return viaImg;

  if (blob.type === 'image/heic') return abrirHeicConWasm(blob);
  return null;
}

/**
 * Cachea por (blob, maxLado, calidad): `advertenciaPesoExcesivo` y `blobParaSubir` se
 * llaman sobre el MISMO File con los MISMOS parámetros (1920/0.92) — antes, un HEIC
 * pesado que solo libheif-js puede abrir se decodificaba dos veces (una al elegir la
 * foto, otra al publicar), y esa decodificación es la parte cara. `WeakMap` para que
 * el File se pueda liberar de memoria normalmente cuando ya no se use en ningún lado.
 */
const cacheConversion = new WeakMap<Blob, Map<string, Promise<Blob | null>>>();

/** Decodifica, reduce a `maxLado` y devuelve un JPEG; `null` si este navegador no puede abrir la imagen. */
export function convertirAJpeg(blob: Blob, maxLado: number, calidad: number): Promise<Blob | null> {
  const clave = `${maxLado}:${calidad}`;
  let porBlob = cacheConversion.get(blob);
  if (!porBlob) { porBlob = new Map(); cacheConversion.set(blob, porBlob); }
  const enCache = porBlob.get(clave);
  if (enCache) return enCache;
  const promesa = convertirAJpegSinCache(blob, maxLado, calidad);
  porBlob.set(clave, promesa);
  return promesa;
}

async function convertirAJpegSinCache(blob: Blob, maxLado: number, calidad: number): Promise<Blob | null> {
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

/**
 * ¿Esta foto se puede llegar a subir? Se llama al ELEGIRLA, no hasta Publicar.
 *
 * `blobParaSubir()` reduce casi cualquier foto a unos cientos de KB — el límite
 * del servidor (5MB) no bloquea JPEG/PNG/WebP/GIF en la práctica porque el
 * navegador SIEMPRE puede decodificarlos para reducirlos, y HEIC ahora también
 * se puede reducir en cualquier navegador vía `abrirHeicConWasm`. Esta función
 * solo cubre el resto: un HEIC corrupto/no estándar que ni siquiera libheif-js
 * pueda decodificar, y que además pese más de 5MB (pasa con el modo "48MP" de
 * los iPhone Pro) — antes la persona se enteraba hasta el final, al publicar,
 * después de llenar todo el formulario.
 *
 * Devuelve `null` si la foto no tiene problema (siempre, si ya pesa ≤5MB: no
 * hace falta intentar reducirla para saber que va a caber). Solo para
 * archivos MÁS PESADOS que el límite se intenta reducir aquí mismo, para
 * avisar de inmediato si no se va a poder.
 */
export async function advertenciaPesoExcesivo(file: File): Promise<string | null> {
  if (file.size <= MAX_SUBIDA_BYTES) return null;
  const reducida = await convertirAJpeg(file, 1920, 0.92);
  if (reducida && reducida.size > 0) return null;
  const mb = (file.size / 1024 / 1024).toFixed(1);
  return `Esta foto pesa ${mb}MB y no se pudo reducir automáticamente. Ábrela en tu galería, compártela o guárdala como JPG (pesa mucho menos) y vuelve a elegirla.`;
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
      // HEIC/HEIF/AVIF ya no llegan aquí: el backend los acepta y los convierte él mismo
      // (ver ACEPTADOS_POR_BACKEND). Lo único que puede caer en este caso hoy es BMP.
      const nombre = formato === 'image/bmp' ? 'BMP' : 'un formato';
      return `${sujeto} en formato ${nombre} que este navegador no puede convertir. Cámbiala${plural ? 's' : ''} a JPG (en la galería: compartir o guardar como JPG) e inténtalo de nuevo.`;
    }
  }
}
