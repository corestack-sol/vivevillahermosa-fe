'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ShieldCheck, ShieldOff, Ban, CheckCircle2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { formatRelativeDate } from '@/lib/format';

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  esAdmin: boolean;
  bloqueado: boolean;
  bloqueadoMotivo: string | null;
  bloqueadoEn: string | null;
  createdAt: string;
}

type Accion = 'bloquear' | 'desbloquear' | 'promover' | 'revocar-admin';

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [soloBloqueados, setSoloBloqueados] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ accion: Accion; usuario: Usuario } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const perPage = 20;

  const cargar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q.trim()) params.set('q', q.trim());
    if (soloBloqueados) params.set('bloqueados', '1');
    const res = await fetch(`/api/admin/usuarios?${params}`, { cache: 'no-store' });
    const data = await res.json();
    setUsuarios(data.usuarios ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, q, soloBloqueados]);

  useEffect(() => { function cargarInicial() { cargar(); } cargarInicial(); }, [cargar]);

  function abrirModal(accion: Accion, usuario: Usuario) {
    setModal({ accion, usuario });
    setMotivo('');
    setError('');
  }

  async function confirmar() {
    if (!modal) return;
    if (modal.accion === 'bloquear' && motivo.trim().length < 5) {
      setError('Escribe un motivo de al menos 5 caracteres');
      return;
    }
    setEnviando(true);
    setError('');
    const res = await fetch(`/api/admin/usuarios/${modal.usuario.id}/${modal.accion}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: modal.accion === 'bloquear' ? JSON.stringify({ motivo }) : undefined,
    });
    setEnviando(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Ocurrió un error');
      return;
    }
    setModal(null);
    cargar();
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Usuarios</h1>
      <p className="text-gray-500 text-sm mb-6">{total} cuenta{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}</p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex-1 min-w-[240px]">
          <Input
            icon={<Search size={15} />}
            placeholder="Buscar por email o nombre..."
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
          <input type="checkbox" checked={soloBloqueados} onChange={(e) => { setPage(1); setSoloBloqueados(e.target.checked); }} />
          Solo bloqueados
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Usuario</th>
                <th className="text-left px-4 py-3 font-semibold">Rol</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="text-left px-4 py-3 font-semibold">Registrado</th>
                <th className="text-right px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400"><Loader2 className="animate-spin inline" size={18} /></td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Sin resultados</td></tr>
              ) : usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{u.nombre}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.rol}{u.esAdmin && <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><ShieldCheck size={12} /> admin</span>}</td>
                  <td className="px-4 py-3">
                    {u.bloqueado ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full" title={u.bloqueadoMotivo ?? undefined}>
                        <Ban size={11} /> Bloqueado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={11} /> Activo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatRelativeDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {u.bloqueado ? (
                        <Button size="sm" variant="outline" onClick={() => abrirModal('desbloquear', u)}>Desbloquear</Button>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => abrirModal('bloquear', u)}>Bloquear</Button>
                      )}
                      {u.esAdmin ? (
                        <Button size="sm" variant="ghost" onClick={() => abrirModal('revocar-admin', u)}>
                          <ShieldOff size={13} /> Revocar admin
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => abrirModal('promover', u)}>
                          <ShieldCheck size={13} /> Hacer admin
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

      <div className="mt-6">
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={tituloModal(modal?.accion)}>
        {modal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {mensajeModal(modal.accion)} <strong className="text-gray-800">{modal.usuario.nombre}</strong> ({modal.usuario.email}).
            </p>
            {modal.accion === 'bloquear' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (visible para el equipo, no se envía tal cual al usuario)</label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 text-base sm:text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                  placeholder="Ej. Publicó el mismo anuncio con 3 precios distintos en menos de una hora"
                />
              </div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
              <Button variant={modal.accion === 'bloquear' ? 'danger' : 'primary'} onClick={confirmar} isLoading={enviando}>
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function tituloModal(accion?: Accion) {
  switch (accion) {
    case 'bloquear': return 'Bloquear cuenta';
    case 'desbloquear': return 'Desbloquear cuenta';
    case 'promover': return 'Dar permisos de administrador';
    case 'revocar-admin': return 'Revocar permisos de administrador';
    default: return undefined;
  }
}

function mensajeModal(accion: Accion) {
  switch (accion) {
    case 'bloquear': return 'Vas a bloquear la cuenta de';
    case 'desbloquear': return 'Vas a desbloquear la cuenta de';
    case 'promover': return 'Vas a dar acceso completo al panel de administración a';
    case 'revocar-admin': return 'Vas a quitar el acceso al panel de administración a';
  }
}
