// MapLibre GL intenta detectar la URL de su propio worker vía
// `import.meta.url` — bajo Turbopack (dev y build) eso resuelve a un
// string vacío, así que el Worker termina apuntando a la página HTML
// actual en vez de al script real. El mapa monta, la conexión con el
// worker nunca contesta, y no queda ningún tile pintado — sin ningún
// error visible salvo revisando la creación del Worker a mano
// (confirmado en vivo 2026-09-02; es un problema documentado de
// MapLibre + Turbopack, la solución oficial para Next.js es servir el
// worker desde public/ y apuntar `setWorkerUrl()` ahí — ver MapView.tsx
// y MapPicker.tsx).
//
// Se copia en cada `npm install` (postinstall) en vez de comitear el
// archivo a mano — así nunca queda desincronizado si `maplibre-gl` sube
// de versión.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// maplibre-gl-worker.mjs importa en tiempo de ejecución a
// maplibre-gl-shared.mjs como hermano relativo (mismo directorio) — sin
// copiar también ese archivo, el worker sí arranca pero esa importación
// da 404 y el worker nunca termina de inicializar (confirmado en vivo:
// dataloading se disparaba pero nunca llegaba a completarse, sin ningún
// error obvio salvo revisando la pestaña Network a fondo).
const distDir = path.join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist');
const publicDir = path.join(__dirname, '..', 'public');
const archivos = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

for (const nombre of archivos) {
  const src = path.join(distDir, nombre);
  if (!fs.existsSync(src)) {
    console.error(`[copy-maplibre-worker] No se encontró ${src} — ¿cambió la estructura de node_modules/maplibre-gl? Revisar los nombres de archivo en su dist/.`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(publicDir, nombre));
}
console.log(`[copy-maplibre-worker] ${archivos.join(', ')} actualizados en public/.`);
