import { construirPagina } from '@/lib/corestackPagina';
import { FUENTE_TITULO_BASE64, SCRIPT_EFECTO } from '@/corestack/generado';

// Página independiente (sin el layout ni los proveedores de React del sitio):
// solo baja un HTML pequeño con el efecto y la fuente incrustados, y el logo.
// El efecto y la fuente vienen de un módulo generado en el build
// (scripts/build-corestack.mjs): en el Worker de Cloudflare no se pueden leer
// archivos de public/ en tiempo de ejecución.
export const dynamic = 'force-static';

export function GET() {
  return new Response(construirPagina(SCRIPT_EFECTO, FUENTE_TITULO_BASE64), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
}
