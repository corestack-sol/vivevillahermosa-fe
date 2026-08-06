'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, X, ArrowRight, Sparkles } from 'lucide-react';
import { useCompare } from '@/context/CompareContext';
import { getAllProperties, getPriceContext } from '@/lib/api';
import { aplicarOverridesPublicos, PROPIEDADES_LOCALES_EVENT } from '@/lib/propiedadesLocales';
import { ESTADO_OVERRIDE_EVENT } from '@/lib/estadoOverrides';
import { getPropertyTypeConfig } from '@/lib/propertyTypeConfig';
import { FLOOD_COLOR, FLOOD_LABEL } from '@/lib/floodColors';
import { formatRelativeDate } from '@/lib/format';
import type { Property } from '@/types/property';

const TIPO_LABEL: Record<string, string> = {
  casa: 'Casa', departamento: 'Departamento', terreno: 'Terreno',
  local: 'Local', oficina: 'Oficina', bodega: 'Bodega', habitacion: 'Habitación',
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);
}

/** Índice del "mejor" valor de una fila (o null si empatan o solo hay una propiedad). */
function bestIndex(values: (number | null)[], direction: 'min' | 'max'): number | null {
  const withValue = values.map((v, i) => ({ v, i })).filter((x) => x.v !== null) as { v: number; i: number }[];
  if (withValue.length < 2) return null;
  const target = direction === 'min'
    ? Math.min(...withValue.map((x) => x.v))
    : Math.max(...withValue.map((x) => x.v));
  const winners = withValue.filter((x) => x.v === target);
  return winners.length === 1 ? winners[0].i : null;
}

function BestTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand bg-brand-pale px-2 py-0.5 rounded-full mt-1.5">
      <Sparkles size={9} /> Mejor
    </span>
  );
}

export default function CompararPage() {
  const { ids, toggle, clear } = useCompare();
  const [properties, setProperties] = useState<Property[] | null>(null);

  // ⚠️ BACKEND: deja de hacer falta con `GET /api/propiedades` real — ver
  // el comentario de aplicarOverridesPublicos en propiedadesLocales.ts.
  useEffect(() => {
    function cargarPropiedades() {
      const all = aplicarOverridesPublicos(getAllProperties());
      setProperties(ids.map((id) => all.find((p) => p.id === id)).filter((p): p is Property => Boolean(p)));
    }
    cargarPropiedades();
    window.addEventListener(PROPIEDADES_LOCALES_EVENT, cargarPropiedades);
    window.addEventListener(ESTADO_OVERRIDE_EVENT, cargarPropiedades);
    return () => {
      window.removeEventListener(PROPIEDADES_LOCALES_EVENT, cargarPropiedades);
      window.removeEventListener(ESTADO_OVERRIDE_EVENT, cargarPropiedades);
    };
  }, [ids]);

  if (properties === null) return null; // evita parpadeo antes de leer localStorage

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/propiedades" className="text-gray-400 hover:text-brand transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
              <Scale size={20} className="text-brand" /> Comparar propiedades
            </h1>
            <p className="text-sm text-gray-500">
              {properties.length > 0
                ? `${properties.length} propiedad${properties.length !== 1 ? 'es' : ''} seleccionada${properties.length !== 1 ? 's' : ''}`
                : 'Elige propiedades desde el catálogo para compararlas aquí'}
            </p>
          </div>
        </div>
        {properties.length > 0 && (
          <button onClick={clear}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
            <X size={14} /> Vaciar todo
          </button>
        )}
      </div>

      {properties.length === 0 ? (
        <div className="text-center py-16">
          <Scale size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium mb-2">Aún no tienes propiedades para comparar</p>
          <p className="text-gray-400 text-sm mb-6">
            Toca el ícono <Scale size={13} className="inline align-[-2px]" /> en cualquier propiedad del catálogo para agregarla aquí.
          </p>
          <Link href="/propiedades" className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-brand-dark transition-colors">
            Explorar propiedades <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <ComparisonTable properties={properties} onRemove={toggle} />
      )}
    </div>
  );
}

