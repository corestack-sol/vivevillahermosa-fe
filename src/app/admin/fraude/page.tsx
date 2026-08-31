'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, CheckCircle2, MapPinOff, PhoneMissed, ArrowUpRight } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { formatRelativeDate } from '@/lib/format';
import { backendFetch, BackendApiError } from '@/lib/backendApi';
import { useAuth } from '@/context/AuthContext';

/**
 * Cola de "posibles fraudes" (pedido explícito 2026-08-31) — usuarios cuyos
 * anuncios el backend clasificó como riesgo medio/alto, o que el backend
 * bloqueó directamente. Backend pendiente de construir, ver
 * docs/BACKEND-FRAUDE-NIVELES-31082026.md — este endpoint todavía no existe,
 * la página muestra un estado vacío honesto en vez de tronar mientras tanto
 * (mismo criterio que el resto del panel admin).
 *
 * `intentosMismoUsuario` — reincidencia (punto 4 de la propuesta): cuántas
 * veces esta MISMA cuenta ha aparecido aquí, sin importar si reescribió el
 * texto entre intentos. Viene precalculado del backend a propósito — hacerlo
 * bien (contar sobre TODO el historial, no solo la página actual) necesita
 * la base de datos completa, no los ~20 registros que trae esta pantalla.
 */
interface IntentoFraude {
  id: string;
  userId: string;
  propiedadId: string | null;
  titulo: string;
  riesgo: 'medio' | 'alto';
  bloqueado: boolean;
  motivoBloqueo: string | null;
  señales: string[];
  exifDistanciaKm: number | null;
  contactoReutilizado: number;
  createdAt: string;
  intentosMismoUsuario: number;
  user: { id: string; email: string; nombre: string; bloqueado: boolean };
}

const RIESGOS = [
  { value: '', label: 'Medio y alto' },
  { value: 'alto', label: 'Solo alto' },
  { value: 'medio', label: 'Solo medio' },
];

