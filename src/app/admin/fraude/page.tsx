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
 * bloqueó directamente. `GET /admin/intentos-fraude` es real (confirmado
 * en vivo esta sesión); `noImplementado` de abajo queda como defensa por
 * si acaso, no como estado esperado.
 *
 * `intentosMismoUsuario` — reincidencia (punto 4 de la propuesta): cuántas
 * veces esta MISMA cuenta ha aparecido aquí, sin importar si reescribió el
 * texto entre intentos. Viene precalculado del backend a propósito — hacerlo
 * bien (contar sobre TODO el historial, no solo la página actual) necesita
 * la base de datos completa, no los ~20 registros que trae esta pantalla.
 * Confirmado 2026-09-11: ya excluye del lado del servidor los intentos con
 * `resueltoEn` (un falso positivo aprobado no cuenta como reincidencia).
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
  // Confirmado por el backend 2026-09-11 junto con el endpoint de abajo —
  // `intentosMismoUsuario` ya excluye del lado del servidor los intentos
  // con `resueltoEn` distinto de null (un falso positivo aprobado deja de
  // contar como reincidencia).
  resueltoEn: string | null;
  resueltoPor: { id: string; nombre: string; email: string } | null;
}

const RIESGOS = [
  { value: '', label: 'Medio y alto' },
  { value: 'alto', label: 'Solo alto' },
  { value: 'medio', label: 'Solo medio' },
];

const ESTADOS = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'resuelto', label: 'Resueltos' },
  { value: '', label: 'Todos' },
];

