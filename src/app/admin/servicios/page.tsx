'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, CheckCircle2, Ban } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatRelativeDate } from '@/lib/format';

interface Servicio {
  id: string;
  categoria: string;
  nombre: string;
  municipio: string;
  colonia: string | null;
  activo: boolean;
  createdAt: string;
  user: { email: string; nombre: string };
}

export default function AdminServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState<Servicio | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/servicios', { cache: 'no-store' });
    const data = await res.json();
    setServicios(data.servicios ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { function cargarInicial() { cargar(); } cargarInicial(); }, [cargar]);

  async function toggle() {
    if (!confirmar) return;
    setEnviando(true);
    await fetch(`/api/admin/servicios/${confirmar.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !confirmar.activo }),
    });
    setEnviando(false);
    setConfirmar(null);
    cargar();
  }

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Servicios</h1>
      <p className="text-gray-500 text-sm mb-6">Directorio de proveedores (plomería, pintura, mudanza, etc.) — pausar oculta el servicio del catálogo público.</p>

      {loading ? (
        <div className="text-center py-10 text-gray-400"><Loader2 className="animate-spin inline" size={20} /></div>
      ) : servicios.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Sin servicios publicados</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Servicio</th>
                  <th className="text-left px-4 py-3 font-semibold">Proveedor</th>
                  <th className="text-left px-4 py-3 font-semibold">Zona</th>
                  <th className="text-left px-4 py-3 font-semibold">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {servicios.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{s.nombre}</p>
                      <p className="text-xs text-gray-400">{s.categoria} · {formatRelativeDate(s.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <p>{s.user.nombre}</p>
                      <p className="text-xs text-gray-400">{s.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.municipio}{s.colonia ? `, ${s.colonia}` : ''}</td>
                    <td className="px-4 py-3">
                      {s.activo ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={11} /> Activo</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"><Ban size={11} /> Pausado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant={s.activo ? 'danger' : 'outline'} onClick={() => setConfirmar(s)}>
                        {s.activo ? 'Pausar' : 'Reactivar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!confirmar}
        onClose={() => setConfirmar(null)}
        title={confirmar?.activo ? 'Pausar servicio' : 'Reactivar servicio'}
      >
        {confirmar && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {confirmar.activo
                ? 'Vas a pausar el servicio'
                : 'Vas a reactivar el servicio'}{' '}
              <strong className="text-gray-800">{confirmar.nombre}</strong> de {confirmar.user.nombre} ({confirmar.user.email}).
              {confirmar.activo && ' Dejará de verse en el catálogo público hasta que lo reactives.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmar(null)}>Cancelar</Button>
              <Button variant={confirmar.activo ? 'danger' : 'primary'} onClick={toggle} isLoading={enviando}>
                {confirmar.activo ? 'Confirmar pausa' : 'Confirmar reactivación'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
