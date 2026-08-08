import Link from 'next/link';
import { Users, ShieldAlert, FileWarning, FlagTriangleRight, Heart, Bell, CalendarDays, Wrench, Ban, Mail, Cpu, Eye } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { getBusquedaStats } from '@/lib/busquedaStats';

// Server Component — llama directo a Prisma en vez de fetch a su propia API
// (evita un roundtrip HTTP innecesario a sí mismo en el primer render).
// Mismas queries y mismos nombres que GET /api/admin/metricas (que el
// backend separado replicará) — solo se agrega `admins`, propio de esta
// página, para no divergir del contrato documentado en docs/BACKEND.md §16.
async function getMetricas() {
  const [
    totalUsuarios, usuariosBloqueados, admins, solicitudesPendientes, reportesPendientes,
    intentosSospechosos7d, totalFavoritos, totalAlertas, totalCitas, totalServicios,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { bloqueado: true } }),
    prisma.user.count({ where: { esAdmin: true } }),
    prisma.solicitudRevision.count({ where: { estado: 'pendiente' } }),
    prisma.reporteAnuncio.count({ where: { estado: 'pendiente' } }),
    prisma.intentoSospechoso.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    prisma.favorito.count(),
    prisma.alerta.count(),
    prisma.cita.count(),
    prisma.servicioProveedor.count({ where: { activo: true } }),
  ]);
  return {
    totalUsuarios, usuariosBloqueados, admins, solicitudesPendientes, reportesPendientes,
    intentosSospechosos7d, totalFavoritos, totalAlertas, totalCitas, totalServicios,
    resendConfigurado: !!process.env.RESEND_API_KEY,
    openrouterConfigurado: !!process.env.OPENROUTER_API_KEY,
    geminiConfigurado: !!process.env.GEMINI_API_KEY,
  };
}

export default async function AdminPage() {
  const session = await getSessionOrRedirect();
  const m = await getMetricas();

  const tiles = [
    { icon: Users, label: 'Usuarios totales', value: m.totalUsuarios, color: 'text-brand', bg: 'bg-brand-pale' },
    { icon: Ban, label: 'Cuentas bloqueadas', value: m.usuariosBloqueados, color: 'text-red-500', bg: 'bg-red-50' },
    { icon: ShieldAlert, label: 'Admins activos', value: m.admins, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: FileWarning, label: 'Solicitudes de revisión pendientes', value: m.solicitudesPendientes, color: 'text-amber-500', bg: 'bg-amber-50', href: '/admin/solicitudes' },
    { icon: FlagTriangleRight, label: 'Reportes pendientes', value: m.reportesPendientes, color: 'text-amber-500', bg: 'bg-amber-50', href: '/admin/reportes' },
    { icon: Eye, label: 'Intentos sospechosos (7 días)', value: m.intentosSospechosos7d, color: 'text-purple-500', bg: 'bg-purple-50', href: '/admin/intentos-sospechosos' },
    { icon: Heart, label: 'Favoritos guardados', value: m.totalFavoritos, color: 'text-pink-500', bg: 'bg-pink-50' },
    { icon: Bell, label: 'Alertas activas', value: m.totalAlertas, color: 'text-orange-500', bg: 'bg-orange-50' },
    { icon: CalendarDays, label: 'Citas agendadas', value: m.totalCitas, color: 'text-sky-500', bg: 'bg-sky-50' },
    { icon: Wrench, label: 'Servicios activos', value: m.totalServicios, color: 'text-teal-500', bg: 'bg-teal-50', href: '/admin/servicios' },
  ];

  const config = [
    { icon: Mail, label: 'Resend (correo)', ok: m.resendConfigurado },
    { icon: Cpu, label: 'OpenRouter (IA texto)', ok: m.openrouterConfigurado },
    { icon: Cpu, label: 'Gemini (IA foto)', ok: m.geminiConfigurado },
  ];

  const busqueda = getBusquedaStats();

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">Métricas de la plataforma</h1>
      <p className="text-gray-500 text-sm mb-8">
        Hola, <strong className="text-gray-700">{session.nombre}</strong> — solo cuentas con <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">esAdmin</code> ven este panel.
      </p>

      {/* Sin ningún tile de propiedades a propósito — Property no es una
          tabla real todavía, mostrar un número ahí sería inventar un dato. */}
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

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Buscador con IA — desde que arrancó el servidor</p>
        <p className="text-xs text-gray-400 mb-3">
          Contador en memoria, se reinicia con cada despliegue — sirve para calibrar el límite de tasa global de{' '}
          <code className="bg-gray-100 px-1 py-0.5 rounded">/ia/busqueda-inteligente</code> con tráfico real en vez de una suposición (ver docs/BACKEND.md §8).
        </p>
        {busqueda.total === 0 ? (
          <p className="text-sm text-gray-400">Sin búsquedas todavía.</p>
        ) : (
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-2xl font-display font-black text-gray-900">{busqueda.total}</p>
              <p className="text-xs text-gray-500 mt-0.5">Búsquedas totales</p>
            </div>
            <div>
              <p className="text-2xl font-display font-black text-emerald-600">{busqueda.tasaCacheHit}%</p>
              <p className="text-xs text-gray-500 mt-0.5">Resueltas por caché ({busqueda.cacheHits})</p>
            </div>
            <div>
              <p className="text-2xl font-display font-black text-brand">{busqueda.iaExitosa}</p>
              <p className="text-xs text-gray-500 mt-0.5">Llamadas reales a OpenRouter</p>
            </div>
            <div>
              <p className={`text-2xl font-display font-black ${busqueda.tasaDegradacion > 10 ? 'text-red-500' : 'text-amber-500'}`}>{busqueda.tasaDegradacion}%</p>
              <p className="text-xs text-gray-500 mt-0.5">Degradadas a heurística ({busqueda.heuristicaRespaldo})</p>
            </div>
          </div>
        )}

        {busqueda.total > 0 && (
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-1">
              Búsquedas por hora del día{busqueda.horaPico !== null && (
                <span className="font-normal text-gray-500"> — hora pico: <strong className="text-brand">{String(busqueda.horaPico).padStart(2, '0')}:00</strong> (hora de Tabasco)</span>
              )}
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Único dato de uso real que hay hoy — las &quot;vistas&quot; de propiedades en otros lados de la plataforma son de muestra, no tráfico real (<code className="bg-gray-100 px-1 py-0.5 rounded">Property</code> no es una tabla real todavía).
            </p>
            <div className="flex items-end gap-1 h-32">
              {busqueda.porHora.map((valor, hora) => {
                const maxValor = Math.max(...busqueda.porHora, 1);
                const esPico = valor > 0 && valor === maxValor;
                return (
                  <div key={hora} className="flex-1 flex flex-col items-center justify-end h-full" title={`${String(hora).padStart(2, '0')}:00 — ${valor} búsqueda${valor === 1 ? '' : 's'}`}>
                    <div
                      className={`w-full rounded-t ${esPico ? 'bg-brand' : valor > 0 ? 'bg-brand-pale' : 'bg-gray-100'}`}
                      style={{ height: valor > 0 ? `${Math.max((valor / maxValor) * 100, 6)}%` : '2px' }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-1.5">
              {busqueda.porHora.map((_, hora) => (
                <div key={hora} className="flex-1 text-center text-[9px] text-gray-400">
                  {hora % 3 === 0 ? hora : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

async function getSessionOrRedirect() {
  const admin = await requireAdmin();
  if (!admin.ok) throw new Error('El layout ya garantiza sesión de admin — no debería llegar aquí');
  return admin.session;
}
