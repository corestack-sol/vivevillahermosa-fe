'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Bell, Plus, Eye, LayoutDashboard, Lightbulb, MessageCircle, Building2, Download, Loader2, Info, Sparkles, AlertTriangle, UserCog, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { backendFetch } from '@/lib/backendApi';
import { Skeleton } from '@/components/ui/Skeleton';
import { mapMiaBackend, ESTADO_CFG, type MiPropiedad } from '@/lib/misPropiedades';
import type { BackendPublicProperty } from '@/lib/api';
import { getPropertyTypeConfig } from '@/lib/propertyTypeConfig';
import { generarReporteDesempeno } from '@/lib/reportePdf';
import { obtenerResumenReporte } from '@/lib/aiClient';
import { usePerfilInmobiliaria } from '@/hooks/usePerfilInmobiliaria';
import { useNotificaciones, notificacionHref, agruparNotificaciones } from '@/hooks/useNotificaciones';
import { formatRelativeDate, formatPrice } from '@/lib/format';
import { evaluarCartera } from '@/lib/coach';
import { CoachModal } from '@/components/dashboard/CoachModal';
import { useLimitePropiedades, MENSAJE_LIMITE_PROPIEDADES } from '@/hooks/useLimitePropiedades';
import { useToast } from '@/context/ToastContext';
import { getViewedCount } from '@/lib/recentlyViewed';

