// /corestack es una página independiente (sin el layout de React del sitio) para
// que cargue solo lo que necesita: un HTML pequeño y el logo. Este script genera lo
// que esa página lleva:
//   - src/corestack/generado.ts   → el efecto (src/corestack/cliente.ts + src/lib/rayosDeLuz.ts
//     empaquetados y minificados con esbuild) y la fuente del título (Orbitron 800,
//     en base64) como strings. src/app/corestack/route.ts los importa: así el Worker
//     de Cloudflare no lee archivos en tiempo de ejecución (allí no hay `fs` real,
//     y leerlos daba 500).
//   - public/corestack/logo.webp  → copia de src/assets/corestack.webp (logo a 720 px que
//     genera scripts/generar-logo-corestack.mjs).
// Se ejecuta en `predev`, `prebuild`, `postinstall`, `preview` y `deploy`; los archivos
// generados están en .gitignore (nunca se editan a mano).
//
// Con `--watch` (npm run corestack:watch, en otra terminal junto a `npm run dev`) vuelve a
// generar cada vez que cambia el efecto: sin eso, `next dev` no se entera de que el
// efecto cambió y sigue mostrando el anterior.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const salidaPublica = path.join(raiz, 'public', 'corestack');

async function generar() {
  fs.mkdirSync(salidaPublica, { recursive: true });
  fs.copyFileSync(path.join(raiz, 'src', 'assets', 'corestack.webp'), path.join(salidaPublica, 'logo.webp'));

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
}

await generar();

if (process.argv.includes('--watch')) {
  // Vigila el arranque del cliente y el efecto; agrupa los cambios seguidos en una sola generación.
  let pendiente = null;
  const vigilados = [path.join(raiz, 'src', 'corestack', 'cliente.ts'), path.join(raiz, 'src', 'lib', 'rayosDeLuz.ts')];
  for (const archivo of vigilados) {
    fs.watch(archivo, () => {
      clearTimeout(pendiente);
      pendiente = setTimeout(() => generar().catch((e) => console.error('[build-corestack]', e.message)), 150);
    });
  }
  console.log('[build-corestack] vigilando cambios en el efecto (Ctrl+C para salir)...');
}
