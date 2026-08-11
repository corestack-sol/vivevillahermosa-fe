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
    // @container: el ancho real de ESTA tarjeta (no el viewport) es lo que
    // decide su propio tamaño de texto/padding más abajo — necesario porque
    // el grid de /propiedades usa auto-fit (PropertiesClient.tsx) con un
    // mínimo explícito de 2 columnas incluso en móvil (pedido 2026-08-09),
    // así que la misma tarjeta puede terminar con 140px de ancho en un
    // teléfono angosto o 300px+ en escritorio — un solo breakpoint de
    // viewport no puede cubrir ambos casos, pero un container query sí.
    <div className="group relative rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 ease-out aspect-[20/21] @container">
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
        {/* color-mix() en vez de concatenar dígitos hex de opacidad
            (`${cfg.accent}F2`) — cfg.accent ahora puede ser un `var(...)`
            (ver propertyTypeConfig.ts, tema Tabasco de Home), y pegarle
            texto hex directo a una función CSS da un valor inválido. */}
        <div className="absolute inset-0" style={{
          background: `linear-gradient(to top, color-mix(in srgb, ${cfg.accent} 95%, transparent) 0%, color-mix(in srgb, ${cfg.accent} 72%, transparent) 30%, transparent 65%)`,
        }} />

        {/* Operación — único badge, minimalista */}
        <div className="absolute top-4 left-4">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm" style={{ color: cfg.accent }}>
            {property.operacion === 'venta' ? 'Venta' : 'Renta'}
          </span>
        </div>

        {/* Contenido inferior — padding/tipografía en dos tamaños según el
            ANCHO REAL de la tarjeta (@container, ver arriba): compacto por
            defecto (a partir de ~140px, el mínimo real del grid en móvil) y
            el tamaño original de siempre desde 220px de tarjeta — el mismo
            umbral en el que ya se verificó que no hay colisión (grid
            sm:/lg:/xl: de PropertiesClient.tsx usa 220px+ desde ahí).
            Sin esto, precio+título+ubicación+specs (con el padding p-5
            original) pedían más alto del que la tarjeta tiene a 20/21 de
            aspect-ratio en 2 columnas angostas, y el bloque de abajo
            terminaba tapando la insignia de Venta/Renta de arriba (bug
            real confirmado en auditoría de responsividad, 2026-08-10). */}
        <div className="absolute inset-x-0 bottom-0 p-3 @[220px]:p-5">
          <p className="text-base @[220px]:text-2xl font-black text-white leading-none mb-0.5 @[220px]:mb-2 drop-shadow-sm">
            {formatPrice(property.precio, property.operacion)}
          </p>
          <h3 className="text-xs @[220px]:text-[15px] text-white font-bold leading-snug line-clamp-2 mb-1 @[220px]:mb-2">
            {property.titulo}
          </h3>
          <p className="flex items-center gap-1 text-white/80 text-[10px] @[220px]:text-xs mb-1.5 @[220px]:mb-3.5">
            <MapPin size={11} className="flex-shrink-0" />
            <span className="truncate">{property.colonia}, {property.municipio}</span>
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-0.5"
              style={{ background: FLOOD_COLOR[property.riesgoInundacion] }}
              title={FLOOD_LABEL[property.riesgoInundacion]}
            />
          </p>

          <div className="flex items-end justify-end @[220px]:justify-between gap-2">
            {/* min-w-0 + overflow-hidden — sin esto, un flex item nunca se
                encoge por debajo del ancho de su contenido (min-width:auto
                por defecto), así que con specs largas (m² + recámaras +
                baños + precio/m²) en una tarjeta angosta (4 columnas en
                xl:), esta fila se desbordaba y empujaba el botón circular
                de flecha fuera de su lugar en vez de recortarse ella
                misma. Ahora lo que no cabe se recorta aquí, y el botón
                (flex-shrink-0) siempre queda fijo a la derecha.
                Oculta por completo bajo 220px de tarjeta — no hay espacio
                para specs legibles ahí sin volver a colisionar con la
                insignia de arriba; el título/precio/ubicación ya bastan
                para decidir si vale la pena entrar a ver el detalle
                completo (que sí trae todas las specs). */}
            <div className="hidden @[220px]:flex items-center gap-2.5 text-white/90 text-[11px] font-semibold min-w-0 overflow-hidden">
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