function ComparisonTable({ properties, onRemove }: { properties: Property[]; onRemove: (id: string) => void }) {
  const priceCtx = properties.map((p) => getPriceContext(p));

  const precioBest    = bestIndex(properties.map((p) => p.precio), 'min');
  const m2Best         = bestIndex(properties.map((p) => (p.m2Construidos > 0 ? p.m2Construidos : null)), 'max');
  const recamarasBest  = bestIndex(properties.map((p) => (p.recamaras > 0 ? p.recamaras : null)), 'max');
  const banosBest      = bestIndex(properties.map((p) => (p.banos + p.mediosBanos > 0 ? p.banos + p.mediosBanos : null)), 'max');
  const antiguedadBest = bestIndex(properties.map((p) => (p.operacion === 'venta' ? p.antiguedad : null)), 'min');
  const riesgoRank: Record<string, number> = { bajo: 0, medio: 1, alto: 2 };
  const riesgoBest     = bestIndex(properties.map((p) => riesgoRank[p.riesgoInundacion]), 'min');

  // Mismo lenguaje que PropertyCard: sin líneas de rejilla ni cebra —
  // filas planas separadas por un borde muy sutil, más aire, la fila de
  // precio destacada con un tinte de marca porque es el dato que más pesa.
  // Sin color de fondo aquí a propósito — cada fila lo define una sola vez
  // (no concatenado con este base) para no tener dos clases bg-* peleando
  // por especificidad en el mismo elemento sticky.
  const thBase = 'sticky left-0 z-10 text-left align-middle px-4 py-4 text-[11px] font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap';
  const tdBase = 'align-middle px-4 py-4 text-sm text-gray-700 min-w-[180px]';
  const rowBorder = 'border-b border-gray-100';

  return (
    <>
    {/* Con 2-3 propiedades la tabla es más ancha que una pantalla de
        celular — sin esta pista, nada indica que se puede deslizar. */}
    {properties.length > 1 && (
      <p className="lg:hidden flex items-center justify-end gap-1 text-xs text-gray-400 mb-2 px-0.5">
        Desliza para ver más <ArrowRight size={12} />
      </p>
    )}
    {/* Un solo contenedor: overflow-x-auto para el scroll horizontal en
        móvil, overflow-y-hidden (en vez de overflow-hidden en un div
        aparte) para que las esquinas redondeadas recorten sin romper la
        columna "sticky" de abajo — necesita que el mismo elemento sea el
        que scrollea y el que recorta. */}
    <div className="overflow-x-auto overflow-y-hidden rounded-3xl shadow-sm">
      <table className="w-full border-collapse bg-white" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-page min-w-[140px]" />
            {properties.map((p) => {
              const cfg = getPropertyTypeConfig(p.tipo);
              return (
                <th key={p.id} className="align-top p-2.5 bg-page min-w-[240px] text-left">
                  {/* Cabecera-tarjeta — mismo tratamiento que PropertyCard:
                      degradado por tipo + velo de color + texto blanco. */}
                  <div className="relative rounded-2xl overflow-hidden h-40"
                    style={{ background: `linear-gradient(160deg, ${cfg.from} 0%, ${cfg.to} 100%)` }}>
                    <div className="absolute inset-0 flex items-start justify-center pt-5">
                      <cfg.Icon size={44} strokeWidth={1} style={{ color: cfg.accent, opacity: 0.18 }} />
                    </div>
                    <div className="absolute inset-0" style={{
                      background: `linear-gradient(to top, ${cfg.accent}F2 0%, ${cfg.accent}B8 38%, ${cfg.accent}00 75%)`,
                    }} />
                    <button
                      onClick={() => onRemove(p.id)}
                      aria-label={`Quitar ${p.titulo} de la comparación`}
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors"
                    >
                      <X size={13} />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="text-base font-black text-white leading-none mb-1.5 drop-shadow-sm">{fmtMoney(p.precio)}</p>
                      <Link href={`/propiedades/${p.slug}`} className="text-xs font-bold text-white leading-snug line-clamp-2 hover:underline block">
                        {p.titulo}
                      </Link>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 px-0.5">{p.colonia}, {p.municipio === 'Centro' ? 'Villahermosa' : p.municipio}</p>
                  <Link href={`/propiedades/${p.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark mt-1 px-0.5">
                    Ver propiedad <ArrowRight size={11} />
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-brand-pale/40">
            <th scope="row" className={`${thBase} bg-brand-pale`}>Precio</th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                <span className="text-lg font-black text-gray-900">{fmtMoney(p.precio)}</span>
                {p.operacion === 'renta' && <span className="text-xs text-gray-400">/mes</span>}
                {precioBest === i && <BestTag />}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Precio por m²</th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                {priceCtx[i].precioPorM2 !== null ? `$${priceCtx[i].precioPorM2!.toLocaleString('es-MX')}/m²` : '—'}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Tipo</th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{TIPO_LABEL[p.tipo] ?? p.tipo}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Operación</th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{p.operacion === 'venta' ? 'Venta' : 'Renta'}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>m² construidos</th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                {p.m2Construidos > 0 ? `${p.m2Construidos} m²` : '—'}
                {m2Best === i && <BestTag />}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>m² de terreno</th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{p.m2Terreno > 0 ? `${p.m2Terreno} m²` : '—'}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Recámaras</th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                {p.recamaras > 0 ? p.recamaras : '—'}
                {recamarasBest === i && <BestTag />}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Baños</th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                {p.banos + p.mediosBanos > 0 ? p.banos + p.mediosBanos : '—'}
                {banosBest === i && <BestTag />}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Estacionamientos</th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{p.estacionamientos > 0 ? p.estacionamientos : '—'}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Antigüedad</th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                {p.operacion === 'venta' ? (p.antiguedad > 0 ? `${p.antiguedad} años` : 'Nueva') : '—'}
                {antiguedadBest === i && <BestTag />}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Riesgo de inundación</th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: FLOOD_COLOR[p.riesgoInundacion] }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FLOOD_COLOR[p.riesgoInundacion] }} />
                  {FLOOD_LABEL[p.riesgoInundacion]}
                </span>
                {riesgoBest === i && <BestTag />}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Cerca de Dos Bocas</th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{p.cercaDosoBocas ? 'Sí' : 'No'}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Zona ecológica</th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{p.zonaEcologica ? 'Sí' : 'No'}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}>Amenidades</th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>
                {p.amenidades.length > 0 ? `${p.amenidades.length} — ${p.amenidades.slice(0, 2).join(', ')}${p.amenidades.length > 2 ? '…' : ''}` : '—'}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={`${thBase} bg-white`}>Publicada</th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{formatRelativeDate(p.fechaPublicacion)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
    </>
  );
}
