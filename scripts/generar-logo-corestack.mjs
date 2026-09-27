// Genera el logo de /corestack (src/assets/corestack.webp) a partir del original de
// 326 px (src/assets/corestack-original.png). El original es chico: en pantallas
// densas el navegador lo estiraba y se veía pixelado. Aquí se reescala a 720 px con
// Lanczos + nitidez, y el borde (canal alfa) se afila para que la silueta quede
// definida. No corre en el build: se ejecuta a mano si cambia el original
// (`node scripts/generar-logo-corestack.mjs`) y el resultado se commitea.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const origen = path.join(raiz, 'src', 'assets', 'corestack-original.png');
const destino = path.join(raiz, 'src', 'assets', 'corestack.webp');

const ANCHO = 720;
const { width, height } = await sharp(origen).metadata();
const alto = Math.round((ANCHO * height) / width);

const { data, info } = await sharp(origen)
  .resize(ANCHO, alto, { kernel: 'lanczos3' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

// Alfa: una curva suave (0.30 → 0.70) convierte la orilla borrosa del reescalado en un borde definido sin dientes.
const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
for (let i = 0; i < info.width * info.height; i++) {
  data[i * 4 + 3] = Math.round(255 * suave(0.3, 0.7, data[i * 4 + 3] / 255));
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .sharpen({ sigma: 1.1, m1: 0.8, m2: 2.2 })
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(destino);
console.log(`[generar-logo-corestack] ${info.width}x${info.height} → ${path.relative(raiz, destino)}`);
