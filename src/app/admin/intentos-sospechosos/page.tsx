'use client';

import { useEffect, useState } from 'react';
import { Loader2, Ban, CheckCircle2 } from 'lucide-react';
import { formatRelativeDate } from '@/lib/format';

interface Intento {
  id: string;
  userId: string;
  consulta: string;
  marcador: string;
  createdAt: string;
  user: { email: string; nombre: string; bloqueado: boolean };
}

export default function AdminIntentosSospechososPage() {
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/intentos-sospechosos', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setIntentos(data.intentos ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Intentos sospechosos</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Búsquedas con marcadores de manipulación del buscador de IA (inyección de instrucciones, jailbreak). Solo lectura — 3 confirmados de la misma cuenta la bloquean automáticamente (ver src/lib/moderacionBusqueda.ts).
      </p>

      {loading ? (
        <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline" size={20} /></div>
      ) : intentos.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Sin intentos registrados</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Usuario</th>
                  <th className="text-left px-4 py-3 font-semibold">Búsqueda</th>
                  <th className="text-left px-4 py-3 font-semibold">Marcador</th>
                  <th className="text-left px-4 py-3 font-semibold">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {intentos.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{i.user.nombre}</p>
                      <p className="text-xs text-gray-400">{i.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-md truncate" title={i.consulta}>{i.consulta}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate" title={i.marcador}>{i.marcador}</td>
                    <td className="px-4 py-3">
                      {i.user.bloqueado ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><Ban size={11} /> Bloqueado</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={11} /> Activo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatRelativeDate(i.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
