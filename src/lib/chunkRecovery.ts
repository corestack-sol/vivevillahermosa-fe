// Después de cada deploy los archivos JS del build anterior dejan de existir
// (verificado: 404). Una pestaña abierta antes del deploy, el botón "atrás"
// o una página precargada intentan cargarlos y el cliente queda roto (navbar,
// botones) hasta recargar a mano. Aquí se detecta ese caso y se recarga UNA
// vez sola — con un candado de tiempo para que un fallo real (red caída, CDN
// caído) nunca provoque un bucle de recargas.

const CLAVE = 'vv_chunk_reload_at';
const VENTANA_MS = 30_000;

export function esErrorDeChunk(razon: unknown): boolean {
  const texto =
    razon instanceof Error ? `${razon.name} ${razon.message}`
    : typeof razon === 'string' ? razon
    : '';
  return /ChunkLoadError|Loading chunk .* failed|Failed to load chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(texto);
}

export function esScriptDeNextFallido(target: unknown): boolean {
  const t = target as { tagName?: string; src?: string } | null;
  return !!t && t.tagName === 'SCRIPT' && typeof t.src === 'string' && t.src.includes('/_next/static/');
}

export function debeRecargar(ahora: number, ultimoIntento: number | null): boolean {
  return ultimoIntento === null || ahora - ultimoIntento > VENTANA_MS;
}

export function recargarSiCorresponde(): void {
  try {
    const guardado = sessionStorage.getItem(CLAVE);
    const ultimo = guardado ? Number(guardado) : null;
    if (!debeRecargar(Date.now(), ultimo)) return;
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // Sin sessionStorage no hay candado — mejor no recargar que arriesgar un bucle.
    return;
  }
  window.location.reload();
}

export function instalarRecuperacionDeChunks(): void {
  // `error` de un <script> no burbujea a window: hay que escucharlo en la
  // fase de captura. Cubre el caso principal (HTML viejo pidiendo un chunk
  // que ya no existe en la carga inicial).
  window.addEventListener(
    'error',
    (e) => {
      if (esScriptDeNextFallido(e.target) || esErrorDeChunk(e.error)) recargarSiCorresponde();
    },
    true,
  );
  window.addEventListener('unhandledrejection', (e) => {
    if (esErrorDeChunk(e.reason)) recargarSiCorresponde();
  });
}
