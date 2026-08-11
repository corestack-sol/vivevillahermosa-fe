import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users, FileWarning, FlagTriangleRight, Heart, Bell, CalendarDays, Wrench, Ban, Mail, Cpu, Eye, Home } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { backendFetchServer } from '@/lib/backendApiServer';
import { getBusquedaStats } from '@/lib/busquedaStats';

interface MetricasBackend {
  usuarios: { total: number; bloqueados: number };
  propiedades: { total: number; activas: number; pausadas: number };
  solicitudesRevision: { total: number; pendientes: number };
  reportes: { total: number; pendientes: number };
  intentosSospechosos: number;
  favoritos: number;
  alertas: number;
  citas: number;
  integraciones: { resend: boolean; openRouter: boolean; gemini: boolean };
}

// GET /admin/metricas (BACKEND.md §16) ya viene del backend real — el único
// dato que sigue local es "Servicios activos" (el módulo Servicios sigue en
// pausa, §11) y el contador de IA de búsqueda (en memoria de este proceso,
// /ia/* tampoco migró todavía, §8). Sin tile de "Admins activos" — el
// backend no expone ese conteo en /admin/metricas y no vale la pena un
// fetch aparte solo por esa cifra.
async function getMetricas() {
  const [metricas, totalServicios] = await Promise.all([
    backendFetchServer<MetricasBackend>('/admin/metricas'),
    prisma.servicioProveedor.count({ where: { activo: true } }),
  ]);
  return { ...metricas, totalServicios };
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
    { icon: Heart, label: 'Favoritos guardados', value: m.favoritos, color: 'text-pink-500', bg: 'bg-pink-50' },
    { icon: Bell, label: 'Alertas activas', value: m.alertas, color: 'text-orange-500', bg: 'bg-orange-50' },
    { icon: CalendarDays, label: 'Citas agendadas', value: m.citas, color: 'text-sky-500', bg: 'bg-sky-50' },
    { icon: Wrench, label: 'Servicios activos', value: m.totalServicios, color: 'text-teal-500', bg: 'bg-teal-50', href: '/admin/servicios' },
  ];

  const config = [
    { icon: Mail, label: 'Resend (correo)', ok: m.integraciones.resend },
    { icon: Cpu, label: 'OpenRouter (IA texto)', ok: m.integraciones.openRouter },
    { icon: Cpu, label: 'Gemini (IA foto)', ok: m.integraciones.gemini },
  ];

  const busqueda = getBusquedaStats();

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
              El buscador de IA todavía es el único que corre contra este backend en Next.js (docs/BACKEND.md §8) — el resto de la plataforma, incluidas las propiedades de arriba, ya viene del backend separado.
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
