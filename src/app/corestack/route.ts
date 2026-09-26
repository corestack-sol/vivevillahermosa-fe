import fs from 'node:fs';
import path from 'node:path';
import { construirPagina } from '@/lib/corestackPagina';

// Página independiente (sin el layout ni los proveedores de React del sitio):
// solo baja un HTML pequeño con el efecto incrustado y el logo. Se genera una
// vez en el build; el efecto lo empaqueta scripts/build-corestack.mjs.
export const dynamic = 'force-static';

export function GET() {
  const script = fs.readFileSync(path.join(process.cwd(), 'public', 'corestack', 'efecto.js'), 'utf-8');
  const fuente = fs.readFileSync(path.join(process.cwd(), 'public', 'corestack', 'titulo.woff2')).toString('base64');
  return new Response(construirPagina(script, fuente), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
}
