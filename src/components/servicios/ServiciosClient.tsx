'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Wrench, Search } from 'lucide-react';
import { ServiceCard, type ServicioPublico } from './ServiceCard';
import { CATEGORIA_SERVICIO_OPTIONS } from '@/lib/publishServicioSchema';
import { MUNICIPIO_OPTIONS } from '@/lib/publishSchema';
import { Select } from '@/components/ui/Select';
import { buttonClasses } from '@/components/ui/Button';

interface Props {
  servicios: ServicioPublico[];
}

/**
 * Filtro cliente-side sobre lo ya cargado (mismo patrón que
 * PropertiesClient.tsx) — el catálogo de servicios es chico, no hace falta
 * ir y volver al servidor por cada filtro. Categoría es lo primero que ve
 * la gente (chips grandes) porque la intención real es "necesito un
 * plomero", no comparar 40 opciones — el filtro de municipio es un
 * refinamiento secundario, no el punto de entrada.
 */
export function ServiciosClient({ servicios }: Props) {
  const [categoria, setCategoria] = useState<string>('');
  const [municipio, setMunicipio] = useState<string>('');

  const filtrados = useMemo(() => {
    return servicios.filter((s) => {
      if (categoria && s.categoria !== categoria) return false;
      if (municipio && s.municipio !== municipio) return false;
      return true;
    });
  }, [servicios, categoria, municipio]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-gray-900 mb-1">Servicios para tu hogar</h1>
          <p className="text-gray-500">Plomería, pintura, mudanza, remodelación y más — en Tabasco.</p>
        </div>
        <Link href="/servicios/publicar" className={buttonClasses('secondary', 'md')}>
          Publica tu servicio gratis
        </Link>
      </div>

      {/* Chips de categoría — entrada principal */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setCategoria('')}
          className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
            categoria === '' ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-200 hover:border-brand/40'
          }`}
        >
          Todas
        </button>
        {CATEGORIA_SERVICIO_OPTIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategoria(c.value)}
            className={`text-sm font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
              categoria === c.value ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-200 hover:border-brand/40'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Refinamiento secundario */}
      <div className="max-w-xs mb-8">
        <Select
          options={MUNICIPIO_OPTIONS}
          placeholder="Todos los municipios"
          value={municipio}
          onChange={(e) => setMunicipio(e.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Wrench size={32} className="mx-auto mb-3 text-gray-300" strokeWidth={1.5} />
          <p className="text-gray-500 font-medium mb-1">Todavía no hay proveedores en esta categoría/zona</p>
          <p className="text-sm text-gray-400 mb-4">Sé el primero en publicar tu servicio aquí.</p>
          <Link href="/servicios/publicar" className={buttonClasses('outline', 'sm')}>
            <Search size={14} /> Publicar servicio
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((s) => <ServiceCard key={s.id} servicio={s} />)}
        </div>
      )}
    </div>
  );
}
