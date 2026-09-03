'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Clock, X, Loader2 } from 'lucide-react';
import { getAllProperties } from '@/lib/api';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/recentSearches';
import { interpretarBusqueda, esOracionLarga, MAX_QUERY_LENGTH, type FiltrosIA } from '@/lib/interpretarBusqueda';
import type { Property } from '@/types/property';

// Bandera de un solo uso para avisar en /propiedades que la búsqueda que
// trajo hasta ahí no tenía nada concreto que interpretar (ver irA más abajo)
// — sessionStorage en vez de un parámetro en la URL porque es un aviso de
// "cómo llegaste aquí", no un estado de la página en sí; no debería
// sobrevivir un refresh ni ensuciar la URL compartible.
export const BUSQUEDA_SIN_INTERPRETAR_KEY = 'vv:busqueda-sin-interpretar';

const TIPO_LABEL: Record<Property['tipo'], string> = {
  casa: 'casa',
  departamento: 'depa',
  terreno: 'terreno',
  local: 'local comercial',
  oficina: 'oficina',
  bodega: 'bodega',
  habitacion: 'habitación',
};

const formatoMonedaPlaceholder = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

/**
 * Placeholder rotativo — pedido explícito 2026-09-03, referencia: cosmos.so
 * (el placeholder no es estático, cambia cada cierto tiempo con fade
 * in/out). Corrección del mismo día: la primera versión tenía frases
 * inventadas a mano (colonias/precios que podían no existir en el catálogo
 * real). Ahora cada ejemplo se arma a partir de propiedades reales ya
 * cargadas (mismo fetch que ya alimenta las sugerencias de lugar) — nunca
 * sugiere algo que la plataforma no tiene hoy.
 */
export function construirEjemplosPlaceholder(properties: Property[]): string[] {
  const ejemplos: string[] = [];
  const agregar = (texto: string) => {
    if (!ejemplos.includes(texto)) ejemplos.push(texto);
  };

  // Barajado para que la selección varíe entre cargas de página, no
  // siempre las mismas primeras propiedades del arreglo.
  const barajadas = [...properties].sort(() => Math.random() - 0.5);

  for (const p of barajadas) {
    if (ejemplos.length >= 2) break;
    agregar(`${TIPO_LABEL[p.tipo] ?? p.tipo} en ${p.colonia}`);
  }

  const enRenta = barajadas.find((p) => p.operacion === 'renta');
  if (enRenta) agregar(`${TIPO_LABEL[enRenta.tipo] ?? enRenta.tipo} en renta en ${enRenta.colonia}`);

  const conRecamaras = barajadas.find((p) => p.recamaras >= 2);
  if (conRecamaras) agregar(`${conRecamaras.recamaras} recámaras en ${conRecamaras.colonia}`);

  const sinRiesgo = barajadas.find((p) => p.riesgoInundacion === 'bajo');
  if (sinRiesgo) {
    const municipioLabel = sinRiesgo.municipio === 'Centro' ? 'Villahermosa' : sinRiesgo.municipio;
    agregar(`algo que no se inunde en ${municipioLabel}`);
  }

  const cercaDosBocas = barajadas.find((p) => p.cercaDosoBocas);
  if (cercaDosBocas) agregar(`${TIPO_LABEL[cercaDosBocas.tipo] ?? cercaDosBocas.tipo} cerca de Dos Bocas`);

  const rentas = properties.filter((p) => p.operacion === 'renta').map((p) => p.precio);
  if (rentas.length > 0) {
    const techo = Math.ceil(Math.min(...rentas) / 1000) * 1000;
    agregar(`renta bajo ${formatoMonedaPlaceholder.format(techo)}`);
  }

  const ventas = properties.filter((p) => p.operacion === 'venta').map((p) => p.precio);
  if (ventas.length >= 2) {
    agregar(`casas entre ${formatoMonedaPlaceholder.format(Math.min(...ventas))} y ${formatoMonedaPlaceholder.format(Math.max(...ventas))}`);
  }

  // Tope de 6 — pedido explícito 2026-09-03 ("5-6 solo si existen"). Cada
  // categoría de arriba ya se salta sola si no hay ninguna propiedad real
  // que la respalde, así que esto nunca rellena con menos de lo que
  // debería si el catálogo es chico — solo evita pasarse de 6 cuando el
  // catálogo tiene de sobra para las 8 categorías posibles.
  return ejemplos.slice(0, 6);
}

