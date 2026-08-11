'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Scale, X, ArrowRight, DollarSign, Ruler, Tag, ArrowLeftRight,
  Maximize, LandPlot, BedDouble, Bath, Car, Calendar, Droplets, Zap, Leaf, Sparkles, Clock,
} from 'lucide-react';
import { useCompare } from '@/context/CompareContext';
import { Tooltip } from '@/components/ui/Tooltip';
import { getAllProperties, getPriceContext, type PriceContext } from '@/lib/api';
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

// Antes decía "Mejor" (con un ícono de estrella) en la fila con el valor
// más alto/bajo — declarar un "ganador" es un juicio de valor que ni
// nosotros ni una IA deberíamos hacer por la persona: más recámaras, más
// m² o el precio más bajo no es objetivamente "mejor" para todos, depende
// de lo que cada quien busca. Ahora es un dato neutral y sutil (texto gris
// pequeño, sin insignia de color ni ícono de premio) — informa el hecho
// ("el más bajo", "el más grande") sin opinar.
function HighlightTag({ label }: { label: string }) {
  return (
    <span className="block text-[10px] text-gray-400 font-medium mt-1">{label}</span>
  );
}

/** Ícono + texto consistente para cada fila — ayuda a ubicarse rápido en
 *  una tabla de 15 filas sin tener que leer cada etiqueta letra por letra. */
function RowLabel({ icon: Icon, children }: { icon: typeof DollarSign; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon size={12} className="text-gray-300 flex-shrink-0" />
      {children}
    </span>
  );
}

