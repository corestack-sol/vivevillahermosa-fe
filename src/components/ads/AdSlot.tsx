'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT_ID, ADSENSE_ENABLED, ADSENSE_SLOTS, type AdSlotKey } from '@/lib/ads';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface AdSlotProps {
  slot: AdSlotKey;
  className?: string;
  /** px — reserva el alto mientras el anuncio real resuelve su tamaño, para no mover el layout debajo (CLS). Ajustar por espacio: banners angostos (sidebar) ~250, horizontales (in-feed/inline) ~120-150. */
  minHeight?: number;
  /** data-ad-format de AdSense. 'auto' (default) = display estándar responsive. 'fluid' = requerido por los formatos nativos (in-article, in-feed). */
  adFormat?: 'auto' | 'fluid';
  /** data-ad-layout — solo lo pide el formato in-article (valor fijo "in-article"). */
  adLayout?: 'in-article';
  /** data-ad-layout-key — solo lo pide el formato in-feed, valor exacto que da el panel de AdSense al crear ese bloque (ej. "-fb+5w+4e-db+86"). */
  adLayoutKey?: string;
}

/**
 * Un espacio de Google AdSense — pedido explícito 2026-09-08. Sin
 * credenciales reales configuradas (NEXT_PUBLIC_ADSENSE_CLIENT_ID +
 * NEXT_PUBLIC_ADSENSE_SLOT_* en .env, ver src/lib/ads.ts) cae a un
 * placeholder inerte: mismo espacio reservado, sin cargar el script de
 * Google ni su cookie de terceros. El día que existan credenciales reales,
 * activar cada espacio es una env var — este componente y el <script> del
 * layout no cambian.
 *
 * "Publicidad" arriba del bloque real — transparencia (que quien lo vea
 * no lo confunda con contenido propio de la plataforma, mismo criterio que
 * ya se aplicó al etiquetar "Anuncio" en resultados de búsqueda), y
 * requisito de la propia política de AdSense.
 */
export function AdSlot({ slot, className = '', minHeight = 120, adFormat = 'auto', adLayout, adLayoutKey }: AdSlotProps) {
  const insRef = useRef<HTMLModElement>(null);
  const empujado = useRef(false);
  const slotId = ADSENSE_SLOTS[slot];
  // Real solo cuando hay slotId — un placeholder no renderiza ningún <ins>,
  // así que no hay nada que Google pueda "llenar" ahí.
  const esReal = ADSENSE_ENABLED && !!slotId;

  useEffect(() => {
    // Bug real encontrado en vivo (2026-09-08): este efecto disparaba
    // push() con ADSENSE_ENABLED solo, sin importar si ESTA instancia
    // tenía un <ins> real — Google tiraba "All 'ins' elements... already
    // have ads in them" porque no había ningún <ins> nuevo que procesar.
    // El error además es asíncrono (dentro del script de Google, no en
    // esta llamada), así que ni el try/catch de abajo lo atrapaba.
    if (!esReal || empujado.current) return;
    empujado.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Bloqueador de anuncios o el script de Google todavía en vuelo —
      // no es un error de la app, no hay nada que reintentar acá.
    }
  }, [esReal]);

  if (!esReal) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 text-gray-300 text-xs ${className}`}
        style={{ minHeight }}
        aria-hidden="true"
      >
        Espacio publicitario
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 text-center">Publicidad</p>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', textAlign: adLayout === 'in-article' ? 'center' : undefined, minHeight }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format={adFormat}
        data-ad-layout={adLayout}
        data-ad-layout-key={adLayoutKey}
        {...(adFormat === 'auto' ? { 'data-full-width-responsive': 'true' } : {})}
      />
    </div>
  );
}
