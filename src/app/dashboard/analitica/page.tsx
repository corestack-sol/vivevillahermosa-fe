'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Info, Eye, MessageCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getMisPropiedadesDemo, type MiPropiedad } from '@/lib/misPropiedadesDemo';
import { getMisPropiedadesConOverrides } from '@/lib/propiedadesLocales';
import { getSerieDemo, sumar, cambioPorcentual } from '@/lib/analiticaDemo';
import { Sparkline } from '@/components/dashboard/Sparkline';

function TendenciaBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="flex items-center gap-1 text-xs font-semibold text-gray-400"><Minus size={12} /> Sin base</span>;
  }
  if (pct === 0) {
    return <span className="flex items-center gap-1 text-xs font-semibold text-gray-400"><Minus size={12} /> Sin cambio</span>;
  }
  const positivo = pct > 0;
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${positivo ? 'text-emerald-600' : 'text-red-500'}`}>
      {positivo ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {positivo ? '+' : ''}{pct}% vs. periodo anterior
    </span>
  );
}

export default function AnaliticaPage() {
  const [items, setItems] = useState<MiPropiedad[]>(getMisPropiedadesDemo());

  useEffect(() => {
    function aplicar() {
      setItems(getMisPropiedadesConOverrides(getMisPropiedadesDemo()));
    }
    aplicar();
  }, []);

  const porPropiedad = items.map((it) => {
    const serie = getSerieDemo(it.property.id, 60);
    const actual = serie.slice(-30);
    const anterior = serie.slice(0, 30);
    const vistas30 = sumar(actual, 'vistas');
    const vistasAnterior = sumar(anterior, 'vistas');
    return {
      property: it.property,
      vistas30,
      vistasAnterior,
      contactos30: sumar(actual, 'contactos'),
      cambioVistas: cambioPorcentual(vistas30, vistasAnterior),
      sparkline: actual.map((p) => p.vistas),
    };
  });

  const totalVistas = porPropiedad.reduce((acc, p) => acc + p.vistas30, 0);
  const totalVistasAnterior = porPropiedad.reduce((acc, p) => acc + p.vistasAnterior, 0);
  const totalContactos = porPropiedad.reduce((acc, p) => acc + p.contactos30, 0);
  const cambioTotalVistas = cambioPorcentual(totalVistas, totalVistasAnterior);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/propiedades" className="text-gray-400 hover:text-brand transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Analítica</h1>
          <p className="text-sm text-gray-500">Desempeño de tu cartera en los últimos 30 días</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-6">
        <Info size={15} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand-dark leading-relaxed">
          <strong>Vista previa con datos de muestra.</strong> Estas series se generan de forma consistente
          para que puedas explorar cómo se verá la analítica real — cuando exista una tabla de eventos con
          fecha (vistas/contactos por propiedad), esta pantalla mostrará tu desempeño real, incluida la
          comparación contra el periodo anterior.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-500 font-medium">Publica una propiedad para ver su analítica aquí.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                <Eye size={13} /> Vistas (30 días)
              </p>
              <p className="text-3xl font-display font-black text-gray-900 mb-1">{totalVistas}</p>
              <TendenciaBadge pct={cambioTotalVistas} />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                <MessageCircle size={13} /> Contactos (30 días)
              </p>
              <p className="text-3xl font-display font-black text-gray-900 mb-1">{totalContactos}</p>
              <p className="text-xs text-gray-400">De {items.length} propiedad{items.length !== 1 ? 'es' : ''} publicada{items.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="space-y-3">
            {porPropiedad.map(({ property, vistas30, contactos30, cambioVistas, sparkline }) => (
              <div key={property.id} className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 flex-wrap sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{property.titulo}</p>
                  <p className="text-xs text-gray-400 truncate mb-1">{property.colonia}, {property.municipio === 'Centro' ? 'Villahermosa' : property.municipio}</p>
                  <TendenciaBadge pct={cambioVistas} />
                </div>
                <Sparkline valores={sparkline} width={160} height={44} />
                <div className="flex items-center gap-4 text-sm flex-shrink-0">
                  <div className="text-center">
                    <p className="font-bold text-gray-900">{vistas30}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Vistas</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900">{contactos30}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Contactos</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
