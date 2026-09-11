'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { formatRelativeDate } from '@/lib/format';
import { backendFetch, BackendApiError } from '@/lib/backendApi';

/**
 * Cola de solicitudes de cambio de ubicación (pedido explícito 2026-09-11):
 * antes, un dueño que movía el pin más de RADIO_MAXIMO_PIN_KM al editar solo
 * veía un toast diciendo "contáctanos" — sin link, sin ningún lugar donde un
 * admin pudiera ver esos casos. `SolicitarCambioPinModal.tsx` reemplazó ese
 * toast por una solicitud real (POST /propiedades/:id/solicitud-pin); esta
 * página es el lado admin. Backend pendiente de construir, ver
 * docs/BACKEND-SOLICITUDES-CAMBIO-PIN-11092026.md — mismo criterio "honesto
 * si el endpoint aún no existe" que el resto de /admin/**.
 */
interface SolicitudPin {
  id: string;
  propiedadId: string;
  propiedadTitulo: string;
  latOriginal: number;
  lngOriginal: number;
  latSolicitada: number;
  lngSolicitada: number;
  distanciaKm: number;
  motivo: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  createdAt: string;
  user: { id: string; email: string; nombre: string };
}

const ESTADOS = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aprobada', label: 'Aprobadas' },
  { value: 'rechazada', label: 'Rechazadas' },
];

