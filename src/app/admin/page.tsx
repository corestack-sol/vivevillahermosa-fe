import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users, FileWarning, FlagTriangleRight, Heart, Bell, CalendarDays, Wrench, Ban, Mail, Cpu, Eye, Home, ShieldX } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { backendFetchServer } from '@/lib/backendApiServer';

interface MetricasBackend {
  usuarios: { total: number; bloqueados: number };
  propiedades: { total: number; activas: number; pausadas: number };
  solicitudesRevision: { total: number; pendientes: number };
  reportes: { total: number; pendientes: number };
  intentosSospechosos: number;
  // Pendiente del backend (docs/BACKEND-FRAUDE-NIVELES-31082026.md) —
  // opcional a propósito: la tarjeta de abajo se oculta sola mientras no
  // exista, en vez de mostrar un 0 falso.
  intentosFraude?: number;
  favoritos: number;
  alertas: number;
  citas: number;
  servicios: number;
  integraciones: { resend: boolean; openRouter: boolean; gemini: boolean };
}

// GET /admin/metricas (BACKEND.md §16) ya viene completo del backend real —
// `servicios` se agregó ahí el 2026-08-13 (antes se consultaba con Prisma
// local, huérfana). Sin tile de "Admins activos" — el backend no expone ese
// conteo en /admin/metricas y no vale la pena un fetch aparte solo por esa
// cifra.
//
// 2026-08-11: la tarjeta "Buscador con IA" (cache hits, llamadas reales a
// OpenRouter, horas pico) se quitó de aquí al migrar /ia/busqueda-inteligente
// al backend nuevo — ese contador vivía en memoria de este mismo proceso
// (src/lib/busquedaStats.ts, ya borrado) y solo se alimentaba de las
// llamadas que pasaban por la ruta local de Next.js. Dejarla tal cual habría
// mostrado cifras congeladas para siempre como si fueran reales — mismo
// criterio que ya aplica en toda la plataforma (nunca un dato fabricado o
// stale presentado como medido). BACKEND.md §8 documenta que esta
// observabilidad (cache hits/heurística/porHora) queda pendiente de
// reconstruir del lado del backend nuevo, como una decisión ya confirmada
// con el usuario, no un olvido.
async function getMetricas() {
  return backendFetchServer<MetricasBackend>('/admin/metricas');
}

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/');
  const m = await getMetricas();

  const tiles = [
    { icon: Users, label: 'Usuarios totales', value: m.usuarios.total, color: 'text-brand', bg: 'bg-brand-pale' },
    { icon: Ban, label: 'Cuentas bloqueadas', value: m.usuarios.bloqueados, color: 'text-red-500', bg: 'bg-red-50' },
    { icon: Home, label: 'Propiedades activas', value: m.propiedades.activas, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: FileWarning, label: 'Solicitudes de revisión pendientes', value: m.solicitudesRevision.pendientes, color: 'text-amber-500', bg: 'bg-amber-50', href: '/admin/solicitudes' },
    { icon: FlagTriangleRight, label: 'Reportes pendientes', value: m.reportes.pendientes, color: 'text-amber-500', bg: 'bg-amber-50', href: '/admin/reportes' },
    { icon: Eye, label: 'Intentos sospechosos', value: m.intentosSospechosos, color: 'text-purple-500', bg: 'bg-purple-50', href: '/admin/intentos-sospechosos' },
    ...(m.intentosFraude !== undefined
      ? [{ icon: ShieldX, label: 'Posibles fraudes', value: m.intentosFraude, color: 'text-red-500', bg: 'bg-red-50', href: '/admin/fraude' }]
      : []),
    { icon: Heart, label: 'Favoritos guardados', value: m.favoritos, color: 'text-pink-500', bg: 'bg-pink-50' },
    { icon: Bell, label: 'Alertas activas', value: m.alertas, color: 'text-orange-500', bg: 'bg-orange-50' },
    { icon: CalendarDays, label: 'Citas agendadas', value: m.citas, color: 'text-sky-500', bg: 'bg-sky-50' },
    { icon: Wrench, label: 'Servicios activos', value: m.servicios, color: 'text-teal-500', bg: 'bg-teal-50', href: '/admin/servicios' },
  ];

  const config = [
    { icon: Mail, label: 'Resend (correo)', ok: m.integraciones.resend },
    { icon: Cpu, label: 'OpenRouter (IA texto)', ok: m.integraciones.openRouter },
    { icon: Cpu, label: 'Gemini (IA foto)', ok: m.integraciones.gemini },
  ];

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Métricas de la plataforma</h1>
      <p className="text-gray-500 text-sm mb-8">
        Hola, <strong className="text-gray-700">{session.nombre}</strong> — solo cuentas con <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">esAdmin</code> ven este panel.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {tiles.map((t) => {
          const tileClass = `bg-white rounded-2xl border border-gray-200 p-5 ${t.href ? 'hover:border-brand/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200' : ''}`;
          const inner = (
            <>
              <div className={`w-10 h-10 ${t.bg} rounded-xl flex items-center justify-center mb-3`}>
                <t.icon size={18} className={t.color} />
              </div>
              <p className="text-2xl font-display font-black text-gray-900">{t.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.label}</p>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className={tileClass}>{inner}</Link>
          ) : (
            <div key={t.label} className={tileClass}>{inner}</div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8">
        <p className="text-sm font-semibold text-gray-800 mb-3">Configuración de integraciones</p>
        <div className="flex flex-wrap gap-4">
          {config.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              <c.icon size={15} className="text-gray-400" />
              <span className="text-gray-600">{c.label}</span>
              <span className={`w-2 h-2 rounded-full ${c.ok ? 'bg-emerald-500' : 'bg-red-400'}`} title={c.ok ? 'Configurado' : 'Falta variable de entorno'} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
