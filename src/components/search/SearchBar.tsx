'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Clock, X, Loader2 } from 'lucide-react';
import { getAllProperties } from '@/lib/api';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/recentSearches';
import { interpretarBusqueda, esOracionLarga, type FiltrosIA } from '@/lib/interpretarBusqueda';

// Bandera de un solo uso para avisar en /propiedades que la búsqueda que
// trajo hasta ahí no tenía nada concreto que interpretar (ver irA más abajo)
// — sessionStorage en vez de un parámetro en la URL porque es un aviso de
// "cómo llegaste aquí", no un estado de la página en sí; no debería
// sobrevivir un refresh ni ensuciar la URL compartible.
export const BUSQUEDA_SIN_INTERPRETAR_KEY = 'vv:busqueda-sin-interpretar';

interface SearchBarProps {
  initialValue?: string;
  placeholder?: string;
  onSearch?: (value: string) => void;
  className?: string;
}

export function SearchBar({ initialValue = '', placeholder, onSearch, className = '' }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Antes esta lista era 14 colonias hardcodeadas, algunas sin ninguna
  // propiedad real detrás. Ahora las sugerencias salen del catálogo real
  // (colonias + municipios con al menos una propiedad), así nunca se
  // sugiere un lugar donde el usuario luego encuentra "sin resultados".
  const places = useMemo(() => {
    const set = new Set<string>();
    for (const p of getAllProperties()) {
      set.add(p.colonia);
      set.add(p.municipio === 'Centro' ? 'Villahermosa' : p.municipio);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, []);

  useEffect(() => {
    function cargarRecientes() {
      setRecent(getRecentSearches());
    }
    cargarRecientes();
  }, []);

  const filtered = value.length >= 2
    ? places.filter((s) => s.toLowerCase().includes(value.toLowerCase())).slice(0, 6)
    : [];

  const showSuggestions = open && filtered.length > 0;
  const showRecent = open && value.length < 2 && recent.length > 0;

  function irA(q: string, filtros: FiltrosIA = {}) {
    setOpen(false);
    addRecentSearch(q);
    setRecent(getRecentSearches());
    if (onSearch) {
      onSearch(q);
      return;
    }
    const hayFiltros = Object.keys(filtros).length > 0;
    const params = new URLSearchParams();
    // applyFilters (src/lib/filters.ts) trata `q` como un AND obligatorio de
    // texto literal contra título/colonia/municipio/descripción — mandar la
    // oración completa ("quiero que me muestres propiedades cerca de dos
    // bocas") junto con los filtros que la IA sí extrajo bien garantizaba
    // cero resultados, porque ninguna propiedad tiene esa frase en su texto.
    // Si la IA identificó una colonia/fraccionamiento específico dentro de
    // la búsqueda (ej. "Gaviotas"), se usa esa frase corta como `q` — sigue
    // siendo texto literal, pero corto y real, así que sí puede convivir
    // con los demás filtros en vez de excluir todo. Si no encontró nada que
    // interpretar Y es un término corto, `q` cae a la oración completa
    // (búsqueda simple de un lugar sin catalogar, sí puede matchear). Si es
    // una oración larga sin nada que interpretar, no se manda `q` en
    // absoluto — dejarla condenaba la búsqueda a cero resultados por el
    // mismo motivo de arriba; se avisa en /propiedades vía sessionStorage.
    if (filtros.colonia) {
      params.set('colonia', filtros.colonia);
    } else if (!hayFiltros) {
      if (esOracionLarga(q)) {
        if (typeof window !== 'undefined') sessionStorage.setItem(BUSQUEDA_SIN_INTERPRETAR_KEY, '1');
      } else {
        params.set('q', q);
      }
    }
    if (filtros.municipio) params.set('municipio', filtros.municipio);
    if (filtros.tipo) params.set('tipo', filtros.tipo);
    if (filtros.operacion) params.set('operacion', filtros.operacion);
    if (filtros.precioMin) params.set('precioMin', String(filtros.precioMin));
    if (filtros.precioMax) params.set('precioMax', String(filtros.precioMax));
    if (filtros.recamaras) params.set('recamaras', String(filtros.recamaras));
    if (filtros.recamarasMax) params.set('recamarasMax', String(filtros.recamarasMax));
    if (filtros.banos) params.set('banos', String(filtros.banos));
    if (filtros.m2Min) params.set('m2Min', String(filtros.m2Min));
    if (filtros.m2Max) params.set('m2Max', String(filtros.m2Max));
    if (filtros.amenidad) params.set('amenidad', filtros.amenidad);
    if (filtros.riesgoInundacion) params.set('riesgo', filtros.riesgoInundacion);
    if (filtros.cercaDosoBocas) params.set('dosabocas', '1');
    if (filtros.landmark) params.set('cerca', filtros.landmark);
    else if (filtros.categoriaLandmark) params.set('cercaTipo', filtros.categoriaLandmark);
    if (filtros.zonaDestacada) params.set('zona', filtros.zonaDestacada);
    if (filtros.sort) params.set('sort', filtros.sort);
    if (filtros.limite) params.set('limite', String(filtros.limite));
    router.push(`/buscar?${params.toString()}`);
  }

  // Interpreta la búsqueda con IA antes de navegar, para que términos como
  // "cerca de Dos Bocas" o "que no se inunde" se traduzcan en filtros reales
  // en vez de depender de que el texto coincida palabra por palabra con el
  // título de alguna propiedad. Compartido entre el submit del formulario y
  // un clic en una búsqueda reciente (ver handleRecentClick) — ambos son
  // "el usuario quiere buscar este texto", no solo el primero.
  async function buscarTexto(s: string) {
    setValue(s);
    setBuscando(true);
    const filtros = await interpretarBusqueda(s);
    setBuscando(false);
    irA(s, filtros);
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = value.trim();
    if (!q) return;
    await buscarTexto(q);
  };

  const handleSuggestion = (s: string) => {
    setValue(s);
    // Es un nombre de lugar exacto (colonia/municipio de la lista real) —
    // no hace falta interpretarlo con IA.
    irA(s);
  };

  const handleRecentClick = (s: string) => {
    // Antes esto llamaba a irA(s) directamente (como handleSuggestion), que
    // navega de inmediato — incluso con el fix de reinterpretar con IA, la
    // navegación seguía pisando el relleno visual casi al instante (la IA
    // responde en menos de 1s, a veces menos de lo que tarda el ojo en
    // registrar el cambio). Un clic en el historial ahora SOLO llena el
    // campo y cierra el dropdown — el usuario decide cuándo buscar
    // (Enter o el botón), igual que si lo hubiera escrito él mismo. Así el
    // relleno es un estado real y visible, no una carrera contra la
    // navegación.
    setValue(s);
    setOpen(false);
    inputRef.current?.focus();
  };

  function handleClearRecent(e: React.MouseEvent) {
    e.stopPropagation();
    clearRecentSearches();
    setRecent([]);
  }

  // Antes esto comparaba contra inputRef (solo el <input>), no contra el
  // dropdown completo — así que un mousedown sobre un botón de sugerencia o
  // de búsqueda reciente contaba como "clic afuera" y cerraba el dropdown
  // ANTES de que el evento click del botón llegara a dispararse (mousedown
  // ocurre primero; al desmontar el botón en ese momento, el click nunca se
  // registra). El resultado era que ningún clic dentro del dropdown hacía
  // nada — ni rellenar el input ni navegar. Comparar contra todo el
  // formulario (input + dropdown) evita que un clic interno se confunda con
  // uno externo.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    // z-20 aquí, no solo en el <ul> del dropdown — un z-index en un hijo
    // profundo solo gana dentro de SU PROPIO contexto de apilamiento; para
    // que el dropdown pinte encima de hermanos de este <form> (en Home, la
    // barra de "31+ / 17 mun / $0 / 5 min" justo debajo), hace falta
    // promover el contexto de este contenedor entero, no solo el <ul>.
    <form ref={containerRef} onSubmit={handleSubmit} className={`relative z-20 ${className}`}>
      {/* Borde real (no solo un ring blanco pensado para fondos oscuros) —
          así la tarjeta se define igual sobre un hero claro que sobre uno oscuro. */}
      <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl shadow-2xl px-5 py-4"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
        <Search size={20} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? 'Tabasco 2000, Gaviotas, Paraíso, Comalcalco...'}
          className="flex-1 text-base text-gray-800 placeholder-gray-400 bg-transparent focus:outline-none min-w-0"
        />
        <button type="submit" disabled={buscando}
          className="flex-shrink-0 flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors whitespace-nowrap disabled:opacity-70">
          {buscando && <Loader2 size={14} className="animate-spin" />}
          Buscar
        </button>
      </div>

      {(showSuggestions || showRecent) && (
        <ul className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden z-20">
          {showSuggestions && filtered.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => handleSuggestion(s)}
                className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-brand-pale hover:text-brand text-left transition-colors">
                <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                {s}
              </button>
            </li>
          ))}

          {showRecent && (
            <>
              <li className="flex items-center justify-between px-5 pt-3 pb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Búsquedas recientes</span>
                <button type="button" onClick={handleClearRecent}
                  className="flex items-center gap-1 text-xs text-gray-300 hover:text-red-500 transition-colors">
                  <X size={11} /> Borrar
                </button>
              </li>
              {recent.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => handleRecentClick(s)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-brand-pale hover:text-brand text-left transition-colors">
                    <Clock size={13} className="text-gray-400 flex-shrink-0" />
                    {s}
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </form>
  );
}
