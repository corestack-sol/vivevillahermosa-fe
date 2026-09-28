import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectarFormatoImagen, prepararFoto, blobParaSubir, mensajeRechazoFoto, advertenciaPesoExcesivo, MAX_SUBIDA_BYTES } from './fotoArchivo';

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const WEBP = [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')];
const GIF = [...ascii('GIF89a'), 1, 0, 1, 0];
const HEIC = [0, 0, 0, 0x18, ...ascii('ftyp'), ...ascii('heic'), 0, 0];
const AVIF = [0, 0, 0, 0x1c, ...ascii('ftyp'), ...ascii('avif'), 0, 0];
const BMP = [0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0];
const TEXTO = ascii('hola mundo esto no es una imagen');

const archivo = (bytes: number[], nombre = 'foto.jpg', tipo = 'image/jpeg') => new File([new Uint8Array(bytes)], nombre, { type: tipo });

/** Canvas falso para poder probar la conversión sin un navegador real. */
function stubCanvasQueDevuelve(blob: Blob | null) {
  const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: Blob | null) => void) => cb(blob) };
  vi.stubGlobal('document', { createElement: (tag: string) => { if (tag !== 'canvas') throw new Error(`inesperado: ${tag}`); return canvas; } });
  return { canvas, ctx };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.doUnmock('libheif-js/wasm-bundle'); vi.resetModules(); });

describe('detectarFormatoImagen (por bytes, no por extensión)', () => {
  it('reconoce los formatos habituales', () => {
    expect(detectarFormatoImagen(new Uint8Array(JPEG))).toBe('image/jpeg');
    expect(detectarFormatoImagen(new Uint8Array(PNG))).toBe('image/png');
    expect(detectarFormatoImagen(new Uint8Array(WEBP))).toBe('image/webp');
    expect(detectarFormatoImagen(new Uint8Array(GIF))).toBe('image/gif');
    expect(detectarFormatoImagen(new Uint8Array(HEIC))).toBe('image/heic');
    expect(detectarFormatoImagen(new Uint8Array(AVIF))).toBe('image/avif');
  });
  it('texto o vacío no es imagen', () => {
    expect(detectarFormatoImagen(new Uint8Array(TEXTO))).toBeNull();
    expect(detectarFormatoImagen(new Uint8Array([]))).toBeNull();
  });
});

