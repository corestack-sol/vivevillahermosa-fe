// Genera los íconos de la PWA a partir del logo real (public/images/
// logo-mark.png) — no se corre en build/postinstall (a diferencia de
// copy-maplibre-worker.mjs), es un script manual: solo hace falta
// volver a correrlo si el logo cambia. `node scripts/generate-pwa-icons.mjs`.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'public/images/logo-mark.png');
const OUT = path.join(ROOT, 'public/icons');
const BG = '#1D4A2C'; // --color-brand-dark (globals.css) — mismo verde del header/footer

async function makeIcon(size, logoScale, outFile) {
  const logoW = Math.round(size * logoScale);
  const logoBuf = await sharp(LOGO).resize(logoW, null, { fit: 'inside' }).toBuffer();
  const logoMeta = await sharp(logoBuf).metadata();
  const left = Math.round((size - logoMeta.width) / 2);
  const top = Math.round((size - logoMeta.height) / 2);

  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logoBuf, left, top }])
    .png()
    .toFile(path.join(OUT, outFile));
  console.log(`[generate-pwa-icons] ${outFile} (${size}x${size})`);
}

// Badge de la barra de estado de Android (notificaciones push): Android usa
// SOLO el canal alfa y lo pinta de blanco. Un PNG opaco (como icon-192.png,
// con fondo verde sólido) sale como un cuadrado blanco liso. Aquí se usa la
// silueta del logo — blanco puro donde el logo tiene forma, transparente en
// el resto. 96x96 es el tamaño que recomienda Android para este ícono.
async function makeBadge(size, outFile) {
  // El logo trae margen transparente interno (y alfa residual que sharp.trim()
  // no detecta): sin recortar por el recuadro real de la forma, la silueta
  // queda diminuta en un lienzo de 96px.
  const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const logoBuf = await sharp(LOGO)
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize(Math.round(size * 0.9), Math.round(size * 0.9), { fit: 'inside' })
    .toBuffer();
  const alpha = await sharp(logoBuf).ensureAlpha().extractChannel(3).toBuffer();
  const meta = await sharp(logoBuf).metadata();
  const silueta = await sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: '#ffffff' } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: silueta, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT, outFile));
  console.log(`[generate-pwa-icons] ${outFile} (${size}x${size}, silueta blanca)`);
}

(async () => {
  await makeBadge(96, 'badge-96.png');
  await makeIcon(192, 0.62, 'icon-192.png');
  await makeIcon(512, 0.62, 'icon-512.png');
  // Maskable — zona segura más chica (~42% del lienzo en vez de ~62%):
  // Android/launchers recortan el ícono a círculo/squircle/etc. según el
  // dispositivo, y solo garantizan visible el ~80% central — con el
  // mismo margen que los íconos normales, las puntas del logo se
  // hubieran cortado en algunos launchers.
  await makeIcon(512, 0.42, 'icon-maskable-512.png');
  // apple-touch-icon — 180x180 estándar de iOS, fondo sólido (Safari
  // renderiza mal la transparencia en este ícono, esquinas quedan negras).
  await makeIcon(180, 0.62, 'apple-touch-icon.png');
})().catch((e) => { console.error(e); process.exit(1); });
