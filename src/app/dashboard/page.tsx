'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Bell, Plus, Eye, TrendingUp, Home, LayoutDashboard, Lightbulb, MessageCircle, Building2, Download, CalendarDays, Users, Loader2, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { getMisPropiedadesDemo } from '@/lib/misPropiedadesDemo';
import { generarReporteDesempeno } from '@/lib/reportePdf';
import { obtenerResumenReporte } from '@/lib/aiClient';
import { usePerfilInmobiliaria } from '@/hooks/usePerfilInmobiliaria';
import type { Notificacion } from '@/components/layout/NotificationBell';
import { formatRelativeDate } from '@/lib/format';

const ROL_LABEL: Record<string, string> = {
  buscador: 'Buscador',
  propietario: 'Propietario',
  agente: 'Agente / Inmobiliaria',
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [favCount, setFavCount] = useState(0);
  const [alertaCount, setAlertaCount] = useState(0);
  const [vistasCount, setVistasCount] = useState(0);
  const [contactosCount, setContactosCount] = useState(0);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [generandoReporte, setGenerandoReporte] = useState(false);
  const perfil = usePerfilInmobiliaria(!!user && user.rol !== 'buscador');

  useEffect(() => {
    if (!loading && !user) { router.push('/auth/login'); return; }
    if (!user) return;
    Promise.all([
      fetch('/api/favoritos').then((r) => r.json()),
      fetch('/api/alertas').then((r) => r.json()),
      fetch('/api/me/stats').then((r) => r.json()),
      fetch('/api/notificaciones').then((r) => r.json()),
    ]).then(([favData, alertData, statsData, notifData]) => {
      setFavCount(favData.favoritos?.length ?? 0);
      setAlertaCount(alertData.alertas?.length ?? 0);
      setVistasCount(statsData.vistas ?? 0);
      setContactosCount(statsData.contactos ?? 0);
      setNotificaciones(notifData.notificaciones ?? []);
    }).catch(() => {});
  }, [user, loading, router]);

  async function marcarNotificacionesLeidas() {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    try {
      await fetch('/api/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch { /* estado optimista ya aplicado */ }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-start justify-between mb-8">
          <div className="space-y-2">
            <Skeleton className="w-40" />
            <Skeleton className="w-56" />
          </div>
          <Skeleton variant="image" className="w-40 h-10 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
              <Skeleton variant="circle" className="w-10 h-10 mb-3" />
              <Skeleton variant="image" className="w-12 h-7 mb-1.5" />
              <Skeleton className="w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!user) return null;

  // Propietarios/agentes gestionan una cartera de propiedades — les importan
  // sus propias publicaciones, no cuántas vio como comprador. Buscadores ven
  // las 4 métricas originales; el resto ve las suyas (hoy con datos de
  // muestra, ver src/lib/misPropiedadesDemo.ts).
  const esProfesional = user.rol !== 'buscador';
  const misPropiedades = esProfesional ? getMisPropiedadesDemo() : [];

  const stats = esProfesional
    ? [
        { icon: Building2, label: 'Propiedades publicadas', value: misPropiedades.length, href: '/dashboard/propiedades', color: 'text-brand', bg: 'bg-brand-pale' },
        { icon: Eye, label: 'Vistas totales', value: misPropiedades.reduce((s, p) => s + p.vistas, 0), href: '/dashboard/propiedades', color: 'text-blue-500', bg: 'bg-blue-50' },
        { icon: MessageCircle, label: 'Contactos recibidos', value: misPropiedades.reduce((s, p) => s + p.contactos, 0), href: '/dashboard/propiedades', color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { icon: Heart, label: 'Favoritos guardados', value: favCount, href: '/favoritos', color: 'text-red-500', bg: 'bg-red-50' },
      ]
    : [
        { icon: Heart, label: 'Favoritos guardados', value: favCount, href: '/favoritos', color: 'text-red-500', bg: 'bg-red-50' },
        { icon: Bell, label: 'Alertas activas', value: alertaCount, href: '/alertas', color: 'text-amber-500', bg: 'bg-amber-50' },
        { icon: Eye, label: 'Propiedades vistas', value: vistasCount, href: '/propiedades', color: 'text-blue-500', bg: 'bg-blue-50' },
        { icon: TrendingUp, label: 'Contactos enviados', value: contactosCount, href: '/propiedades', color: 'text-brand', bg: 'bg-brand-pale' },
      ];

  async function descargarReporte() {
    if (!user) return;
    setGenerandoReporte(true);
    const resumenIA = await obtenerResumenReporte(misPropiedades);
    setGenerandoReporte(false);
    generarReporteDesempeno({
      nombreCuenta: user.nombre,
      propiedades: misPropiedades,
      nombreEmpresa: perfil?.nombreEmpresa,
      logoDataUrl: perfil?.logoDataUrl,
      resumenIA,
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard size={20} className="text-brand" />
            <h1 className="text-2xl font-heading font-bold text-gray-900">Mi panel</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Hola, <strong className="text-gray-700">{user.nombre.split(' ')[0]}</strong> ·{' '}
            <span className="text-brand">{ROL_LABEL[user.rol]}</span>
          </p>
        </div>
        <Link href="/publicar"
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={15} /> Publicar propiedad
        </Link>
      </div>

      {/* Notificaciones recientes */}
      {notificaciones.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 mb-8 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Bell size={15} className="text-amber-500" /> Notificaciones recientes
            </p>
            {notificaciones.some((n) => !n.leida) && (
              <button onClick={marcarNotificacionesLeidas} className="text-xs text-brand font-semibold hover:underline">
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {notificaciones.slice(0, 5).map((n) => (
              <div key={n.id} className={`flex items-start gap-3 px-5 py-3.5 ${!n.leida ? 'bg-brand-pale/20' : ''}`}>
                {!n.leida && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />}
                <div className={`min-w-0 ${n.leida ? 'ml-[18px]' : ''}`}>
                  <p className="text-sm font-medium text-gray-800 leading-snug">{n.titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.mensaje}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{formatRelativeDate(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aviso de datos de muestra — mismo criterio que /dashboard/analitica,
          /dashboard/leads y /dashboard/propiedades (ver misPropiedadesDemo.ts
          y GET /api/me/stats): "Vistas"/"Contactos" de aquí abajo todavía no
          cuentan nada real, sin esto era la única pantalla del panel que
          mostraba estos números sin ninguna advertencia. */}
      <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-6">
        <Info size={15} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand-dark leading-relaxed">
          <strong>Vista previa con datos de muestra.</strong> Vistas y contactos todavía no cuentan actividad
          real — cuando exista una tabla de eventos con fecha (Fase 2), estos números reflejarán tu
          desempeño de verdad.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}
            className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-brand/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon size={20} className={s.color} />
            </div>
            <p className="text-2xl font-display font-black text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <Link href="/favoritos"
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 hover:border-brand/30 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Heart size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Ver mis favoritos</p>
            <p className="text-xs text-gray-500">{favCount} guardada{favCount !== 1 ? 's' : ''}</p>
          </div>
        </Link>
        <Link href="/alertas"
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 hover:border-brand/30 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bell size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Mis alertas</p>
            <p className="text-xs text-gray-500">{alertaCount > 0 ? `${alertaCount} activa${alertaCount > 1 ? 's' : ''}` : 'Ninguna configurada'}</p>
          </div>
        </Link>
        {esProfesional ? (
          <>
            <Link href="/dashboard/propiedades"
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 hover:border-brand/30 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
              <div className="w-10 h-10 bg-brand-pale rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-brand" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Mis propiedades</p>
                <p className="text-xs text-gray-500">{misPropiedades.length} publicada{misPropiedades.length !== 1 ? 's' : ''}</p>
              </div>
            </Link>
            <Link href="/dashboard/citas"
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 hover:border-brand/30 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
              <div className="w-10 h-10 bg-brand-pale rounded-xl flex items-center justify-center flex-shrink-0">
                <CalendarDays size={18} className="text-brand" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Mi agenda</p>
                <p className="text-xs text-gray-500">Citas con clientes</p>
              </div>
            </Link>
            <Link href="/dashboard/leads"
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 hover:border-brand/30 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
              <div className="w-10 h-10 bg-brand-pale rounded-xl flex items-center justify-center flex-shrink-0">
                <Users size={18} className="text-brand" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Leads</p>
                <p className="text-xs text-gray-500">Da seguimiento a interesados</p>
              </div>
            </Link>
          </>
        ) : (
          <Link href="/propiedades"
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 hover:border-brand/30 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
            <div className="w-10 h-10 bg-brand-pale rounded-xl flex items-center justify-center flex-shrink-0">
              <Home size={18} className="text-brand" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Explorar propiedades</p>
              <p className="text-xs text-gray-500">Todo Tabasco</p>
            </div>
          </Link>
        )}
      </div>

      {/* Tip */}
      {esProfesional ? (
        <div className="bg-brand-pale rounded-2xl p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-dark mb-1">
            <Lightbulb size={16} className="flex-shrink-0" />
            Las propiedades con fotos reciben más contactos
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Revisa tus publicaciones activas y asegúrate de que cada una tenga fotos, precio actualizado y buena descripción — así conviertes más vistas en contactos reales.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/propiedades" className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-dark transition-colors">
              <Building2 size={14} /> Ver mis propiedades
            </Link>
            <button
              type="button"
              onClick={descargarReporte}
              disabled={misPropiedades.length === 0 || generandoReporte}
              className="inline-flex items-center gap-2 bg-white border-2 border-brand/20 text-brand text-sm font-semibold px-4 py-2 rounded-xl hover:border-brand/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generandoReporte ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {generandoReporte ? 'Generando...' : 'Descargar reporte'}
            </button>
          </div>
          {perfil && !perfil.logoDataUrl && (
            <p className="text-xs text-brand-dark/70 mt-3">
              Tip: agrega el logo de tu inmobiliaria en tu{' '}
              <Link href="/dashboard/perfil" className="font-semibold underline hover:text-brand-dark">perfil</Link>
              {' '}para que aparezca en tus reportes.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-brand-pale rounded-2xl p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-dark mb-1">
            <Lightbulb size={16} className="flex-shrink-0" />
            Configura una alerta y no pierdas ninguna propiedad
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Recibe un aviso cuando se publique una propiedad que cumpla con tus criterios — municipio, precio, tipo y zona de inundación.
          </p>
          <Link href="/alertas" className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-dark transition-colors">
            <Bell size={14} /> Crear alerta
          </Link>
        </div>
      )}
    </div>
  );
}