export default function AdminSolicitudesPinPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudPin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [estado, setEstado] = useState('pendiente');
  const [loading, setLoading] = useState(true);
  const [noImplementado, setNoImplementado] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [detalle, setDetalle] = useState<SolicitudPin | null>(null);
  const [rechazando, setRechazando] = useState<SolicitudPin | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aprobandoId, setAprobandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setNoImplementado(false);
    setErrorCarga('');
    try {
      const params = new URLSearchParams({ page: String(page), estado });
      const data = await backendFetch<{
        solicitudes: SolicitudPin[];
        total: number;
        page: number;
        perPage: number;
      }>(`/admin/solicitudes-pin?${params}`);
      setSolicitudes(data.solicitudes ?? []);
      setTotal(data.total ?? 0);
      setPerPage(data.perPage ?? 20);
    } catch (err) {
      // 404 = el endpoint todavía no existe del lado del backend — estado
      // honesto, no un error real (mismo criterio que admin/fraude/page.tsx).
      if (err instanceof BackendApiError && err.status === 404) {
        setNoImplementado(true);
        setSolicitudes([]);
        setTotal(0);
        return;
      }
      setErrorCarga(err instanceof BackendApiError ? err.message : 'No se pudieron cargar las solicitudes.');
      setSolicitudes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, estado]);

  useEffect(() => { function cargarInicial() { cargar(); } cargarInicial(); }, [cargar]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  async function aprobar(s: SolicitudPin) {
    setAprobandoId(s.id);
    try {
      // Aplica latSolicitada/lngSolicitada a la propiedad para real y marca
      // la solicitud como resuelta — ver docs/BACKEND-SOLICITUDES-CAMBIO-
      // PIN-11092026.md para el contrato exacto.
      await backendFetch(`/admin/solicitudes-pin/${s.id}/aprobar`, { method: 'POST' });
      setDetalle(null);
      cargar();
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'No se pudo aprobar la solicitud.');
    } finally {
      setAprobandoId(null);
    }
  }

  function abrirRechazar(s: SolicitudPin) {
    setRechazando(s);
    setMotivoRechazo('');
    setError('');
  }

  async function confirmarRechazo() {
    if (!rechazando) return;
    setEnviando(true);
    setError('');
    try {
      await backendFetch(`/admin/solicitudes-pin/${rechazando.id}/rechazar`, {
        method: 'POST',
        body: JSON.stringify({ motivo: motivoRechazo.trim() || undefined }),
      });
      setRechazando(null);
      setDetalle(null);
      cargar();
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'No se pudo rechazar la solicitud.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Solicitudes de cambio de ubicación</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Un dueño solicita esto cuando mueve el pin de su propiedad más de lo que el mapa deja mover directamente (evita reubicaciones exageradas sin revisar). Aprobar aplica la nueva ubicación a la propiedad de inmediato.
      </p>

      <div className="w-52 mb-5">
        <Select options={ESTADOS} value={estado} onChange={(e) => { setPage(1); setEstado(e.target.value); }} placeholder="" />
      </div>

      {loading ? (
        <TableSkeleton headers={['Propiedad', 'Solicitante', 'Distancia', 'Motivo', 'Fecha']} />
      ) : noImplementado ? (
        <div className="text-center py-12 text-gray-400 text-sm max-w-md mx-auto">
          <p className="font-medium text-gray-500 mb-1">El backend todavía no expone esta cola</p>
          <p>Ver <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">docs/BACKEND-SOLICITUDES-CAMBIO-PIN-11092026.md</code> — el frontend ya está listo, falta <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">GET /admin/solicitudes-pin</code> del lado del servidor.</p>
        </div>
      ) : errorCarga ? (
        <div className="text-center py-10 text-sm">
          <p className="text-danger mb-3">{errorCarga}</p>
          <Button size="sm" variant="outline" onClick={() => cargar()}>Reintentar</Button>
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Sin solicitudes {estado === 'pendiente' ? 'pendientes' : `en estado "${estado}"`}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Propiedad</th>
                  <th className="text-left px-4 py-3 font-semibold">Solicitante</th>
                  <th className="text-left px-4 py-3 font-semibold">Distancia</th>
                  <th className="text-left px-4 py-3 font-semibold">Motivo</th>
                  <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                  {estado === 'pendiente' && <th className="text-right px-4 py-3 font-semibold">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {solicitudes.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 cursor-pointer max-w-xs truncate" title={s.propiedadTitulo} onClick={() => setDetalle(s)}>
                      <span className="font-medium text-gray-800">{s.propiedadTitulo}</span>
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => setDetalle(s)}>
                      <p className="text-gray-700">{s.user.nombre}</p>
                      <p className="text-xs text-gray-400">{s.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <MapPin size={12} /> {s.distanciaKm.toFixed(1)} km
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={s.motivo ?? ''}>
                      {s.motivo || <span className="text-gray-300">Sin motivo</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatRelativeDate(s.createdAt)}</td>
                    {estado === 'pendiente' && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <a
                            href={`/propiedades/${s.propiedadId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline whitespace-nowrap"
                          >
                            Ver <ArrowUpRight size={11} />
                          </a>
                          <Button size="sm" variant="outline" onClick={() => abrirRechazar(s)}>
                            <XCircle size={12} /> Rechazar
                          </Button>
                          <Button size="sm" variant="primary" isLoading={aprobandoId === s.id} onClick={() => aprobar(s)}>
                            <CheckCircle2 size={12} /> Aprobar
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!noImplementado && !errorCarga && (
        <div className="mt-6">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      <Modal isOpen={!!detalle} onClose={() => setDetalle(null)} title="Detalle de la solicitud">
        {detalle && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Propiedad</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{detalle.propiedadTitulo}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Ubicación actual</p>
                <p className="text-xs font-mono text-gray-600 bg-gray-50 rounded-xl p-3">{detalle.latOriginal.toFixed(5)}, {detalle.lngOriginal.toFixed(5)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Ubicación solicitada</p>
                <p className="text-xs font-mono text-brand bg-brand-pale/40 rounded-xl p-3">{detalle.latSolicitada.toFixed(5)}, {detalle.lngSolicitada.toFixed(5)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">Distancia: <strong>{detalle.distanciaKm.toFixed(1)} km</strong></p>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Motivo del dueño</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{detalle.motivo || 'No especificó ningún motivo.'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Solicitante</p>
              <p className="text-sm text-gray-700">{detalle.user.nombre} — {detalle.user.email}</p>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            {detalle.estado === 'pendiente' && (
              <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
                <Button variant="outline" onClick={() => abrirRechazar(detalle)}>
                  <XCircle size={14} /> Rechazar
                </Button>
                <Button variant="primary" isLoading={aprobandoId === detalle.id} onClick={() => aprobar(detalle)}>
                  <CheckCircle2 size={14} /> Aprobar y reubicar
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!rechazando} onClose={() => setRechazando(null)} title="Rechazar solicitud">
        {rechazando && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Vas a rechazar la solicitud de <strong className="text-gray-800">{rechazando.user.nombre}</strong> para <strong className="text-gray-800">{rechazando.propiedadTitulo}</strong>. Se le avisa por correo.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional, se incluye en el correo)</label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={3}
                placeholder="Ej. La distancia es demasiado grande para verificarla sin más información."
                className="w-full rounded-xl border border-gray-200 text-base sm:text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRechazando(null)}>Cancelar</Button>
              <Button variant="danger" onClick={confirmarRechazo} isLoading={enviando}>Confirmar rechazo</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
