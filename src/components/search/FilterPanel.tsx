'use client';

import { useState, useEffect } from 'react';
import type { SearchFilters } from '@/types/search';
import type { OperationType } from '@/types/property';
import { X, Zap, Check } from 'lucide-react';
import { PROPERTY_TYPE_CONFIG } from '@/lib/propertyTypeConfig';
import { MUNICIPIO_OPTIONS } from '@/lib/publishSchema';

interface FilterPanelProps {
  filters: SearchFilters;
  onUpdate: (updates: Partial<SearchFilters>) => void;
  onClear: () => void;
  activeCount: number;
  total?: number;
}

const TIPO_OPTIONS = (['casa', 'departamento', 'terreno', 'habitacion', 'local', 'oficina'] as const).map(
  (value) => ({ value, label: PROPERTY_TYPE_CONFIG[value].label, Icon: PROPERTY_TYPE_CONFIG[value].Icon })
);

const RECAMARAS_OPTIONS = [1, 2, 3, 4];

const PRICE_RANGE = {
  venta: { min: 0, max: 10_000_000, step: 100_000 },
  renta: { min: 0, max: 30_000,     step: 1_000   },
} as const;

function formatPeso(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

const thumbCls = [
  'absolute w-full appearance-none bg-transparent cursor-pointer',
  '[&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
  '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab',
  '[&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:border-0',
  '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4',
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:cursor-grab',
].join(' ');

function DualRangeSlider({ min, max, step, low, high, onChange, labelLow, labelHigh }: {
  min: number; max: number; step: number;
  low: number; high: number;
  onChange: (low: number, high: number) => void;
  labelLow: string; labelHigh: string;
}) {
  const [localLow,  setLocalLow]  = useState(low);
  const [localHigh, setLocalHigh] = useState(high);
  const [topInput,  setTopInput]  = useState<'low' | 'high'>('high');

  // Sync from parent only on external resets (e.g. "Quitar filtros")
  useEffect(() => {
    function sincronizarLow() { setLocalLow(low); }
    sincronizarLow();
  }, [low]);
  useEffect(() => {
    function sincronizarHigh() { setLocalHigh(high); }
    sincronizarHigh();
  }, [high]);

  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div className="relative h-5 flex items-center select-none">
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/15 pointer-events-none">
        <div
          className="absolute h-full rounded-full bg-white/70"
          style={{ left: `${pct(localLow)}%`, right: `${100 - pct(localHigh)}%` }}
        />
      </div>
      <input type="range" min={min} max={max} step={step} value={localLow}
        onPointerDown={() => setTopInput('low')}
        onChange={(e) => {
          const v = Math.min(Number(e.target.value), localHigh - step);
          setLocalLow(v);
          onChange(v, localHigh);
        }}
        aria-label={labelLow}
        aria-valuetext={low <= min ? 'Cualquiera' : `$${low.toLocaleString('es-MX')}`}
        className={`${thumbCls} ${topInput === 'low' ? 'z-20' : 'z-10'}`}
      />
      <input type="range" min={min} max={max} step={step} value={localHigh}
        onPointerDown={() => setTopInput('high')}
        onChange={(e) => {
          const v = Math.max(Number(e.target.value), localLow + step);
          setLocalHigh(v);
          onChange(localLow, v);
        }}
        aria-label={labelHigh}
        aria-valuetext={high >= max ? 'Sin límite' : `$${high.toLocaleString('es-MX')}`}
        className={`${thumbCls} ${topInput === 'high' ? 'z-20' : 'z-10'}`}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/40 mb-3">{title}</p>
      {children}
    </div>
  );
}

const btn = {
  inactive: 'bg-white/10 border-2 border-white/15 text-white/65 hover:border-white/35 hover:bg-white/15 hover:text-white',
  active:   'bg-white   border-2 border-white       text-brand-dark font-bold',
} as const;

