'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { CardListSkeleton } from '@/components/ui/Skeleton';
import { formatRelativeDate } from '@/lib/format';
import { backendFetch, BackendApiError } from '@/lib/backendApi';

interface Reporte {
  id: string;
  propiedadId: string;
  userId: string | null;
  motivo: string;
  comentario: string | null;
  estado: 'pendiente' | 'revisado' | 'descartado';
  createdAt: string;
}

const ESTADOS = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'revisado', label: 'Revisados' },
  { value: 'descartado', label: 'Descartados' },
];

const MOTIVO_LABEL: Record<string, string> = {
  info_falsa: 'Información falsa',
  precio_sospechoso: 'Precio sospechoso',
  contenido_inapropiado: 'Contenido inapropiado',
  posible_fraude: 'Posible fraude',
  otro: 'Otro',
};

export default function AdminReportesPage() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [estado, setEstado] = useState('pendiente');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState<{ reporte: Reporte; nuevoEstado: 'revisado' | 'descartado' } | null>(null);
  const [error, setError] = useState('');

  // BACKEND-AUDITORIA-EDGE-CASES-20082026.md #8: GET /admin/reportes pasó de
  // un array plano con techo fijo de 200 a { reportes, total, page, perPage }
  // paginado de verdad — antes esta página truena con ".map is not a
  // function" porque seguía esperando el array plano.
  const cargar = useCallback(async () => {
    setLoading(true);
    const data = await backendFetch<{
      reportes: Reporte[];
      total: number;
      page: number;
      perPage: number;
    }>(`/admin/reportes?estado=${estado}&page=${page}`);
    setReportes(data.reportes ?? []);
    setTotal(data.total ?? 0);
    setPerPage(data.perPage ?? 20);
    setLoading(false);
  }, [estado, page]);

  useEffect(() => { function cargarInicial() { cargar(); } cargarInicial(); }, [cargar]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  async function resolver() {
    if (!confirmar) return;
    setEnviando(true);
    setError('');
    try {
      await backendFetch(`/admin/reportes/${confirmar.reporte.id}/resolver`, {
        method: 'POST',
        body: JSON.stringify({ estado: confirmar.nuevoEstado }),
      });
      setConfirmar(null);
      cargar();
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'Ocurrió un error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Reportes de publicaciones</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Cada reporte queda ligado a una propiedad real (borrar la propiedad borra sus reportes en cascada) — usa el enlace de cada tarjeta para revisar la publicación antes de resolver.
      </p>

      <div className="w-52 mb-5">
        <Select options={ESTADOS} value={estado} onChange={(e) => { setPage(1); setEstado(e.target.value); }} placeholder="" />
      </div>

      {loading ? (
        <CardListSkeleton />
      ) : reportes.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Sin reportes {estado === 'pendiente' ? 'pendientes' : `en estado "${estado}"`}</div>
      ) : (
        <div className="space-y-3">
          {reportes.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <span className="inline-block text-xs font-semibold text-brand bg-brand-pale px-2 py-0.5 rounded-full mb-1.5">{MOTIVO_LABEL[r.motivo] ?? r.motivo}</span>
                  <p className="text-xs text-gray-400">{r.userId ? 'Reportado por un usuario con sesión' : 'Reportado de forma anónima'} · {formatRelativeDate(r.createdAt)}</p>
                </div>
                <Link
                  href={`/propiedades/${r.propiedadId}`}
                  target="_blank"
                  className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline flex-shrink-0"
                >
                  Ver publicación <ArrowUpRight size={12} />
                </Link>
              </div>
              {r.comentario && <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-3">{r.comentario}</p>}
              {r.estado === 'pendiente' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setConfirmar({ reporte: r, nuevoEstado: 'revisado' })}>
                    <CheckCircle2 size={14} /> Marcar revisado
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmar({ reporte: r, nuevoEstado: 'descartado' })}>
                    <XCircle size={14} /> Descartar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      <Modal
        isOpen={!!confirmar}
        onClose={() => setConfirmar(null)}
        title={confirmar?.nuevoEstado === 'revisado' ? 'Marcar como revisado' : 'Descartar reporte'}
      >
        {confirmar && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {confirmar.nuevoEstado === 'revisado'
                ? 'Vas a marcar como revisado el reporte sobre'
                : 'Vas a descartar el reporte sobre'}{' '}
              <code className="bg-gray-50 px-1 py-0.5 rounded text-gray-800">{confirmar.reporte.propiedadId}</code>
              {' '}({MOTIVO_LABEL[confirmar.reporte.motivo] ?? confirmar.reporte.motivo}). Esta acción no se puede deshacer desde aquí.
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmar(null)}>Cancelar</Button>
              <Button
                variant={confirmar.nuevoEstado === 'revisado' ? 'primary' : 'danger'}
                onClick={resolver}
                isLoading={enviando}
              >
                {confirmar.nuevoEstado === 'revisado' ? 'Confirmar' : 'Confirmar descarte'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
