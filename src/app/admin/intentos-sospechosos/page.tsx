'use client';

import { useEffect, useState } from 'react';
import { Ban, CheckCircle2 } from 'lucide-react';
import { formatRelativeDate } from '@/lib/format';
import { backendFetch } from '@/lib/backendApi';
import { Modal } from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';

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
  const [detalle, setDetalle] = useState<Intento | null>(null);

  useEffect(() => {
    backendFetch<Intento[]>('/admin/intentos-sospechosos')
      .then((intentos) => setIntentos(intentos ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Intentos sospechosos</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Búsquedas con marcadores de manipulación del buscador de IA (inyección de instrucciones, jailbreak). Solo lectura — 3 confirmados de la misma cuenta la bloquean automáticamente (ver src/lib/moderacionBusqueda.ts).
      </p>

      {loading ? (
        <TableSkeleton headers={['Usuario', 'Búsqueda', 'Marcador', 'Estado', 'Fecha']} />
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
                  <tr key={i.id} onClick={() => setDetalle(i)} className="cursor-pointer hover:bg-gray-50">
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

      {/* Antes solo había un `title` (tooltip nativo) para leer el texto
          completo de una búsqueda marcada — incómodo para triage real de
          payloads largos. */}
      <Modal isOpen={!!detalle} onClose={() => setDetalle(null)} title="Detalle del intento">
        {detalle && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Búsqueda completa</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3">{detalle.consulta}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Marcador</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3">{detalle.marcador}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
