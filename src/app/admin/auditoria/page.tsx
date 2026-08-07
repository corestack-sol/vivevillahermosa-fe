'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatRelativeDate } from '@/lib/format';

interface Accion {
  id: string;
  accion: string;
  objetivoId: string;
  detalle: string | null;
  createdAt: string;
  admin: { email: string; nombre: string };
}

const ACCION_LABEL: Record<string, string> = {
  bloquear_usuario: 'Bloqueó usuario',
  desbloquear_usuario: 'Desbloqueó usuario',
  promover_admin: 'Dio permisos de admin',
  revocar_admin: 'Revocó permisos de admin',
  resolver_solicitud_revision: 'Resolvió solicitud de revisión',
  resolver_reporte: 'Resolvió reporte',
  activar_servicio: 'Reactivó servicio',
  desactivar_servicio: 'Pausó servicio',
};

export default function AdminAuditoriaPage() {
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/auditoria', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setAcciones(data.acciones ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Auditoría</h1>
      <p className="text-gray-500 text-sm mb-6">Registro de cada acción tomada desde este panel — quién, qué y sobre qué. Últimas 200.</p>

      {loading ? (
        <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline" size={20} /></div>
      ) : acciones.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Sin acciones registradas todavía</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Admin</th>
                  <th className="text-left px-4 py-3 font-semibold">Acción</th>
                  <th className="text-left px-4 py-3 font-semibold">Objetivo</th>
                  <th className="text-left px-4 py-3 font-semibold">Detalle</th>
                  <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {acciones.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{a.admin.nombre}</p>
                      <p className="text-xs text-gray-400">{a.admin.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{ACCION_LABEL[a.accion] ?? a.accion}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs"><code className="bg-gray-50 px-1 py-0.5 rounded">{a.objetivoId}</code></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{a.detalle ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatRelativeDate(a.createdAt)}</td>
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