describe('prepararFoto — el navegador no decide si una foto sirve', () => {
  // Escenario del reporte Android: el decodificador del navegador falla
  // SIEMPRE, el archivo llega sin `type` y con nombre sin extensión. La foto
  // debe aceptarse igual, porque un JPEG no necesita decodificarse aquí.
  it('JPEG sin type, sin extensión, con createImageBitmap roto: se acepta SIN intentar decodificar', async () => {
    const cib = vi.fn().mockRejectedValue(new Error('no decodifica'));
    vi.stubGlobal('createImageBitmap', cib);
    const r = await prepararFoto(archivo(JPEG, 'IMG-20260923-WA0012', ''));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.file.type).toBe('image/jpeg');
      expect(r.file.name).toBe('IMG-20260923-WA0012.jpg');
      expect(r.convertida).toBe(false);
    }
    expect(cib).not.toHaveBeenCalled();
  });

  it('corrige el nombre/tipo cuando mienten (JPEG llamado .heic, tipo octet-stream)', async () => {
    const r = await prepararFoto(archivo(JPEG, 'foto.heic', 'application/octet-stream'));
    expect(r.ok && r.file.type).toBe('image/jpeg');
    expect(r.ok && r.file.name).toBe('foto.jpg');
  });

  it('PNG, WebP y GIF también pasan sin decodificar', async () => {
    for (const [bytes, tipo] of [[PNG, 'image/png'], [WEBP, 'image/webp'], [GIF, 'image/gif']] as const) {
      const r = await prepararFoto(archivo([...bytes], 'x', ''));
      expect(r.ok && r.file.type).toBe(tipo);
    }
  });

  // PR #146 (2026-09-27): el backend acepta HEIC/HEIF/AVIF y los convierte él mismo a
  // JPEG con Cloudinary — el navegador ya no tiene que decodificarlos para nada, ni
  // siquiera intentarlo (antes Chrome/Firefox no podían, y la mayoría de Android
  // terminaba pidiéndole a la persona que la convirtiera a mano).
  it('HEIC y AVIF también pasan SIN decodificar (el backend los convierte)', async () => {
    const cib = vi.fn();
    vi.stubGlobal('createImageBitmap', cib);
    for (const [bytes, tipo, ext] of [[HEIC, 'image/heic', 'heic'], [AVIF, 'image/avif', 'avif']] as const) {
      const r = await prepararFoto(archivo([...bytes], `foto.${ext}`, ''));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.file.type).toBe(tipo);
        expect(r.convertida).toBe(false);
      }
    }
    expect(cib).not.toHaveBeenCalled();
  });

  it('el archivo devuelto está en memoria y conserva los bytes', async () => {
    const r = await prepararFoto(archivo(JPEG));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.size).toBe(JPEG.length);
  });

  it('0 bytes: motivo "vacio" (foto en la nube que no se descargó)', async () => {
    expect(await prepararFoto(archivo([]))).toMatchObject({ ok: false, motivo: 'vacio' });
  });

  it('archivo que no se puede leer: motivo "ilegible"', async () => {
    const roto = archivo(JPEG);
    Object.defineProperty(roto, 'arrayBuffer', { value: () => Promise.reject(new DOMException('permiso', 'NotReadableError')) });
    expect(await prepararFoto(roto)).toMatchObject({ ok: false, motivo: 'ilegible' });
  });

  it('un archivo que no es imagen (aunque se llame .jpg): motivo "no-es-imagen"', async () => {
    expect(await prepararFoto(archivo(TEXTO, 'nota.jpg', 'image/jpeg'))).toMatchObject({ ok: false, motivo: 'no-es-imagen' });
  });

  it('BMP que el navegador SÍ abre: se convierte a JPEG (el backend no acepta BMP)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: () => {} }));
    const { canvas } = stubCanvasQueDevuelve(new Blob(['jpeg-convertido'], { type: 'image/jpeg' }));
    const r = await prepararFoto(archivo(BMP, 'foto.bmp', ''));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.convertida).toBe(true);
      expect(r.formatoOriginal).toBe('image/bmp');
      expect(r.file.type).toBe('image/jpeg');
      expect(r.file.name).toBe('foto.jpg');
    }
    expect(canvas.width).toBe(4000); // no agranda: 4000 ≤ 4096
  });

  it('BMP que el navegador NO abre: motivo "formato-no-soportado" con el formato', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('no soportado')));
    class ImgFalla { onerror: (() => void) | null = null; onload: (() => void) | null = null; set src(_v: string) { setTimeout(() => this.onerror?.(), 0); } }
    vi.stubGlobal('Image', ImgFalla);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    expect(await prepararFoto(archivo(BMP, 'a.bmp', ''))).toMatchObject({ ok: false, motivo: 'formato-no-soportado', formato: 'image/bmp' });
  });
});

describe('blobParaSubir', () => {
  it('devuelve la versión reducida cuando el navegador puede abrirla', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: () => {} }));
    const reducida = new Blob(['reducida'], { type: 'image/jpeg' });
    stubCanvasQueDevuelve(reducida);
    expect(await blobParaSubir(archivo(JPEG))).toBe(reducida);
  });

  // Antes: un fallo al reducir descartaba la foto en silencio al publicar.
  it('si no puede reducirla, sube el ORIGINAL (el backend valida por bytes)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('x')));
    class ImgFalla { onerror: (() => void) | null = null; onload: (() => void) | null = null; set src(_v: string) { setTimeout(() => this.onerror?.(), 0); } }
    vi.stubGlobal('Image', ImgFalla);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    const f = archivo(JPEG);
    expect(await blobParaSubir(f)).toBe(f);
  });

  it('si no puede reducirla y pasa el límite del backend, falla con un mensaje que dice por qué', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('x')));
    class ImgFalla { onerror: (() => void) | null = null; onload: (() => void) | null = null; set src(_v: string) { setTimeout(() => this.onerror?.(), 0); } }
    vi.stubGlobal('Image', ImgFalla);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    const grande = new File([new Uint8Array(MAX_SUBIDA_BYTES + 1)], 'grande.jpg', { type: 'image/jpeg' });
    await expect(blobParaSubir(grande)).rejects.toThrow(/pesa .*MB.*máx\. 5MB/);
  });
});

