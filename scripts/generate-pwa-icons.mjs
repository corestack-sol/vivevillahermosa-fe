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

(async () => {
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
