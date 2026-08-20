'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatRelativeDate } from '@/lib/format';
import { backendFetch } from '@/lib/backendApi';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';

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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [loading, setLoading] = useState(true);

  // BACKEND-AUDITORIA-EDGE-CASES-20082026.md #8: GET /admin/auditoria pasó
  // de un array plano con techo fijo de 200 a { acciones, total, page,
  // perPage } paginado de verdad — antes esta página truena con ".map is
  // not a function" porque seguía esperando el array plano.
  const cargar = useCallback(async () => {
    setLoading(true);
    const data = await backendFetch<{
      acciones: Accion[];
      total: number;
      page: number;
      perPage: number;
    }>(`/admin/auditoria?page=${page}`);
    setAcciones(data.acciones ?? []);
    setTotal(data.total ?? 0);
    setPerPage(data.perPage ?? 20);
    setLoading(false);
  }, [page]);

  useEffect(() => { function cargarInicial() { cargar(); } cargarInicial(); }, [cargar]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Auditoría</h1>
      <p className="text-gray-500 text-sm mb-6">Registro de cada acción tomada desde este panel — quién, qué y sobre qué. {total} acci{total !== 1 ? 'ones' : 'ón'} en total.</p>

      {loading ? (
        <TableSkeleton headers={['Admin', 'Acción', 'Objetivo', 'Detalle', 'Fecha']} />
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

      <div className="mt-6">
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
