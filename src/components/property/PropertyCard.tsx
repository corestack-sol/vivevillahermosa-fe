'use client';

import Link from 'next/link';
import type { Property } from '@/types/property';
import { MapPin, BedDouble, Maximize, Bath, ArrowUpRight, Scale, Check } from 'lucide-react';
import { FavoriteButton } from './FavoriteButton';
import { getPriceContext } from '@/lib/api';
import { getPropertyTypeConfig } from '@/lib/propertyTypeConfig';
import { FLOOD_COLOR, FLOOD_LABEL } from '@/lib/floodColors';
import { useCompare } from '@/context/CompareContext';

interface PropertyCardProps {
  property: Property;
  /**
   * Query string a propagar hacia la ficha ("?cerca=laguna-ilusiones" o
   * "?cercaTipo=salud") cuando la tarjeta se muestra dentro de resultados de
   * una búsqueda por landmark — así la ficha puede mostrar a qué distancia
   * real está, en vez de dejar la conexión invisible (ver [id]/page.tsx).
   */
  landmarkQuery?: string;
}

function formatPrice(precio: number, operacion: 'venta' | 'renta'): string {
  const fmt = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 0,
  }).format(precio);
  return operacion === 'renta' ? `${fmt}/mo` : fmt;
}

/**
 * Rediseño inspirado en src/assets/card2.png — tarjeta-retrato dominada por
 * la imagen (o, sin fotos reales todavía, el color de tipo como sustituto),
 * con un solo texto grande y un botón circular de acción, en vez de un
 * cuerpo blanco separado con lista de specs y una barra de botones.
 */
export function PropertyCard({ property, landmarkQuery }: PropertyCardProps) {
  const cfg      = getPropertyTypeConfig(property.tipo);
  const priceCtx = getPriceContext(property);
  const { isSelected, toggle } = useCompare();
  const compared = isSelected(property.id);

  return (
    // aspect-[20/21] = 20% más de alto que el aspect-[8/7] anterior, misma proporción de ancho
    <div className="group relative rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 ease-out aspect-[20/21]">
      <Link
        href={`/propiedades/${property.slug}${landmarkQuery ?? ''}`}
        className="absolute inset-0 select-none"
        style={{ background: `linear-gradient(160deg, ${cfg.from} 0%, ${cfg.to} 100%)` }}
      >
        {/* Sustituto de foto: ícono grande, muy sutil — hasta que haya fotos reales */}
        <div className="absolute inset-0 flex items-start justify-center pt-10">
          <cfg.Icon size={84} strokeWidth={1} style={{ color: cfg.accent, opacity: 0.16 }}
            className="transition-transform duration-500 group-hover:scale-110" />
        </div>

        {/* Velo de color de abajo hacia arriba — el mismo lenguaje que
            card2.png, pero con el tono propio de cada tipo de propiedad
            en vez de un solo naranja fijo. */}
        <div className="absolute inset-0" style={{
          background: `linear-gradient(to top, ${cfg.accent}F2 0%, ${cfg.accent}B8 30%, ${cfg.accent}00 65%)`,
        }} />

        {/* Operación — único badge, minimalista */}
        <div className="absolute top-4 left-4">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm" style={{ color: cfg.accent }}>
            {property.operacion === 'venta' ? 'Venta' : 'Renta'}
          </span>
        </div>

        {/* Contenido inferior */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-2xl font-black text-white leading-none mb-2 drop-shadow-sm">
            {formatPrice(property.precio, property.operacion)}
          </p>
          <h3 className="text-white font-bold text-[15px] leading-snug line-clamp-2 mb-2">
            {property.titulo}
          </h3>
          <p className="flex items-center gap-1 text-white/80 text-xs mb-3.5">
            <MapPin size={11} className="flex-shrink-0" />
            <span className="truncate">{property.colonia}, {property.municipio}</span>
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-0.5"
              style={{ background: FLOOD_COLOR[property.riesgoInundacion] }}
              title={FLOOD_LABEL[property.riesgoInundacion]}
            />
          </p>

          <div className="flex items-end justify-between gap-2">
            <div className="flex items-center gap-2.5 text-white/90 text-[11px] font-semibold">
              {property.m2Construidos > 0 && (
                <span className="flex items-center gap-1"><Maximize size={11} />{property.m2Construidos}m²</span>
              )}
              {property.recamaras > 0 && (
                <span className="flex items-center gap-1"><BedDouble size={11} />{property.recamaras}</span>
              )}
              {property.banos > 0 && (
                <span className="flex items-center gap-1"><Bath size={11} />{property.banos}</span>
              )}
              {priceCtx.precioPorM2 !== null && (
                <span className="text-white/60">· ${priceCtx.precioPorM2.toLocaleString('es-MX')}/m²</span>
              )}
            </div>

            {/* CTA circular — reemplaza la barra de botón completa de antes */}
            <span
              className="flex-shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center
                         transition-transform duration-300 group-hover:scale-110 group-hover:rotate-45"
              style={{ color: cfg.accent }}
            >
              <ArrowUpRight size={16} strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </Link>

      {/* Favoritos + comparar — dos círculos flotantes, mismo lenguaje que
          el ícono superior derecho de card2.png */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <FavoriteButton propiedadId={property.id} size="sm" />
        <button
          type="button"
          onClick={() => toggle(property.id)}
          aria-pressed={compared}
          title={compared ? 'Quitar de comparar' : 'Agregar a comparar'}
          className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm border border-white/60 transition-all active:scale-90 ${
            compared
              ? 'bg-brand text-white'
              : 'bg-white/90 text-gray-400 hover:text-brand hover:bg-white'
          }`}
        >
          {compared ? <Check size={14} /> : <Scale size={13} />}
        </button>
      </div>
    </div>
  );
}
