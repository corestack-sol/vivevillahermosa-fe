'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { sugerirColonias, type ColoniaCoord } from '@/lib/colonias';

interface ColoniaAutocompleteProps {
  value: string;
  municipio?: string;
  onChange: (texto: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  /**
   * Modo cerrado (alertas): solo se sugieren colonias DEL municipio dado, y
   * quien usa el componente debe quedarse únicamente con lo que llegue por
   * `onSeleccionar` — lo escrito a mano sin elegir una sugerencia no cuenta.
   */
  soloMunicipio?: boolean;
  onSeleccionar?: (c: ColoniaCoord) => void;
  disabled?: boolean;
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * Autocompletar de colonia — sugiere del catálogo (curado a mano +
 * descubierto de propiedades reales, ver colonias.ts) mientras se
 * escribe. Pedido explícito 2026-09-10: reducir colonias no reconocidas
 * desde el origen — antes era un input de texto libre que solo avisaba
 * DESPUÉS de escribir el nombre completo si no coincidía con nada (ver
 * PublishForm.tsx). Sigue siendo texto libre: elegir una sugerencia solo
 * rellena el campo, cualquier nombre sigue siendo válido de escribir a
 * mano si no aparece en la lista.
 */
export function ColoniaAutocomplete({
  value, municipio, onChange, label = 'Colonia', placeholder = 'Nombre de la colonia', error, soloMunicipio = false, onSeleccionar, disabled = false,
}: ColoniaAutocompleteProps) {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const [sugerencias, setSugerencias] = useState<ColoniaCoord[]>([]);
  const [sinCoincidencias, setSinCoincidencias] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', alHacerClicFuera);
    return () => document.removeEventListener('mousedown', alHacerClicFuera);
  }, []);

  function manejarCambio(texto: string) {
    onChange(texto);
    let nuevas = sugerirColonias(texto, municipio, soloMunicipio ? 200 : 8);
    if (soloMunicipio) {
      const m = sinAcentos(municipio ?? '');
      nuevas = nuevas.filter((c) => sinAcentos(c.municipio) === m).slice(0, 8);
    }
    setSinCoincidencias(soloMunicipio && texto.trim().length >= 2 && nuevas.length === 0);
    setSugerencias(nuevas);
    setResaltado(0);
    setAbierto(nuevas.length > 0);
  }

  function elegir(c: ColoniaCoord) {
    onChange(c.label);
    onSeleccionar?.(c);
    setSinCoincidencias(false);
    setAbierto(false);
  }

  function manejarTeclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setResaltado((i) => Math.min(i + 1, sugerencias.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setResaltado((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(sugerencias[resaltado]); }
    else if (e.key === 'Escape') { setAbierto(false); }
  }

  return (
    <div ref={contenedorRef} className="relative">
      <Input
        label={label}
        placeholder={placeholder}
        error={error}
        value={value}
        autoComplete="off"
        disabled={disabled}
        onChange={(e) => manejarCambio(e.target.value)}
        onFocus={() => { if (sugerencias.length > 0) setAbierto(true); }}
        onKeyDown={manejarTeclado}
      />
      {sinCoincidencias && (
        <p className="mt-1 text-xs text-gray-500">No hay colonias sugeridas con ese nombre en {municipio}. Prueba con otra parte del nombre.</p>
      )}
      {abierto && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1">
          {sugerencias.map((c, i) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => elegir(c)}
                onMouseEnter={() => setResaltado(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  i === resaltado ? 'bg-brand-pale text-brand' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <MapPin size={13} className="flex-shrink-0 text-gray-400" />
                <span className="truncate">{c.label}</span>
                <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{c.municipio}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