export default function AdminFraudePage() {
  const { user: currentUser } = useAuth();
  const [intentos, setIntentos] = useState<IntentoFraude[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [riesgo, setRiesgo] = useState('');
  const [estado, setEstado] = useState('pendiente');
  const [loading, setLoading] = useState(true);
  const [noImplementado, setNoImplementado] = useState(false);
  const [detalle, setDetalle] = useState<IntentoFraude | null>(null);
  const [bloqueando, setBloqueando] = useState<IntentoFraude | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // Quitar marca de revisión — pedido explícito 2026-09-11: junto con
  // ocultar las señales exactas de quien publica (PublishForm.tsx) y del
  // público (FraudAlertBadge.tsx), hacía falta un camino real para que
  // alguien marcado por error (falso positivo — el análisis de IA puede
  // equivocarse) recupere su anuncio sin depender de reescribirlo a
  // ciegas. Backend implementado el mismo día
  // (docs/BACKEND-APROBAR-REVISION-FRAUDE-11092026.md) — de paso reveló y
  // corrigió que riesgo "medio" nunca había estado marcando `alertaFraude`
  // desde el 31 de agosto (riesgo "alto" siempre rechazó con 400 sin
  // guardar nada, así que "medio" es el único caso real que llega aquí).
  const [aprobando, setAprobando] = useState<IntentoFraude | null>(null);
  const [motivoAprobar, setMotivoAprobar] = useState('');
  const [enviandoAprobar, setEnviandoAprobar] = useState(false);
  const [errorAprobar, setErrorAprobar] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setNoImplementado(false);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (riesgo) params.set('riesgo', riesgo);
      // Filtro aditivo confirmado por el backend 2026-09-11 — sin mandarlo
      // trae todo (pendientes + resueltos mezclados), por eso el default
      // de este panel es 'pendiente' explícito.
      if (estado) params.set('estado', estado);
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
      // 404 ya no debería pasar (confirmado implementado 2026-09-11), pero
      // se deja el mismo manejo honesto por si el filtro `estado` mismo
      // llegara a no existir en algún ambiente — cualquier otro código
      // (401/403/500) sí es un error real y debe propagarse.
      if (err instanceof BackendApiError && err.status === 404) {
        setNoImplementado(true);
        setIntentos([]);
        setTotal(0);
        return;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [page, riesgo, estado]);

  useEffect(() => { function cargarInicial() { cargar(); } cargarInicial(); }, [cargar]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  function abrirBloquear(i: IntentoFraude) {
    setBloqueando(i);
    setMotivo(`Reincidencia en posible fraude (${i.intentosMismoUsuario} intento${i.intentosMismoUsuario !== 1 ? 's' : ''} nivel medio/alto)`);
    setError('');
  }

  function abrirAprobar(i: IntentoFraude) {
    setAprobando(i);
    setMotivoAprobar('');
    setErrorAprobar('');
  }

  async function confirmarAprobar() {
    if (!aprobando || !aprobando.propiedadId) return;
    setEnviandoAprobar(true);
    setErrorAprobar('');
    try {
      // POST /admin/propiedades/:id/aprobar-revision — implementado por el
      // backend 2026-09-11 (docs/BACKEND-APROBAR-REVISION-FRAUDE-
      // 11092026.md). `motivo` es opcional del lado del backend; solo se
      // manda si de verdad se escribió algo.
      await backendFetch(`/admin/propiedades/${aprobando.propiedadId}/aprobar-revision`, {
        method: 'POST',
        body: JSON.stringify({ motivo: motivoAprobar.trim() || undefined }),
      });
      setAprobando(null);
      cargar();
    } catch (err) {
      // 409 = la propiedad no tiene ninguna marca de fraude que quitar
      // (ya se aprobó antes, o nunca tuvo una) — confirmado por el backend,
      // mensaje propio en vez del genérico de BackendApiError.
      if (err instanceof BackendApiError && err.status === 409) {
        setErrorAprobar('Esta propiedad ya no tiene ninguna marca de fraude que quitar — puede que ya se haya aprobado, o que la reescritura del dueño la haya limpiado sola.');
        return;
      }
      setErrorAprobar(err instanceof BackendApiError ? err.message : 'Ocurrió un error');
    } finally {
      setEnviandoAprobar(false);
    }
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

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="w-52">
          <Select options={ESTADOS} value={estado} onChange={(e) => { setPage(1); setEstado(e.target.value); }} placeholder="" />
        </div>
        <div className="w-52">
          <Select options={RIESGOS} value={riesgo} onChange={(e) => { setPage(1); setRiesgo(e.target.value); }} placeholder="" />
        </div>
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
                        {i.resueltoEn ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600" title={i.resueltoPor ? `Por ${i.resueltoPor.nombre}` : undefined}>
                            <CheckCircle2 size={11} /> Resuelto {formatRelativeDate(i.resueltoEn)}
                          </span>
                        ) : i.propiedadId && (
                          <Button size="sm" variant="outline" onClick={() => abrirAprobar(i)}>
                            <CheckCircle2 size={12} /> Quitar marca
                          </Button>
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
            {detalle.resueltoEn ? (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600 pt-1 border-t border-gray-100">
                <CheckCircle2 size={14} /> Resuelto {formatRelativeDate(detalle.resueltoEn)}{detalle.resueltoPor ? ` por ${detalle.resueltoPor.nombre}` : ''}
              </p>
            ) : detalle.propiedadId && (
              <div className="flex justify-end pt-1 border-t border-gray-100">
                <Button size="sm" variant="outline" onClick={() => { const d = detalle; setDetalle(null); abrirAprobar(d); }}>
                  <CheckCircle2 size={12} /> Quitar marca de revisión
                </Button>
              </div>
            )}
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

      <Modal isOpen={!!aprobando} onClose={() => setAprobando(null)} title="Quitar marca de revisión">
        {aprobando && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Vas a quitar el aviso &quot;En revisión&quot; del anuncio <strong className="text-gray-800">{aprobando.titulo}</strong>. Úsalo cuando ya verificaste que la propiedad es real y las señales detectadas no aplican — un falso positivo.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional, visible para el equipo)</label>
              <textarea
                value={motivoAprobar}
                onChange={(e) => setMotivoAprobar(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ej. Verifiqué la propiedad por teléfono, es real."
                className="w-full rounded-xl border border-gray-200 text-base sm:text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
            </div>
            {errorAprobar && <p className="text-sm text-danger">{errorAprobar}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAprobando(null)}>Cancelar</Button>
              <Button variant="primary" onClick={confirmarAprobar} isLoading={enviandoAprobar}>Quitar marca</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