// "buscador" se queda mapeado a la nueva etiqueta — el backend todavía no
// migró el valor default (rename acordado 2026-08-20: buscador -> particular),
// así que hoy sigue llegando literal "buscador" del backend. Sin esto, el
// saludo del panel mostraba "Buscador" aunque ya decidimos llamarlo
// "Particular" en toda la plataforma (reporte explícito: "sigo viendo que
// sigue apareciendo el rol buscador"). Los otros 4 valores del enum nuevo
// se agregan de una vez para cuando el backend sí migre.
const ROL_LABEL: Record<string, string> = {
  buscador: 'Particular',
  particular: 'Particular',
  profesional: 'Profesional',
  inmobiliaria: 'Inmobiliaria',
  agente: 'Agente',
  administrador: 'Administrador',
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [favCount, setFavCount] = useState(0);
  const [alertaCount, setAlertaCount] = useState(0);
  const [misPropiedades, setMisPropiedades] = useState<MiPropiedad[]>([]);
  const { items: itemsNotificaciones, marcarVariasLeidas: marcarNotificacionLeida, marcarTodasLeidas: marcarNotificacionesLeidas } = useNotificaciones();
  // Agrupado por conversación — ver agruparNotificaciones en el hook.
  const notificaciones = agruparNotificaciones(itemsNotificaciones);
  const [generandoReporte, setGenerandoReporte] = useState(false);
  // Panel profesional es solo para inmobiliarias — pedido explícito
  // 2026-08-20 ("no para cualquier usuario").
  const esProfesional = user ? user.rol === 'agente' : false;
  const perfil = usePerfilInmobiliaria(!!user && esProfesional);
  const [showCoachModal, setShowCoachModal] = useState(false);
  // Pre-chequeo del límite gratuito — atenúa "Publicar propiedad" en vez
  // de dejar que la persona entre al formulario de 6 pasos para recién
  // toparse con el gate hasta el final (reporte real 2026-09-01).
  const limitePropiedades = useLimitePropiedades(!!user && !esProfesional);
  const toast = useToast();
  // 0 hasta que el efecto corra — localStorage no existe en el render de
  // servidor, leerlo directo en el cuerpo del componente (aunque este ya
  // es 'use client') hubiera desalineado el HTML del servidor con el del
  // navegador en la primera hidratación (mismo problema de siempre con
  // datos que solo existen en el navegador).
  const [vistasRecientesCount, setVistasRecientesCount] = useState(0);
  useEffect(() => {
    function leerVistasRecientes() { setVistasRecientesCount(getViewedCount()); }
    leerVistasRecientes();
  }, []);

  // Verificación de correo — pedido explícito 2026-09-03, cierra el hallazgo
  // de seguridad más grave que quedaba pendiente en la auditoría de Fase 1
  // (cualquiera podía registrarse con un correo que no le pertenece, sin
  // que nadie lo confirmara). El backend ya lo tenía construido
  // (`POST /auth/verificar-email`, `POST /auth/reenviar-verificacion`) —
  // solo faltaba exponerlo en el frontend.
  const [reenviando, setReenviando] = useState(false);
  async function reenviarVerificacion() {
    setReenviando(true);
    try {
      await backendFetch('/auth/reenviar-verificacion', { method: 'POST' });
      toast.success('Te reenviamos el correo de verificación — revisa tu bandeja de entrada.');
    } catch {
      toast.error('No se pudo reenviar el correo. Intenta de nuevo en unos minutos.');
    } finally {
      setReenviando(false);
    }
  }

  useEffect(() => {
    if (!loading && !user) { router.push('/auth/login'); return; }
    if (!user) return;
    // /propiedades/mias ya no se gatea por esProfesional — pedido explícito
    // 2026-09-09: "Mis propiedades" se quita del menú del Navbar (vivía ahí
    // solo para cuentas individuales) y se agrega como tarjeta real acá en
    // Mi panel, mismo lugar que ya usan las cuentas profesionales. Cuentas
    // individuales también pueden tener propiedades (mismo límite gratuito
    // de 3, ver useLimitePropiedades.ts) — sin este fetch, esa tarjeta
    // mostraría 0 siempre así hubiera propiedades reales.
    Promise.all([
      backendFetch<{ favoritos: string[] }>('/favoritos'),
      backendFetch<{ alertas: unknown[] }>('/alertas'),
      backendFetch<{ propiedades: BackendPublicProperty[] }>('/propiedades/mias'),
    ]).then(([favData, alertData, propiedadesData]) => {
      setFavCount(favData.favoritos?.length ?? 0);
      setAlertaCount(alertData.alertas?.length ?? 0);
      setMisPropiedades(propiedadesData?.propiedades.map(mapMiaBackend) ?? []);
    }).catch(() => {});
  }, [user, loading, router]);

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
  // las 4 métricas originales.
  // Coach de calidad de anuncio (capa 1, heurística — src/lib/coach.ts),
  // reusa `misPropiedades` que este panel ya carga, sin fetch extra.
  const coachPendientes = esProfesional ? evaluarCartera(misPropiedades) : [];

  // Gradiente por tarjeta — segunda vuelta 2026-09-09: "colores muy
  // intensos, quiero que vayan más acorde a los colores de la plataforma".
  // La primera versión usaba familias sueltas de Tailwind (blue-500,
  // rose-500...) que no son parte de la paleta real. Esta versión reusa la
  // MISMA fórmula que ya pintan las cards de colonia en Home/zonas (ver
  // src/lib/zonaGradients.ts: color-mix(color 55%, negro) -> color base),
  // aplicada a los tokens de marca reales (--color-brand/accent/coral/sky/
  // warning, definidos en globals.css @theme) — nunca a un color inventado.
  // No se puede expresar con clases `bg-gradient-to-br from-X` (Tailwind no
  // tiene una utilidad para mezclar dos custom properties arbitrarias), así
  // que va como `style` inline, igual que ZONA_GRADIENTS.
  function gradienteMarca(token: string): string {
    return `linear-gradient(to bottom right, color-mix(in srgb, var(--color-${token}) 55%, black), var(--color-${token}))`;
  }

  const stats = esProfesional
    ? [
        { icon: Building2, label: 'Propiedades publicadas', value: misPropiedades.length, href: '/dashboard/propiedades', gradient: gradienteMarca('brand') },
        { icon: Eye, label: 'Vistas totales', value: misPropiedades.reduce((s, p) => s + p.vistas, 0), href: '/dashboard/propiedades', gradient: gradienteMarca('sky') },
        { icon: MessageCircle, label: 'Contactos recibidos', value: misPropiedades.reduce((s, p) => s + p.contactos, 0), href: '/dashboard/propiedades', gradient: gradienteMarca('accent') },
        { icon: Heart, label: 'Favoritos guardados', value: favCount, href: '/favoritos', gradient: gradienteMarca('coral') },
      ]
    : [
        { icon: Heart, label: 'Favoritos guardados', value: favCount, href: '/favoritos', gradient: gradienteMarca('coral') },
        { icon: Bell, label: 'Alertas activas', value: alertaCount, href: '/alertas', gradient: gradienteMarca('warning') },
        // Bug real reportado 2026-09-02: "Propiedades vistas" mandaba a
        // /propiedades (el catálogo completo, no lo que esa persona vio) —
        // ahora manda a la lista real de vistos recientemente
        // (localStorage, ver dashboard/recientes/page.tsx).
        //
        // "Propiedades contactadas" (actividad como comprador, sin backend
        // detrás) se quitó del todo 2026-09-08 — pedido explícito del
        // usuario: el nombre "globalizaba" (no dejaba claro DE QUÉ
        // propiedades hablaba) y ya existe el dato real que sí importa —
        // cuántas veces contactaron CADA propiedad tuya — ahora visible por
        // fila en /dashboard/propiedades (ver ese archivo).
        { icon: Eye, label: 'Propiedades vistas', value: vistasRecientesCount, href: '/dashboard/recientes', gradient: gradienteMarca('sky') },
        // La tarjeta "Mis propiedades" (2026-09-09, movida acá desde el
        // menú del Navbar) se quita de vuelta 2026-09-09 — pedido explícito
        // del usuario: prefiere ver la lista real de propiedades directo en
        // Mi panel en vez de un número que solo enlaza a otra página. Ver
        // la sección "Mis propiedades (lista)" más abajo.
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
          {/* Pedido explícito 2026-09-09: se saca del menú del Navbar y se
              mueve acá — mismo destino (/dashboard/cuenta), solo cambia
              dónde se accede. */}
          <Link href="/dashboard/cuenta" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand transition-colors mt-1">
            <UserCog size={12} /> Mis datos
          </Link>
        </div>
        {limitePropiedades ? (
          <button
            type="button"
            onClick={() => toast.error(MENSAJE_LIMITE_PROPIEDADES)}
            className="flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl opacity-40 cursor-not-allowed"
          >
            <Plus size={15} /> Publicar propiedad
          </button>
        ) : (
          <Link href="/publicar"
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Plus size={15} /> Publicar propiedad
          </Link>
        )}
      </div>

      {/* Correo sin verificar — pedido explícito 2026-09-03. AlertTriangle
          ya estaba importado (se usa más abajo en otra alerta). */}
      {!user.emailVerificado && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Todavía no verificas tu correo.</strong> Revisa tu bandeja de entrada, o pide que te lo reenviemos.
            </p>
          </div>
          <button
            type="button"
            onClick={reenviarVerificacion}
            disabled={reenviando}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 underline disabled:opacity-50"
          >
            {reenviando && <Loader2 size={12} className="animate-spin" />}
            Reenviar correo
          </button>
        </div>
      )}

      {/* Solo para profesionales — "Contactos recibidos" ya es real
          (confirmado en vivo 2026-09-02), "Vistas totales" sigue pendiente.
          Para cuentas normales ya no hace falta este aviso: "Propiedades
          vistas" es real (localStorage) y "Propiedades contactadas" (la
          otra mitad del aviso original) se quitó del panel del todo
          2026-09-08 — sin dato falso que aclarar, no queda nada que decir
          acá. */}
      {esProfesional && (
        <div className="flex items-start gap-2.5 bg-brand-pale border border-brand/20 rounded-xl px-4 py-3 mb-6">
          <Info size={15} className="text-brand flex-shrink-0 mt-0.5" />
          <p className="text-xs text-brand-dark leading-relaxed">
            <strong>Los contactos recibidos ya son reales</strong> — las vistas totales todavía no, llegan cuando el backend implemente ese conteo.
          </p>
        </div>
      )}

      {/* Coach de anuncios — no intrusivo a propósito (pedido explícito
          2026-08-22): no es un modal automático ni un banner de alarma,
          solo aparece cuando de verdad hay algo que revisar, y su única
          acción es abrir el modal cuando el propietario decide verlo. */}
      {esProfesional && coachPendientes.length > 0 && (
        <button
          type="button"
          onClick={() => setShowCoachModal(true)}
          className="w-full flex items-center gap-3 bg-white border border-amber-200 rounded-2xl px-5 py-3.5 mb-6 text-left hover:border-amber-300 hover:shadow-sm transition-all"
        >
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              {coachPendientes.length} propiedad{coachPendientes.length !== 1 ? 'es' : ''} podría{coachPendientes.length !== 1 ? 'n' : ''} mejorar su anuncio
            </p>
            <p className="text-xs text-gray-500">Fotos, descripción o amenidades incompletas — revisa las sugerencias.</p>
          </div>
          <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 ml-auto" />
        </button>
      )}

      {/* Stats — segunda vuelta, pedido explícito 2026-09-09: "un
          verdadero diferenciador, otros colores de fondo con degradado,
          alguna animación leve". La primera versión (blanco + resplandor
          de esquina) seguía leyéndose como una tarjeta blanca más — esta
          vez el fondo ES el degradado, no un detalle:
          - `bg-gradient-to-br ${s.gradient}` — dos tonos reales por
            tarjeta (ver el comentario junto al array `stats` sobre por
            qué son strings literales, no armados en runtime). Texto/ícono
            en blanco encima, no gris sobre blanco.
          - Ícono en una placa de vidrio (`bg-white/15` + `ring-white/25`)
            en vez del cuadrado de color sólido de antes — se distingue del
            fondo aunque ambos sean parte de la misma paleta.
          - Entrada escalonada (`animate-fade-up`, delay creciente por
            índice) — la MISMA clase que ya usa el Hero de Home, respeta
            `prefers-reduced-motion` (globals.css ya la desactiva ahí),
            nada nuevo que mantener. "Leve" a propósito: una sola vez al
            cargar, no un loop continuo que distraiga en un dashboard que
            se mira seguido. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s, i) => {
          const contenido = (
            <>
              <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/25 rounded-full blur-xl pointer-events-none animate-water" aria-hidden="true" />
              <div className="relative w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-white/25">
                <s.icon size={19} className="text-white" strokeWidth={2} />
              </div>
              <p className="relative text-3xl font-display font-black text-white tracking-tight">{s.value}</p>
              <p className="relative text-[11px] font-semibold text-white/70 uppercase tracking-wide mt-1">{s.label}</p>
            </>
          );
          const estilo = { background: s.gradient, animationDelay: `${i * 60}ms` };
          // Sin href — sin ningún dato real detrás todavía (ver el
          // comentario junto al array `stats`), no clicable a propósito
          // en vez de mandar a algo inventado.
          if (!s.href) {
            return (
              <div key={s.label}
                className="relative overflow-hidden rounded-3xl p-5 opacity-50 cursor-default animate-fade-up"
                style={estilo}>
                {contenido}
              </div>
            );
          }
          return (
            <Link key={s.label} href={s.href}
              className="relative overflow-hidden rounded-3xl p-5 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fade-up"
              style={estilo}>
              {contenido}
            </Link>
          );
        })}
      </div>

      {/* Mis propiedades (lista) — pedido explícito 2026-09-09: reemplaza
          a la tarjeta "Mis propiedades" que vivía en el grid de stats de
          arriba (se quitó) — la persona prefiere ver la lista real acá
          mismo en vez de un número que solo enlaza a otra página. Mismo
          patrón que "Notificaciones recientes" más abajo: hasta 5, con
          "Ver todas" al fondo que manda a la gestión completa
          (/dashboard/propiedades, donde sí viven pausar/editar/eliminar).
          Solo cuentas individuales — las profesionales ya tienen su propio
          bloque más abajo (Tip + botón "Ver mis propiedades" + reporte). */}
      {!esProfesional && misPropiedades.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 mb-8 overflow-hidden">
          {/* Fondo verde — pedido explícito 2026-09-09, mismo verde real
              del header del sitio (bg-brand-dark, ver Navbar.tsx), no un
              tono inventado. */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-brand-dark">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Building2 size={15} className="text-white/80" /> Mis propiedades
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {misPropiedades.slice(0, 5).map((mp) => {
              const cfg = getPropertyTypeConfig(mp.property.tipo);
              const estadoCfg = ESTADO_CFG[mp.estado];
              return (
                <Link
                  key={mp.property.id}
                  href={`/propiedades/${mp.property.slug}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `linear-gradient(160deg, ${cfg.from} 0%, ${cfg.to} 100%)` }}>
                    <cfg.Icon size={18} style={{ color: cfg.accent }} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{mp.property.titulo}</p>
                      <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${estadoCfg.cls}`}>
                        {estadoCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatPrice(mp.property.precio, mp.property.operacion)} · {mp.contactos} {mp.contactos === 1 ? 'contacto' : 'contactos'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </Link>
              );
            })}
          </div>
          <Link
            href="/dashboard/propiedades"
            className="block text-center text-xs font-semibold text-brand hover:text-brand-dark py-2.5 border-t border-gray-100 hover:bg-gray-50 transition-colors"
          >
            Gestionar todas
          </Link>
        </div>
      )}

      {/* Notificaciones recientes — pedido explícito 2026-09-09: se movió
          de más arriba (entre el aviso de correo y el grid de stats) a
          este lugar, para que la lista de propiedades (arriba, lo
          principal para una cuenta individual) no quede empujada hacia
          abajo por algo secundario. */}
      {notificaciones.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 mb-8 overflow-hidden">
          {/* Fondo verde — pedido explícito 2026-09-09, mismo verde real
              del header del sitio (bg-brand-dark), igual que "Mis
              propiedades" arriba. */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-brand-dark">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bell size={15} className="text-white/80" /> Notificaciones recientes
            </p>
            {notificaciones.some((n) => !n.leida) && (
              <button onClick={marcarNotificacionesLeidas} className="text-xs text-white/90 font-semibold hover:underline">
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {notificaciones.slice(0, 5).map((n) => (
              <Link
                key={n.id}
                href={notificacionHref(n)}
                onClick={() => marcarNotificacionLeida(n.idsAgrupados)}
                className={`flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors ${!n.leida ? 'bg-brand-pale/20' : ''}`}
              >
                {!n.leida && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />}
                <div className={`min-w-0 flex-1 ${n.leida ? 'ml-[18px]' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-800 leading-snug">{n.titulo}</p>
                    {n.sinLeerCount > 1 && (
                      <span className="flex-shrink-0 text-[10px] font-bold text-brand bg-brand-pale px-1.5 py-0.5 rounded-full">
                        {n.sinLeerCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.mensaje}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{formatRelativeDate(n.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
          {/* Aquí solo se ven las 5 más recientes — el inbox completo
              (sin ese tope) vive en su propia página, ver
              dashboard/notificaciones/page.tsx. */}
          <Link
            href="/dashboard/notificaciones"
            className="block text-center text-xs font-semibold text-brand hover:text-brand-dark py-2.5 border-t border-gray-100 hover:bg-gray-50 transition-colors"
          >
            Ver todas
          </Link>
        </div>
      )}

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

      {esProfesional && (
        <CoachModal isOpen={showCoachModal} onClose={() => setShowCoachModal(false)} pendientes={coachPendientes} />
      )}
    </div>
  );
}
