// /corestack es una página independiente (sin el layout de React del sitio) para
// que cargue solo lo que necesita: un HTML pequeño, el logo y el efecto. Este
// script genera lo que esa página lleva:
//   - public/corestack/efecto.js  → src/corestack/cliente.ts + src/lib/rayosDeLuz.ts,
//     empaquetados y minificados en un solo archivo (la ruta /corestack lo incrusta
//     en el HTML: src/app/corestack/route.ts).
//   - public/corestack/logo.png   → copia de src/assets/corestack.png.
//   - public/corestack/titulo.woff2 → copia de la fuente del título (Orbitron 800); la
//     ruta la incrusta en el HTML como data URI para no pedir nada más.
// Se ejecuta en `predev`, `postinstall`, `preview` y `deploy`; los archivos generados
// están en .gitignore (nunca se editan a mano).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(raiz, 'public', 'corestack');
fs.mkdirSync(salida, { recursive: true });

fs.copyFileSync(path.join(raiz, 'src', 'assets', 'corestack.png'), path.join(salida, 'logo.png'));
fs.copyFileSync(path.join(raiz, 'src', 'assets', 'fonts', 'orbitron-800.woff2'), path.join(salida, 'titulo.woff2'));

await build({
  entryPoints: [path.join(raiz, 'src', 'corestack', 'cliente.ts')],
  outfile: path.join(salida, 'efecto.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  legalComments: 'none',
  logLevel: 'warning',
});

const kb = (fs.statSync(path.join(salida, 'efecto.js')).size / 1024).toFixed(1);
console.log(`[build-corestack] efecto.js (${kb} KB) , logo.png y titulo.woff2 listos en public/corestack/.`);
