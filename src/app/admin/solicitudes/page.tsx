'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatRelativeDate } from '@/lib/format';
import { backendFetch, BackendApiError } from '@/lib/backendApi';

interface Solicitud {
  id: string;
  motivo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  respuestaAdmin: string | null;
  createdAt: string;
  resueltoEn: string | null;
  user: { email: string; nombre: string; bloqueado: boolean; bloqueadoMotivo: string | null; bloqueadoEn: string | null };
}

const ESTADOS = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aprobada', label: 'Aprobadas' },
  { value: 'rechazada', label: 'Rechazadas' },
];

export default function AdminSolicitudesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [estado, setEstado] = useState('pendiente');
  const [loading, setLoading] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState<{ solicitud: Solicitud; nuevoEstado: 'aprobada' | 'rechazada' } | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    const solicitudes = await backendFetch<Solicitud[]>(`/admin/solicitudes-revision?estado=${estado}`);
    setSolicitudes(solicitudes ?? []);
    setLoading(false);
  }, [estado]);

  useEffect(() => { function cargarInicial() { cargar(); } cargarInicial(); }, [cargar]);

  async function resolver() {
    if (!confirmar) return;
    setEnviando(true);
    setError('');
    try {
      await backendFetch(`/admin/solicitudes-revision/${confirmar.solicitud.id}/resolver`, {
        method: 'POST',
        body: JSON.stringify({ estado: confirmar.nuevoEstado, respuestaAdmin: respuesta.trim() || undefined }),
      });
      setConfirmar(null);
      setAbierta(null);
      setRespuesta('');
      cargar();
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'Ocurrió un error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Solicitudes de revisión</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Cuentas bloqueadas automáticamente por el sistema de moderación del buscador que pidieron que un humano revise el caso.
        Aprobar reactiva la cuenta al instante; en ambos casos se le avisa por correo — es el único canal que le llega a alguien mientras sigue bloqueado.
      </p>

      <div className="w-52 mb-5">
        <Select options={ESTADOS} value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="" />
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline" size={20} /></div>
      ) : solicitudes.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Sin solicitudes {estado === 'pendiente' ? 'pendientes' : `en estado "${estado}"`}</div>
      ) : (
        <div className="space-y-4">
          {solicitudes.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{s.user.nombre}</p>
                  <p className="text-xs text-gray-400">{s.user.email}</p>
                </div>
                <EstadoBadge estado={s.estado} />
              </div>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-2">{s.motivo}</p>
              {s.user.bloqueadoMotivo && (
                <p className="text-xs text-gray-400 mb-3">Motivo del bloqueo original: {s.user.bloqueadoMotivo}</p>
              )}
              <p className="text-xs text-gray-400 mb-3">Solicitada {formatRelativeDate(s.createdAt)}</p>

              {s.respuestaAdmin && (
                <p className="text-sm text-gray-600 border-l-2 border-brand/30 pl-3 mb-3">Respuesta enviada: {s.respuestaAdmin}</p>
              )}

              {s.estado === 'pendiente' && (
                abierta === s.id ? (
                  <div className="space-y-2 mt-2">
                    <textarea
                      value={respuesta}
                      onChange={(e) => setRespuesta(e.target.value)}
                      rows={2}
                      placeholder="Respuesta opcional para el correo (por qué se aprobó o rechazó)"
                      className="w-full rounded-xl border border-gray-200 text-base sm:text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setConfirmar({ solicitud: s, nuevoEstado: 'aprobada' })}>
                        <CheckCircle2 size={14} /> Aprobar y reactivar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirmar({ solicitud: s, nuevoEstado: 'rechazada' })}>
                        <XCircle size={14} /> Rechazar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAbierta(null); setRespuesta(''); }}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAbierta(s.id)}>Resolver</Button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!confirmar}
        onClose={() => setConfirmar(null)}
        title={confirmar?.nuevoEstado === 'aprobada' ? 'Confirmar reactivación' : 'Confirmar rechazo'}
      >
        {confirmar && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {confirmar.nuevoEstado === 'aprobada'
                ? 'Vas a reactivar la cuenta de'
                : 'Vas a mantener bloqueada la cuenta de'}{' '}
              <strong className="text-gray-800">{confirmar.solicitud.user.nombre}</strong> ({confirmar.solicitud.user.email}) —
              se le enviará un correo con el resultado{respuesta.trim() ? ' y tu respuesta' : ''}.
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmar(null)}>Cancelar</Button>
              <Button
                variant={confirmar.nuevoEstado === 'aprobada' ? 'primary' : 'danger'}
                onClick={resolver}
                isLoading={enviando}
              >
                {confirmar.nuevoEstado === 'aprobada' ? 'Confirmar reactivación' : 'Confirmar rechazo'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: Solicitud['estado'] }) {
  if (estado === 'aprobada') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={11} /> Aprobada</span>;
  if (estado === 'rechazada') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><XCircle size={11} /> Rechazada</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><Clock size={11} /> Pendiente</span>;
}