export function FilterPanel({ filters, onUpdate, onClear, activeCount, total }: FilterPanelProps) {

  return (
    <div className="space-y-5">

      {/* ① Comprar vs Rentar */}
      <Section title="¿Qué quieres hacer?">
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: '',      label: 'Todo'    },
            { value: 'venta', label: 'Comprar' },
            { value: 'renta', label: 'Rentar'  },
          ] as { value: OperationType | ''; label: string }[]).map((op) => {
            const active = (filters.operacion ?? '') === op.value;
            return (
              <button
                key={op.value}
                onClick={() => onUpdate({ operacion: op.value, precioMin: undefined, precioMax: undefined })}
                className={`py-2.5 rounded-xl text-sm transition-all ${active ? btn.active : btn.inactive} ${
                  op.value === '' ? 'col-span-2' : ''
                }`}
              >
                {op.label}
              </button>
            );
          })}
        </div>
      </Section>

      <div className="h-px bg-white/10" />

      {/* ② Tipo */}
      <Section title="Tipo de propiedad">
        <div className="grid grid-cols-2 gap-1.5">
          {TIPO_OPTIONS.map((t) => {
            const active = filters.tipo === t.value;
            return (
              <button
                key={t.value}
                onClick={() => onUpdate({ tipo: active ? undefined : t.value })}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                  active ? btn.active : btn.inactive
                }`}
              >
                <t.Icon size={15} strokeWidth={2} className="flex-shrink-0" />
                <span className="leading-none">{t.label}</span>
                {active && <Check size={13} className="ml-auto text-brand" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </Section>

      <div className="h-px bg-white/10" />

      {/* ③ Municipio */}
      <Section title="¿Dónde?">
        <div className="relative">
          <select
            value={filters.municipio ?? ''}
            onChange={(e) => onUpdate({ municipio: e.target.value || undefined })}
            className={`w-full appearance-none rounded-xl text-base sm:text-sm font-medium transition-colors
                        focus:outline-none px-4 py-2.5 pr-9 cursor-pointer border-2
                        bg-white/10 text-white hover:border-white/35 focus:border-white/50
                        ${filters.municipio ? 'border-white text-white' : 'border-white/20 text-white/65'}`}
          >
            <option value="" className="bg-[#0A4F48] text-white">Todo Tabasco</option>
            {MUNICIPIO_OPTIONS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#0A4F48] text-white">
                {m.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </Section>

      <div className="h-px bg-white/10" />

      {/* ④ Precio */}
      {(() => {
        const priceOp = filters.operacion === 'renta' ? 'renta' : 'venta';
        const cfg  = PRICE_RANGE[priceOp];
        const low  = filters.precioMin || cfg.min;
        const high = filters.precioMax || cfg.max;
        return (
          <Section title={filters.operacion === 'renta' ? 'Renta / mes' : 'Precio'}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">
                {low <= cfg.min ? 'Cualquiera' : formatPeso(low)}
              </span>
              <span className="text-xs text-white/30">—</span>
              <span className="text-sm font-semibold text-white">
                {high >= cfg.max ? 'Sin límite' : formatPeso(high)}
              </span>
            </div>
            <DualRangeSlider
              min={cfg.min} max={cfg.max} step={cfg.step}
              low={low} high={high}
              onChange={(newLow, newHigh) => onUpdate({
                precioMin: newLow <= cfg.min ? undefined : newLow,
                precioMax: newHigh >= cfg.max ? undefined : newHigh,
              })}
              labelLow={priceOp === 'renta' ? 'Renta mínima' : 'Precio mínimo'}
              labelHigh={priceOp === 'renta' ? 'Renta máxima' : 'Precio máximo'}
            />
            {low <= cfg.min && high >= cfg.max && (
              <p className="text-xs text-white/25 text-center mt-2">Arrastra para filtrar por precio</p>
            )}
          </Section>
        );
      })()}

      <div className="h-px bg-white/10" />

      {/* ⑤ Recámaras */}
      <Section title="Recámaras mínimas">
        <div className="flex gap-1.5">
          {RECAMARAS_OPTIONS.map((n) => {
            const active = filters.recamaras === n;
            return (
              <button
                key={n}
                onClick={() => onUpdate({ recamaras: active ? undefined : n })}
                className={`flex-1 py-2 rounded-xl text-sm transition-all ${active ? btn.active : btn.inactive}`}
              >
                {n}+
              </button>
            );
          })}
        </div>
      </Section>

      <div className="h-px bg-white/10" />

      {/* ⑥ Dos Bocas */}
      <Section title="Zona especial">
        <button
          onClick={() => onUpdate({ cercaDosoBocas: filters.cercaDosoBocas ? undefined : true })}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
            filters.cercaDosoBocas
              ? 'bg-amber-400/20 border-amber-400 text-amber-300'
              : 'bg-white/10 border-white/15 text-white/65 hover:border-white/35 hover:bg-white/15 hover:text-white'
          }`}
        >
          <Zap size={18} className="flex-shrink-0" strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-none mb-0.5">Cerca de Dos Bocas</p>
            <p className={`text-xs leading-none mt-0.5 ${
              filters.cercaDosoBocas ? 'text-amber-400/60' : 'text-white/35'
            }`}>
              Refinería Olmeca / PEMEX
            </p>
          </div>
          {filters.cercaDosoBocas && <Check size={14} className="text-amber-400 flex-shrink-0" strokeWidth={2.5} />}
        </button>
      </Section>

      {/* Contador */}
      {total !== undefined && activeCount > 0 && (
        <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
          <p className="text-sm font-bold text-white">
            {total === 0
              ? 'Sin resultados'
              : `${total} propiedad${total !== 1 ? 'es' : ''} encontrada${total !== 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {/* Limpiar */}
      {activeCount > 0 && (
        <button
          onClick={onClear}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm
                     text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-all
                     border-2 border-dashed border-red-400/35 hover:border-red-400/55 font-medium"
        >
          <X size={14} /> Quitar filtros ({activeCount})
        </button>
      )}
    </div>
  );
}