export default function AdminFraudePage() {
  const { user: currentUser } = useAuth();
  const [intentos, setIntentos] = useState<IntentoFraude[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [riesgo, setRiesgo] = useState('');
  const [loading, setLoading] = useState(true);
  const [noImplementado, setNoImplementado] = useState(false);
  const [detalle, setDetalle] = useState<IntentoFraude | null>(null);
  const [bloqueando, setBloqueando] = useState<IntentoFraude | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setNoImplementado(false);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (riesgo) params.set('riesgo', riesgo);
      const data = await backendFetch<{
        intentos: IntentoFraude[];
        total: number;
        page: number;
        perPage: number;
      }>(`/admin/intentos-fraude?${params}`);
      setIntentos(data.intentos ?? []);
      setTotal(data.total ?? 0);
      setPerPage(data.perPage ?? 30);
    } catch (err) {
      // 404 = el endpoint todavía no existe del lado del backend — estado
      // honesto, no un error real de la persona usando el panel.
      if (err instanceof BackendApiError && err.status === 404) {
        setNoImplementado(true);
      }
      setIntentos([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, riesgo]);

  useEffect(() => { function cargarInicial() { cargar(); } cargarInicial(); }, [cargar]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  function abrirBloquear(i: IntentoFraude) {
    setBloqueando(i);
    setMotivo(`Reincidencia en posible fraude (${i.intentosMismoUsuario} intento${i.intentosMismoUsuario !== 1 ? 's' : ''} nivel medio/alto)`);
    setError('');
  }

  async function confirmarBloqueo() {
    if (!bloqueando) return;
    if (motivo.trim().length < 5) { setError('Escribe un motivo de al menos 5 caracteres'); return; }
    setEnviando(true);
    setError('');
    try {
      // Reusa el mismo endpoint que /admin/usuarios — no hace falta uno
      // nuevo solo para bloquear desde aquí.
      await backendFetch(`/admin/usuarios/${bloqueando.user.id}/bloquear`, {
        method: 'POST',
        body: JSON.stringify({ motivo }),
      });
      setBloqueando(null);
      cargar();
    } catch (err) {
      setError(err instanceof BackendApiError ? err.message : 'Ocurrió un error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Posibles fraudes</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Anuncios que el análisis automático clasificó como riesgo medio o alto, con las señales que no dependen solo del texto (GPS de foto que no coincide, mismo contacto reutilizado, reincidencia de la cuenta) — reescribir el título no las borra. Nivel alto ya bloquea publicar; esto es la cola de revisión, no un reemplazo de esa barrera.
      </p>

      <div className="w-52 mb-5">
        <Select options={RIESGOS} value={riesgo} onChange={(e) => { setPage(1); setRiesgo(e.target.value); }} placeholder="" />
      </div>

      {loading ? (
        <TableSkeleton headers={['Usuario', 'Anuncio', 'Riesgo', 'Señales adicionales', 'Reincidencia', 'Fecha']} />
      ) : noImplementado ? (
        <div className="text-center py-12 text-gray-400 text-sm max-w-md mx-auto">
          <p className="font-medium text-gray-500 mb-1">El backend todavía no expone esta cola</p>
          <p>Ver <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">docs/BACKEND-FRAUDE-NIVELES-31082026.md</code> — el frontend ya está listo, falta <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">GET /admin/intentos-fraude</code> del lado del servidor.</p>
        </div>
      ) : intentos.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Sin anuncios marcados</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Usuario</th>
                  <th className="text-left px-4 py-3 font-semibold">Anuncio</th>
                  <th className="text-left px-4 py-3 font-semibold">Riesgo</th>
                  <th className="text-left px-4 py-3 font-semibold">Señales adicionales</th>
                  <th className="text-left px-4 py-3 font-semibold">Reincidencia</th>
                  <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                  <th className="text-right px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {intentos.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 cursor-pointer" onClick={() => setDetalle(i)}>
                      <p className="font-medium text-gray-800">{i.user.nombre}</p>
                      <p className="text-xs text-gray-400">{i.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate cursor-pointer" title={i.titulo} onClick={() => setDetalle(i)}>
                      {i.titulo}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        i.riesgo === 'alto' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50'
                      }`}>
                        {i.bloqueado ? 'Bloqueado' : i.riesgo === 'alto' ? 'Alto' : 'Medio'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {i.exifDistanciaKm !== null && (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-600" title={`GPS de foto a ${i.exifDistanciaKm}km de la colonia declarada`}>
                            <MapPinOff size={13} /> {i.exifDistanciaKm}km
                          </span>
                        )}
                        {i.contactoReutilizado > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-purple-600" title={`Mismo contacto en ${i.contactoReutilizado} propiedades más`}>
                            <PhoneMissed size={13} /> {i.contactoReutilizado}
                          </span>
                        )}
                        {i.exifDistanciaKm === null && i.contactoReutilizado === 0 && (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {i.intentosMismoUsuario > 1 ? (
                        <span className="text-xs font-semibold text-red-600">{i.intentosMismoUsuario}x</span>
                      ) : (
                        <span className="text-xs text-gray-400">1ra vez</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatRelativeDate(i.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {i.propiedadId && (
                          <a
                            href={`/propiedades/${i.propiedadId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline whitespace-nowrap"
                          >
                            Ver <ArrowUpRight size={11} />
                          </a>
                        )}
                        {i.user.bloqueado ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400"><CheckCircle2 size={11} /> Ya bloqueado</span>
                        ) : (
                          <Button size="sm" variant="danger" onClick={() => abrirBloquear(i)}>
                            <Ban size={12} /> Bloquear
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!noImplementado && (
        <div className="mt-6">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      <Modal isOpen={!!detalle} onClose={() => setDetalle(null)} title="Detalle del anuncio marcado">
        {detalle && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Título</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{detalle.titulo}</p>
            </div>
            {detalle.motivoBloqueo && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Motivo del bloqueo</p>
                <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{detalle.motivoBloqueo}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Señales de texto detectadas</p>
              {detalle.señales.length > 0 ? (
                <ul className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 list-disc list-inside space-y-0.5">
                  {detalle.señales.map((s) => <li key={s}>{s}</li>)}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Ninguna — el texto solo pasó por las señales independientes de abajo.</p>
              )}
            </div>
            {(detalle.exifDistanciaKm !== null || detalle.contactoReutilizado > 0) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Señales independientes del texto</p>
                <ul className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 space-y-1">
                  {detalle.exifDistanciaKm !== null && (
                    <li className="flex items-center gap-1.5"><MapPinOff size={14} className="text-orange-500" /> GPS de una foto a {detalle.exifDistanciaKm}km de la colonia declarada</li>
                  )}
                  {detalle.contactoReutilizado > 0 && (
                    <li className="flex items-center gap-1.5"><PhoneMissed size={14} className="text-purple-500" /> Mismo teléfono/WhatsApp en {detalle.contactoReutilizado} propiedad{detalle.contactoReutilizado !== 1 ? 'es' : ''} más</li>
                  )}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Reincidencia de la cuenta</p>
              <p className="text-sm text-gray-700">
                {detalle.intentosMismoUsuario} intento{detalle.intentosMismoUsuario !== 1 ? 's' : ''} nivel medio/alto en total — incluye anuncios reescritos después de un aviso previo.
              </p>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!bloqueando} onClose={() => setBloqueando(null)} title="Bloquear cuenta">
        {bloqueando && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Vas a bloquear la cuenta de <strong className="text-gray-800">{bloqueando.user.nombre}</strong> ({bloqueando.user.email}).
            </p>
            {bloqueando.user.id === currentUser?.userId && (
              <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3">Esta es tu propia cuenta — perderías acceso de inmediato.</p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (visible para el equipo)</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-gray-200 text-base sm:text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBloqueando(null)}>Cancelar</Button>
              <Button variant="danger" onClick={confirmarBloqueo} isLoading={enviando}>Confirmar bloqueo</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
