'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Info, Users, UserPlus, Trash2, Mail, ShieldCheck, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { getMiembros, invitarMiembro, eliminarMiembro, type MiembroEquipo, type RolEquipo } from '@/lib/equipoDemo';

const ROL_OPTIONS = [
  { value: 'agente', label: 'Agente' },
  { value: 'admin', label: 'Administrador' },
];

export default function EquipoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([]);
  const [showInvitar, setShowInvitar] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolEquipo>('agente');

  // Mismo criterio que dashboard/citas, dashboard/leads y
  // dashboard/analitica: herramienta profesional, una cuenta buscador no
  // debe verla ni de muestra.
  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!authLoading && user && user.rol === 'buscador') { router.push('/dashboard'); }
  }, [authLoading, user, router]);

  // localStorage solo existe en cliente — se resuelve en un efecto para que
  // el primer render coincida con el del servidor.
  useEffect(() => {
    function aplicar() {
      setMiembros(getMiembros());
    }
    aplicar();
  }, []);

  function handleInvitar() {
    if (!nombre.trim() || !email.trim()) return;
    invitarMiembro(nombre.trim(), email.trim(), rol);
    setMiembros(getMiembros());
    toast.success(`Invitación registrada para ${nombre.trim()}.`);
    setNombre('');
    setEmail('');
    setRol('agente');
    setShowInvitar(false);
  }

  function handleEliminar(id: string, nombreMiembro: string) {
    eliminarMiembro(id);
    setMiembros(getMiembros());
    toast.success(`${nombreMiembro} se quitó del equipo.`);
  }

  if (authLoading || !user || user.rol === 'buscador') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="w-48 mb-8" />
        <Skeleton variant="image" className="w-full h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/perfil" className="text-gray-400 hover:text-brand transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900">Equipo</h1>
            <p className="text-sm text-gray-500">Agentes de tu inmobiliaria</p>
          </div>
        </div>
        <Button type="button" onClick={() => setShowInvitar(true)}>
          <UserPlus size={15} /> Invitar
        </Button>
      </div>

      <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-6">
        <Info size={15} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand-dark leading-relaxed">
          <strong>Vista previa.</strong> No se envían invitaciones reales todavía — cuando exista el backend
          de cuentas de equipo, cada persona podrá iniciar sesión con permisos propios y sus leads/citas se
          atribuirán a ella individualmente.
        </p>
      </div>

      <div className="space-y-3">
        {/* Tú, como dueño de la cuenta — siempre admin, no se puede quitar */}
        {user && (
          <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-full bg-brand-pale flex items-center justify-center flex-shrink-0 font-bold text-brand">
              {user.nombre.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.nombre} <span className="text-xs text-gray-400 font-normal">(tú)</span></p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              <ShieldCheck size={10} /> Admin
            </span>
          </div>
        )}

        {miembros.map((m) => (
          <div key={m.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 font-bold text-gray-500">
              {m.nombre.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{m.nombre}</p>
              <p className="text-xs text-gray-400 truncate">{m.email}</p>
            </div>
            <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border flex-shrink-0 ${
              m.estado === 'invitado' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {m.estado === 'invitado' ? <Clock size={10} /> : <ShieldCheck size={10} />}
              {m.estado === 'invitado' ? 'Invitado' : (m.rol === 'admin' ? 'Admin' : 'Agente')}
            </span>
            <button
              type="button"
              onClick={() => handleEliminar(m.id, m.nombre)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {miembros.length === 0 && (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
            <Users size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Todavía no has invitado a nadie más a tu equipo.</p>
          </div>
        )}
      </div>

      <Modal isOpen={showInvitar} onClose={() => setShowInvitar(false)} title="Invitar a tu equipo" maxWidth="sm">
        <div className="space-y-4 mb-5">
          <Input label="Nombre" placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input label="Correo" type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select label="Rol" options={ROL_OPTIONS} value={rol} onChange={(e) => setRol(e.target.value as RolEquipo)} />
        </div>
        <p className="flex items-start gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-xl p-3 mb-5">
          <Mail size={13} className="flex-shrink-0 mt-0.5" />
          No se envía ningún correo real — esta persona no podrá iniciar sesión todavía.
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={() => setShowInvitar(false)} className="flex-1 justify-center">
            Cancelar
          </Button>
          <Button type="button" variant="primary" onClick={handleInvitar} disabled={!nombre.trim() || !email.trim()} className="flex-1 justify-center">
            Invitar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