describe('mensajeRechazoFoto', () => {
  it('cada motivo dice qué hacer, con singular/plural', () => {
    expect(mensajeRechazoFoto('formato-no-soportado', 1, 'image/bmp')).toMatch(/BMP.*JPG/);
    expect(mensajeRechazoFoto('formato-no-soportado', 2, 'image/bmp')).toMatch(/2 archivos.*BMP/);
    expect(mensajeRechazoFoto('vacio', 1)).toMatch(/Google Fotos/);
    expect(mensajeRechazoFoto('ilegible', 1)).toMatch(/galería/);
    expect(mensajeRechazoFoto('no-es-imagen', 3)).toMatch(/3 archivos no son una imagen/);
  });
});

describe('advertenciaPesoExcesivo — avisa AL ELEGIR la foto, no hasta Publicar', () => {
  it('una foto que ya pesa ≤5MB nunca tiene problema (ni se intenta reducir)', async () => {
    const cib = vi.fn();
    vi.stubGlobal('createImageBitmap', cib);
    const chica = new File([new Uint8Array(1024)], 'foto.jpg', { type: 'image/jpeg' });
    expect(await advertenciaPesoExcesivo(chica)).toBeNull();
    expect(cib).not.toHaveBeenCalled(); // no hace falta decodificar para saber que cabe
  });

  it('una foto de más de 5MB que el navegador SÍ puede reducir: sin problema', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 6000, height: 4000, close: () => {} }));
    stubCanvasQueDevuelve(new Blob(['reducida'], { type: 'image/jpeg' }));
    const grande = new File([new Uint8Array(MAX_SUBIDA_BYTES + 1)], 'foto.jpg', { type: 'image/jpeg' });
    expect(await advertenciaPesoExcesivo(grande)).toBeNull();
  });

  it('una foto de más de 5MB que el navegador NO puede reducir (HEIC en Chrome/Android): avisa con la acción concreta', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('no soportado')));
    class ImgFalla { onerror: (() => void) | null = null; onload: (() => void) | null = null; set src(_v: string) { setTimeout(() => this.onerror?.(), 0); } }
    vi.stubGlobal('Image', ImgFalla);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    const grande = new File([new Uint8Array(MAX_SUBIDA_BYTES + 1)], 'foto.heic', { type: 'image/heic' });
    const aviso = await advertenciaPesoExcesivo(grande);
    expect(aviso).toMatch(/no se pudo reducir/);
    expect(aviso).toMatch(/JPG/);
    expect(aviso).not.toMatch(/Safari|iPhone/); // no se le puede pedir a alguien que cambie de teléfono
  });

  // Este SÍ decodifica de verdad: bytes de un HEIC inválido (arriba) hacen que
  // libheif-js real falle al parsear, así que ese caso no prueba el camino que
  // SÍ funciona. Aquí se simula un HeifDecoder que decodifica con éxito, para
  // probar que abrirHeicConWasm usa bien su API (decode -> display -> canvas).
  it('un HEIC que SÍ decodifica con libheif-js (Chrome/Android): se reduce igual, sin pedir cambiar de navegador', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('no soportado')));
    class ImgFalla { onerror: (() => void) | null = null; onload: (() => void) | null = null; set src(_v: string) { setTimeout(() => this.onerror?.(), 0); } }
    vi.stubGlobal('Image', ImgFalla);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    class FakeImageData {
      data: Uint8ClampedArray;
      constructor(public width: number, public height: number) { this.data = new Uint8ClampedArray(width * height * 4); }
    }
    vi.stubGlobal('ImageData', FakeImageData);
    const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn(), putImageData: vi.fn() };
    const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['reducida'], { type: 'image/jpeg' })) };
    vi.stubGlobal('document', { createElement: (tag: string) => { if (tag !== 'canvas') throw new Error(`inesperado: ${tag}`); return canvas; } });

    vi.resetModules();
    vi.doMock('libheif-js/wasm-bundle', () => ({
      default: {
        HeifDecoder: class {
          decode() {
            return [{
              get_width: () => 2,
              get_height: () => 2,
              display: (imageData: { data: Uint8ClampedArray }, cb: (r: unknown) => void) => cb(imageData),
              free: vi.fn(),
            }];
          }
        },
      },
    }));

    const grande = new File([new Uint8Array(MAX_SUBIDA_BYTES + 1)], 'foto.heic', { type: 'image/heic' });
    const aviso = await advertenciaPesoExcesivo(grande);
    expect(aviso).toBeNull(); // se pudo reducir vía WASM: nada que avisar
    expect(ctx.putImageData).toHaveBeenCalledWith(expect.any(FakeImageData), 0, 0);
  });
});