const PLACEHOLDER_ROTAR_MS = 3200;
const PLACEHOLDER_FADE_MS = 350;

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
  const [places, setPlaces] = useState<string[]>([]);
  const [ejemplosPlaceholder, setEjemplosPlaceholder] = useState<string[]>([]);
  useEffect(() => {
    let cancelado = false;
    getAllProperties().then((props) => {
      if (cancelado) return;
      const set = new Set<string>();
      for (const p of props) {
        set.add(p.colonia);
        set.add(p.municipio === 'Centro' ? 'Villahermosa' : p.municipio);
      }
      setPlaces(Array.from(set).sort((a, b) => a.localeCompare(b, 'es')));
      setEjemplosPlaceholder(construirEjemplosPlaceholder(props));
    });
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    function cargarRecientes() {
      setRecent(getRecentSearches());
    }
    cargarRecientes();
  }, []);

  // Solo rota cuando nadie pasó un `placeholder` fijo por prop (algunas
  // pantallas necesitan un texto específico, no genérico) y cuando el
  // usuario no pidió reducir movimiento — la rotación no es indispensable,
  // así que se apaga entera para esa preferencia en vez de solo acortar el
  // fade.
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  // Barrido de izquierda a derecha (no solo opacidad) — pedido explícito
  // 2026-09-03. 'visible' = texto completo destapado. 'hidden-left' = tapado
  // desde el borde derecho (el barrido de entrada avanza hacia la derecha
  // hasta destaparlo entero). 'hidden-right' = tapado desde el borde
  // izquierdo (el barrido de salida avanza hacia la derecha hasta taparlo
  // entero) — misma dirección en ambos sentidos, entra y sale "barriendo"
  // igual.
  const [wipeState, setWipeState] = useState<'hidden-left' | 'visible' | 'hidden-right'>('visible');
  const [wipeAnimado, setWipeAnimado] = useState(true);
  useEffect(() => {
    if (placeholder) return;
    if (ejemplosPlaceholder.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let fadeTimeoutId: ReturnType<typeof setTimeout>;
    let raf1 = 0;
    let raf2 = 0;
    const intervalId = setInterval(() => {
      setWipeAnimado(true);
      setWipeState('hidden-right');
      fadeTimeoutId = setTimeout(() => {
        setPlaceholderIndex((i) => (i + 1) % ejemplosPlaceholder.length);
        // Reposiciona sin transición al otro lado, listo para el próximo
        // barrido de entrada — un doble requestAnimationFrame para que el
        // navegador pinte este estado "sin animación" antes de reactivarla,
        // si no, el salto se animaría también.
        setWipeAnimado(false);
        setWipeState('hidden-left');
        raf1 = requestAnimationFrame(() => {
          raf2 = requestAnimationFrame(() => {
            setWipeAnimado(true);
            setWipeState('visible');
          });
        });
      }, PLACEHOLDER_FADE_MS);
    }, PLACEHOLDER_ROTAR_MS);
    return () => {
      clearInterval(intervalId);
      clearTimeout(fadeTimeoutId);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [placeholder, ejemplosPlaceholder]);
  const wipeClipPath = wipeState === 'visible'
    ? 'inset(0 0 0 0)'
    : wipeState === 'hidden-left'
      ? 'inset(0 100% 0 0)'
      : 'inset(0 0 0 100%)';
  // "Prueba" fijo, solo lo que va entre comillas cambia — pedido explícito
  // 2026-09-03. El atributo `placeholder` nativo es un solo string plano,
  // no se puede animar una parte y otra no, así que cuando toca rotar se
  // reemplaza por una capa propia (ver overlay más abajo) en vez de
  // usar el placeholder nativo del <input>.
  const ejemploActual = ejemplosPlaceholder.length > 0
    ? ejemplosPlaceholder[placeholderIndex % ejemplosPlaceholder.length]
    // Mismo respaldo de siempre mientras carga el catálogo (o si falla,
    // ej. CORS bloqueado en localhost) — no inventa un ejemplo del
    // catálogo, es un caso fijo y genérico.
    : 'casa en Tabasco 2000';

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
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            maxLength={MAX_QUERY_LENGTH}
            placeholder={placeholder}
            aria-label={placeholder ? undefined : 'Buscar propiedades por lugar, precio o características'}
            className="w-full text-base text-gray-800 placeholder-gray-400 bg-transparent focus:outline-none"
          />
          {/* "Prueba" fijo, el ejemplo entre comillas rota con fade — el
              placeholder nativo del <input> queda vacío en este caso, esta
              capa lo reemplaza. pointer-events-none para no robarle clics
              al input; solo se ve cuando no hay texto escrito, igual que
              un placeholder normal. */}
          {!placeholder && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center text-base text-gray-400 truncate"
              style={{ visibility: value ? 'hidden' : 'visible' }}
            >
              Prueba&nbsp;
              <span
                className={`inline-block ${wipeAnimado ? 'transition-[clip-path] duration-300 ease-out' : ''}`}
                style={{ clipPath: wipeClipPath }}
              >
                &ldquo;{ejemploActual}&rdquo;
              </span>
            </span>
          )}
        </div>
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
                  className="flex items-center gap-1 px-1.5 py-1 -m-1 text-xs text-gray-500 hover:text-red-500 transition-colors">
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