export default function CompararPage() {
  const { ids, toggle, clear } = useCompare();
  const [properties, setProperties] = useState<Property[] | null>(null);

  useEffect(() => {
    getAllProperties().then((all) => {
      setProperties(ids.map((id) => all.find((p) => p.id === id)).filter((p): p is Property => Boolean(p)));
    });
  }, [ids]);

  if (properties === null) return null; // evita parpadeo antes de leer localStorage

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between gap-3 mb-8 animate-fade-up">
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
  const [priceCtx, setPriceCtx] = useState<PriceContext[]>(
    properties.map(() => ({ precioPorM2: null, promedioZona: null, totalComparables: 0, m2Ref: 0 })),
  );
  useEffect(() => {
    let cancelado = false;
    Promise.all(properties.map((p) => getPriceContext(p))).then((ctx) => {
      if (!cancelado) setPriceCtx(ctx);
    });
    return () => { cancelado = true; };
  }, [properties]);

  // Comparar el precio de una propiedad en venta contra una en renta no
  // tiene sentido — uno es el total a pagar de una vez, el otro es una
  // mensualidad, no son la misma unidad aunque ambos sean "precio". Si se
  // mezclan operaciones en la comparación, ninguna se resalta como más
  // baja (mixedOperacion === true corta bestIndex antes de calcular).
  const mixedOperacion = new Set(properties.map((p) => p.operacion)).size > 1;
  const precioBest    = mixedOperacion ? null : bestIndex(properties.map((p) => p.precio), 'min');
  const m2Best         = bestIndex(properties.map((p) => (p.m2Construidos > 0 ? p.m2Construidos : null)), 'max');
  const recamarasBest  = bestIndex(properties.map((p) => (p.recamaras > 0 ? p.recamaras : null)), 'max');
  const banosBest      = bestIndex(properties.map((p) => (p.banos + p.mediosBanos > 0 ? p.banos + p.mediosBanos : null)), 'max');
  const antiguedadBest = bestIndex(properties.map((p) => (p.operacion === 'venta' ? p.antiguedad : null)), 'min');
  // "Cerca de Dos Bocas" solo es relevante para la franja costera
  // (Paraíso y alrededores) — para el resto del estado, mostrarla como
  // fila fija con "No" en todas las columnas es ruido, no un criterio de
  // comparación real. Se oculta por completo salvo que aplique a al
  // menos una de las propiedades que se están comparando.
  const showDosBocas = properties.some((p) => p.cercaDosoBocas);
  // Riesgo de inundación NUNCA lleva highlight comparativo entre
  // propiedades (a diferencia de precio/m²/recámaras/etc.) — a diferencia
  // de esos datos, "riesgo" es información que puede afectar cómo se
  // percibe la propiedad de un dueño frente a la de otro; cada quien ve su
  // propio nivel (el punto de color + la palabra bajo/medio/alto), sin que
  // la plataforma señale cuál sale "mejor parada" que la otra.

  // Mismo lenguaje que PropertyCard: sin líneas de rejilla ni cebra —
  // filas planas separadas por un borde muy sutil, más aire, la fila de
  // precio destacada con un tinte de marca porque es el dato que más pesa.
  // Sin color de fondo aquí a propósito — cada fila lo define una sola vez
  // (no concatenado con este base) para no tener dos clases bg-* peleando
  // por especificidad en el mismo elemento sticky.
  // `group-hover:` en vez de un `:hover` normal — el trigger vive en el
  // <tr> (className="group"), y tanto el <th> sticky como los <td> lo
  // heredan, así la fila entera cambia de color junta al pasar el mouse,
  // no solo la celda apuntada. Tailwind emite los estilos `group-hover:`
  // después de los `bg-*` base en el CSS generado, así que sí le gana al
  // `bg-white`/`bg-brand-pale` de cada celda aunque compartan especificidad.
  const thBase = 'sticky left-0 z-10 text-left align-middle px-4 py-4 text-[11px] font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap group-hover:bg-brand-pale/70 transition-colors';
  const tdBase = 'align-middle px-4 py-4 text-sm text-gray-700 min-w-[180px] group-hover:bg-brand-pale/25 transition-colors';
  const rowBorder = 'group border-b border-gray-100';

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
                    {/* color-mix() en vez de concatenar dígitos hex de
                        opacidad — cfg.accent puede ser un var(...), ver
                        el mismo fix en PropertyCard.tsx. */}
                    <div className="absolute inset-0" style={{
                      background: `linear-gradient(to top, color-mix(in srgb, ${cfg.accent} 95%, transparent) 0%, color-mix(in srgb, ${cfg.accent} 72%, transparent) 38%, transparent 75%)`,
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
          <tr className="group bg-brand-pale/40">
            <th scope="row" className={`${thBase} bg-brand-pale`}><RowLabel icon={DollarSign}>Precio</RowLabel></th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                <span className="text-lg font-black text-gray-900">{fmtMoney(p.precio)}</span>
                {p.operacion === 'renta' && <span className="text-xs text-gray-400">/mes</span>}
                {precioBest === i && <HighlightTag label="El precio más bajo" />}
                {/* Explica por qué ninguna se resalta aquí, en vez de dejar
                    la ausencia del dato sin explicación. */}
                {mixedOperacion && i === 0 && (
                  <span className="block text-[10px] text-gray-400 font-medium mt-1">Venta y renta no son comparables directamente</span>
                )}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Ruler}>Precio por m²</RowLabel></th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                {/* Bug real encontrado en auditoría (2026-08-08): esta fila
                    nunca aclaraba "/mes" para renta, a diferencia de la fila
                    Precio de arriba — mostraba, por ejemplo, "$120/m²" de una
                    renta mensual justo al lado de "$18,000/m²" de una venta
                    total, sin nada que avisara que son unidades distintas. */}
                {priceCtx[i].precioPorM2 !== null
                  ? `$${priceCtx[i].precioPorM2!.toLocaleString('es-MX')}/m²${p.operacion === 'renta' ? '/mes' : ''}`
                  : '—'}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Tag}>Tipo</RowLabel></th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{TIPO_LABEL[p.tipo] ?? p.tipo}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={ArrowLeftRight}>Operación</RowLabel></th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{p.operacion === 'venta' ? 'Venta' : 'Renta'}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Maximize}>m² construidos</RowLabel></th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                {p.m2Construidos > 0 ? `${p.m2Construidos} m²` : '—'}
                {m2Best === i && <HighlightTag label="La más grande" />}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={LandPlot}>m² de terreno</RowLabel></th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{p.m2Terreno > 0 ? `${p.m2Terreno} m²` : '—'}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={BedDouble}>Recámaras</RowLabel></th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                {p.recamaras > 0 ? p.recamaras : '—'}
                {recamarasBest === i && <HighlightTag label="Más recámaras" />}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Bath}>Baños</RowLabel></th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                {p.banos + p.mediosBanos > 0 ? p.banos + p.mediosBanos : '—'}
                {banosBest === i && <HighlightTag label="Más baños" />}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Car}>Estacionamientos</RowLabel></th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{p.estacionamientos > 0 ? p.estacionamientos : '—'}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Calendar}>Antigüedad</RowLabel></th>
            {properties.map((p, i) => (
              <td key={p.id} className={tdBase}>
                {p.operacion === 'venta' ? (p.antiguedad > 0 ? `${p.antiguedad} años` : 'Nueva') : '—'}
                {antiguedadBest === i && <HighlightTag label="La más nueva" />}
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Droplets}>Riesgo de inundación</RowLabel></th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: FLOOD_COLOR[p.riesgoInundacion] }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FLOOD_COLOR[p.riesgoInundacion] }} />
                  {FLOOD_LABEL[p.riesgoInundacion]}
                </span>
              </td>
            ))}
          </tr>
          {showDosBocas && (
            <tr className={rowBorder}>
              <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Zap}>Cerca de Dos Bocas</RowLabel></th>
              {properties.map((p) => (
                <td key={p.id} className={tdBase}>{p.cercaDosoBocas ? 'Sí' : 'No'}</td>
              ))}
            </tr>
          )}
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Leaf}>Zona ecológica</RowLabel></th>
            {properties.map((p) => (
              <td key={p.id} className={tdBase}>{p.zonaEcologica ? 'Sí' : 'No'}</td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Sparkles}>Amenidades</RowLabel></th>
            {properties.map((p) => {
              const cortada = p.amenidades.length > 2;
              const texto = p.amenidades.length > 0
                ? `${p.amenidades.length} — ${p.amenidades.slice(0, 2).join(', ')}${cortada ? '…' : ''}`
                : '—';
              return (
                <td key={p.id} className={tdBase}>
                  {cortada ? (
                    <Tooltip label={p.amenidades.join(', ')} wrap>
                      <span className="underline decoration-dotted decoration-gray-300 underline-offset-2 cursor-help">{texto}</span>
                    </Tooltip>
                  ) : texto}
                </td>
              );
            })}
          </tr>
          <tr className="group">
            <th scope="row" className={`${thBase} bg-white`}><RowLabel icon={Clock}>Publicada</RowLabel></th>
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
