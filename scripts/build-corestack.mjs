// /corestack es una página independiente (sin el layout de React del sitio) para
// que cargue solo lo que necesita: un HTML pequeño y el logo. Este script genera lo
// que esa página lleva:
//   - src/corestack/generado.ts   → el efecto (src/corestack/cliente.ts + src/lib/rayosDeLuz.ts
//     empaquetados y minificados con esbuild) y la fuente del título (Orbitron 800,
//     en base64) como strings. src/app/corestack/route.ts los importa: así el Worker
//     de Cloudflare no lee archivos en tiempo de ejecución (allí no hay `fs` real,
//     y leerlos daba 500).
//   - public/corestack/logo.png   → copia de src/assets/corestack.png.
// Se ejecuta en `predev`, `prebuild`, `postinstall`, `preview` y `deploy`; los archivos
// generados están en .gitignore (nunca se editan a mano).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const salidaPublica = path.join(raiz, 'public', 'corestack');
fs.mkdirSync(salidaPublica, { recursive: true });
fs.copyFileSync(path.join(raiz, 'src', 'assets', 'corestack.png'), path.join(salidaPublica, 'logo.png'));

const { outputFiles } = await build({
  entryPoints: [path.join(raiz, 'src', 'corestack', 'cliente.ts')],
  write: false,
  outfile: 'efecto.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  legalComments: 'none',
  logLevel: 'warning',
});
const efecto = outputFiles[0].text;
const fuente = fs.readFileSync(path.join(raiz, 'src', 'assets', 'fonts', 'orbitron-800.woff2')).toString('base64');

fs.writeFileSync(
  path.join(raiz, 'src', 'corestack', 'generado.ts'),
  `// Generado por scripts/build-corestack.mjs — no editar ni commitear.\n` +
    `export const SCRIPT_EFECTO: string = ${JSON.stringify(efecto)};\n` +
    `export const FUENTE_TITULO_BASE64: string = ${JSON.stringify(fuente)};\n`,
);

console.log(`[build-corestack] efecto (${(efecto.length / 1024).toFixed(1)} KB), fuente y logo listos.`);
