'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, MapPin, ArrowRight } from 'lucide-react';
import { formatPriceShort } from '@/lib/format';
import { getPropertyTypeConfig } from '@/lib/propertyTypeConfig';
import { cloudinaryTransform } from '@/lib/cloudinaryUrl';
import { FavoriteButton } from '@/components/property/FavoriteButton';
import type { MapMarker } from './MapView';

const RIESGO_LABEL: Record<string, string> = {
  bajo: 'Bajo historial de inundaciones', medio: 'Inundaciones menores ocasionales', alto: 'Históricamente inundable',
};

// Versión corta — la card compacta de la esquina no tiene ancho para la
// oración completa de RIESGO_LABEL (info de seguridad real, no se quita,
// solo se acorta).
const RIESGO_SHORT: Record<string, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };

const RIESGO_COLOR: Record<string, string> = {
  bajo: '#10B981', medio: '#F59E0B', alto: '#EF4444',
};

// Card compacta en la esquina — antes era una hoja de pantalla completa en
// móvil (fixed bottom-0 left-0 right-0, imagen h-60 + drag handle, la
// misma altura que casi todo el viewport de un teléfono). Pedido explícito
// 2026-08-18: "quiero que se muestre una card en la esquina de la
// pantalla", no pantalla completa.
//
// Pedido explícito 2026-08-23: en móvil/tablet el tamaño de esa vez está
// bien, pero en escritorio (pantallas anchas) se ve chica — se agregan
// variantes lg:/xl: que solo entran desde ~1024px, todo lo de abajo de eso
// (móvil y tablet) queda idéntico a como estaba.
//
// Compartida entre /mapa (MapaClient.tsx) y el modo mapa de /propiedades
// (PropertiesClient.tsx) — antes solo existía en MapaClient.tsx, así que
// el mapa embebido de /propiedades no mostraba ningún detalle al hacer
// clic en un marcador (bug real reportado 2026-08-19).
//
// `absolute`, no `fixed` — debe vivir dentro de un contenedor `relative`
// que ya excluye cualquier sidebar (el área de mapa, no el viewport
// completo). Con `fixed` la card se posiciona contra toda la pantalla y
// en escritorio queda superpuesta sobre el sidebar de filtros (bug real
// reportado 2026-08-19, /mapa).
export function SelectedPropertyCard({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const typeCfg = getPropertyTypeConfig(marker.tipo);
  const colors  = typeCfg;
  const showImg = !!marker.foto && !imgFailed;

  return (
    <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 lg:bottom-5 lg:left-5 lg:w-96 xl:w-[26rem] z-[1100]
                     bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden">
      {/* Close + favoritos */}
      <div className="absolute top-2.5 right-2.5 lg:top-3.5 lg:right-3.5 z-10 flex items-center gap-1.5">
        <FavoriteButton propiedadId={marker.id} size="sm" />
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="w-8 h-8 lg:w-9 lg:h-9 bg-black/30 hover:bg-black/50
                     text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
        >
          <X size={14} className="lg:hidden" />
          <X size={16} className="hidden lg:block" />
        </button>
      </div>

      {/* Image / gradient header — compacta, antes h-60 */}
      <div
        className="relative h-28 lg:h-40 xl:h-48 overflow-hidden flex items-center justify-center"
        style={{
          // color-mix() en vez de concatenar dígitos hex de opacidad —
          // colors.glow puede ser un var(...) (propertyTypeConfig.ts),
          // pegarle texto hex directo da un valor de color inválido.
          background: `
            radial-gradient(ellipse at 30% 50%, color-mix(in srgb, ${colors.glow} 19%, transparent) 0%, transparent 65%),
            linear-gradient(150deg, ${colors.from} 0%, ${colors.to} 100%)
          `,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {showImg && (
          <img
            src={cloudinaryTransform(marker.foto!, 'thumb')}
            alt={marker.titulo}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        )}
        {!showImg && (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${colors.accent} 8%, transparent)`, border: `1.5px solid color-mix(in srgb, ${colors.accent} 16%, transparent)`, color: colors.accent }}
          >
            <typeCfg.Icon size={20} strokeWidth={1.5} />
          </div>
        )}

        {/* Top chips — right-2 (antes sin límite derecho) fuerza a esta fila
            a quedarse dentro del ancho real de la card en vez de crecer
            "shrink-to-fit" sin tope; min-w-0 + truncate en la píldora de
            tipo (typeCfg.label, ej. "Habitación") deja que SOLO ella se
            recorte con puntos suspensivos si no cabe junto a Venta/Renta
            (flex-shrink-0, siempre corta) — con texto de accesibilidad más
            grande, antes el texto se recortaba a la mitad sin "…" por el
            overflow-hidden del header de arriba, en vez de truncarse de
            forma controlada. */}
        <div className="absolute top-2 left-2 right-2 lg:top-3 lg:left-3 lg:right-3 flex gap-1 lg:gap-1.5">
          <span className={`flex-shrink-0 text-[10px] lg:text-xs font-bold px-2 lg:px-2.5 py-0.5 lg:py-1 rounded-full shadow-sm ${
            marker.operacion === 'venta' ? 'bg-brand text-white' : 'bg-accent text-white'
          }`}>
            {marker.operacion === 'venta' ? 'Venta' : 'Renta'}
          </span>
          <span className="min-w-0 truncate text-[10px] lg:text-xs font-semibold px-2 lg:px-2.5 py-0.5 lg:py-1 rounded-full bg-black/30 text-white backdrop-blur-sm">
            {typeCfg.label}
          </span>
        </div>

        {/* Price gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 lg:px-4 pb-2 lg:pb-3 pt-6 lg:pt-8">
          <p className="text-lg lg:text-2xl font-black text-white leading-none drop-shadow-lg">
            {formatPriceShort(marker.precio)}
            {marker.operacion === 'renta' && (
              <span className="text-xs lg:text-sm font-semibold text-white/65 ml-1">/mes</span>
            )}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-3.5 lg:px-5 pt-2.5 lg:pt-3.5 pb-1.5 lg:pb-2">
        <p className="text-sm lg:text-base font-bold text-gray-900 line-clamp-2 leading-snug mb-2">
          {marker.titulo}
        </p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <MapPin size={12} className="text-gray-400 flex-shrink-0 lg:hidden" />
            <MapPin size={14} className="text-gray-400 flex-shrink-0 hidden lg:block" />
            <span className="text-xs lg:text-sm text-gray-500 truncate">{marker.colonia}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" title={RIESGO_LABEL[marker.riesgoInundacion]}>
            <span
              className="w-2 h-2 lg:w-2.5 lg:h-2.5 rounded-full flex-shrink-0"
              style={{ background: RIESGO_COLOR[marker.riesgoInundacion] }}
            />
            <span className="text-[11px] lg:text-xs text-gray-500 whitespace-nowrap">
              {RIESGO_SHORT[marker.riesgoInundacion]}
            </span>
          </div>
        </div>
      </div>

      <div className="px-3.5 lg:px-5 pb-3.5 lg:pb-5 pt-1.5 lg:pt-2">
        <Link
          href={`/propiedades/${marker.slug}`}
          className="flex items-center justify-center gap-1.5 w-full bg-brand hover:bg-brand-dark
                     text-white font-bold text-xs lg:text-sm py-2.5 lg:py-3 rounded-xl transition-colors
                     shadow-md shadow-brand/20"
        >
          Ver propiedad completa <ArrowRight size={13} className="lg:hidden" />
          <ArrowRight size={15} className="hidden lg:block" />
        </Link>
      </div>
    </div>
  );
}
