'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Menu, X, Plus, User, Heart, Bell, LayoutDashboard, LogOut, ChevronDown, Building2, Settings,
  CalendarDays, Users, TrendingUp, UserPlus, ShieldCheck, Home, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { buttonClasses } from '@/components/ui/Button';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { useClickOutside } from '@/hooks/useClickOutside';

// /blog se queda fuera del menú a propósito — pedido explícito 2026-08-19:
// las páginas siguen vivas (indexables, ver sitemap.ts) mientras se decide
// el rumbo real de la sección (ver análisis de esa fecha), pero no se le
// promete al usuario contenido nuevo constante ocupando un lugar en el
// menú principal.
const navLinks = [
  { href: '/propiedades?operacion=venta', base: '/propiedades', operacion: 'venta', label: 'Comprar' },
  { href: '/propiedades?operacion=renta', base: '/propiedades', operacion: 'renta', label: 'Rentar' },
  { href: '/zonas',  base: '/zonas',  label: 'Zonas' },
  { href: '/mapa',   base: '/mapa',   label: 'Mapa' },
];

interface MenuItem { href: string; icon: LucideIcon; label: string }
interface MenuGroup { label?: string; items: MenuItem[] }

// Compartido entre el menú de escritorio y el de móvil — antes cada uno
// tenía su propio array duplicado, con riesgo de que se desalinearan al
// agregar una función nueva (como pasó al sumar Leads/Analítica/Equipo).
// Agrupado en "Herramientas" (gestión activa del negocio) vs. "Perfil"
// (cuenta y contenido guardado) para que el menú no se sienta como una
// lista plana de 8 links sin relación entre sí.
// "Mis propiedades" (/dashboard/propiedades) NO está en este array para
// cuentas profesionales — ya es el botón "Panel profesional" del header
// (línea ~145), tenerlo también aquí era el mismo destino duplicado dos
// veces. Para cuentas normales (buscador) SÍ se agrega dentro de
// buildMenuGroups: esas cuentas no tienen ese botón de header (ahí ven
// "Publicar gratis" en su lugar), así que sin esto no había ningún enlace
// visible de vuelta a "lo que ya publiqué" — se podía publicar pero no
// gestionar/eliminar sin escribir la URL a mano.
const HERRAMIENTAS_ITEMS: MenuItem[] = [
  { href: '/dashboard/leads', icon: Users, label: 'Leads' },
  { href: '/dashboard/citas', icon: CalendarDays, label: 'Mi agenda' },
  { href: '/dashboard/analitica', icon: TrendingUp, label: 'Analítica' },
  { href: '/dashboard/equipo', icon: UserPlus, label: 'Equipo' },
];

const PERFIL_ITEMS_BASE: MenuItem[] = [
  { href: '/favoritos', icon: Heart, label: 'Mis favoritos' },
  { href: '/alertas', icon: Bell, label: 'Mis alertas' },
];

function buildMenuGroups(esProfesional: boolean, esAdmin: boolean): MenuGroup[] {
  return [
    { items: [{ href: '/dashboard', icon: LayoutDashboard, label: 'Mi panel' }] },
    ...(esProfesional ? [{ label: 'Herramientas', items: HERRAMIENTAS_ITEMS }] : []),
    {
      label: 'Perfil',
      items: [
        ...(esProfesional ? [{ href: '/dashboard/perfil', icon: Settings, label: 'Perfil de la inmobiliaria' }] : []),
        ...(!esProfesional ? [{ href: '/dashboard/propiedades', icon: Building2, label: 'Mis propiedades' }] : []),
        ...PERFIL_ITEMS_BASE,
      ],
    },
    ...(esAdmin ? [{ label: 'Administración', items: [{ href: '/admin', icon: ShieldCheck, label: 'Panel de administración' }] }] : []),
  ];
}

// Se usa como `fallback` del <Suspense> que envuelve <Navbar/> en
// layout.tsx (necesario porque Navbar usa useSearchParams(), y sin ese
// límite Next.js no puede pre-renderizar la Home como estática). Sin un
// fallback del mismo alto, ese hueco se rellenaba con NADA hasta que el
// cliente hidrataba — el header de 64px aparecía de golpe empujando el
// Hero hacia abajo, el "brinco" entre hero y header al terminar de
// cargar. Mismo alto/fondo/logo que el header real, sin los enlaces ni
// botones que dependen de hooks de cliente (esos si pueden aparecer un
// instante después sin mover nada, porque el alto ya estaba reservado).
export function NavbarFallback() {
  return (
    <header className="sticky top-0 z-40 bg-brand-dark/97 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/10">
      <nav className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-8">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-mark.png" alt="" className="h-9 w-auto flex-shrink-0" />
            <span className="font-display font-black text-[17px] leading-none tracking-tight text-white">
              Vive <span className="text-coral">Villahermosa</span>
            </span>
          </div>
        </div>
      </nav>
    </header>
  );
}

export function Navbar() {
  const [isOpen, setIsOpen]         = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { user, loading, logout } = useAuth();
  const toast = useToast();
  // Panel profesional es solo para inmobiliarias — pedido explícito
  // 2026-08-20 ("no para cualquier usuario"). "profesional" (servicios,
  // hoy en pausa) y "agente" quedan fuera hasta que tengan su propia
  // experiencia real, en vez de heredar el panel de una inmobiliaria.
  const esProfesional = !!user && user.rol === 'inmobiliaria';
  const userMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(userMenuRef, userMenuOpen, () => setUserMenuOpen(false));
  const navRef = useRef<HTMLElement>(null);
  useClickOutside(navRef, isOpen, () => setIsOpen(false));

  async function handleLogout() {
    setUserMenuOpen(false);
    try {
      await logout();
      toast.success('Sesión cerrada.');
    } catch {
      // logout() ya limpió la sesión local aunque el servidor haya
      // fallado (ver AuthContext.tsx) — se avisa igual, por si la
      // persona está en un equipo compartido y esperaba que el
      // servidor también cerrara la sesión.
      toast.error('Cerraste sesión en este dispositivo, pero hubo un problema al avisar al servidor.');
    }
    router.push('/');
  }

  const isActive = (link: typeof navLinks[number]) => {
    if (!pathname.startsWith(link.base)) return false;
    if (link.operacion) return searchParams.get('operacion') === link.operacion;
    return true;
  };

  // /mapa ya tiene su propio botón "Volver al inicio" en horizontal móvil
  // (MapaClient.tsx) — pedido explícito 2026-08-18: en esa pantalla el
  // header no debe verse, el mapa se queda con el 100vh completo. Mismo
  // criterio de detección que .rotate-hint (globals.css): max-width
  // 1023px (bajo `lg`) + landscape + pointer:coarse, para no esconder el
  // header en una ventana de escritorio angosta.
  const isMapa = pathname.startsWith('/mapa');

  return (
    // Header oscuro a propósito — el resto del sitio es blanco/gris claro,
    // así que un header en brand-dark es lo que da el golpe de marca desde
    // el primer scroll, en vez de fundirse con el contenido de abajo.
    <header className={`sticky top-0 z-40 bg-brand-dark/97 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/10 ${
      isMapa ? 'max-lg:landscape:pointer-coarse:hidden' : ''
    }`}>
      {/* El header es chrome global, no contenido de página — a propósito
          NO lleva max-w-7xl mx-auto como el resto del sitio. Con eso, en
          pantallas anchas el logo quedaba flotando a ~300px del borde real
          (la mitad del espacio sobrante de centrar una caja de 1280px),
          que es justo lo contrario de "pegado a la izquierda". Ahora el
          logo y las acciones quedan pegados a los bordes reales de la
          ventana, con el mismo padding que usa el resto del sitio. */}
      <nav ref={navRef} className="px-4 sm:px-6 lg:px-8">
        {/* Dos zonas: logo+nav agrupados a la izquierda (con aire razonable
            entre ellos, no centrados a media pantalla), acciones empujadas
            del todo a la derecha con ml-auto. El problema original no era
            que el nav necesitara estar centrado — era que todos los gaps
            internos (logo-nav, entre links, entre acciones) eran demasiado
            angostos y todo se sentía apelmazado. */}
        <div className="flex items-center h-16 gap-8">

          {/* Logo + nav — un solo grupo a la izquierda */}
          <div className="flex items-center gap-8 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0" onClick={() => setIsOpen(false)}>
              {/* Logo real (src/assets/logo.png, recortado a su contenido y
                  con el fondo casi-blanco vuelto transparente — ver
                  public/images/logo-mark.png) en vez del ícono de casa
                  genérico. Ya trae su propio color, así que no lleva
                  contenedor con degradado detrás como el ícono anterior. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo-mark.png" alt="" className="h-9 w-auto flex-shrink-0" />
              <span className="font-display font-black text-[17px] leading-none tracking-tight text-white">
                {/* coral, no accent — accent (terracota) se ve apagado
                    contra el header oscuro; coral es el acento "vivo" que
                    ya se usa en el resto del Hero (punto del eyebrow, "Sin
                    comisión", etc.), mejor contraste aquí también. */}
                Vive <span className="text-coral">Villahermosa</span>
              </span>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              <Link href="/" aria-label="Inicio"
                className={`relative p-2 rounded-xl transition-colors ${
                  pathname === '/' ? 'text-white' : 'text-white hover:bg-white/8'
                }`}
              >
                <Home size={17} />
                {pathname === '/' && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-accent" />
                )}
              </Link>
              {navLinks.map((link) => {
                const active = isActive(link);
                return (
                  <Link key={link.href} href={link.href}
                    className={`relative px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                      active
                        ? 'text-white'
                        : 'text-white hover:bg-white/8'
                    }`}
                  >
                    {link.label}
                    {active && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-accent" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Acciones — empujadas del todo a la derecha */}
          <div className="flex items-center ml-auto">
          <div className="hidden lg:flex items-center gap-3">
            {esProfesional && (
              <Link href="/dashboard/propiedades"
                className="flex items-center gap-1.5 text-sm font-medium text-white border border-white/20 hover:border-white/40 rounded-xl px-3.5 py-2 transition-colors">
                <Building2 size={14} /> Panel profesional
              </Link>
            )}
            {!esProfesional && (
              <Link href="/publicar" className={buttonClasses('primary', 'md')}>
                <Plus size={15} strokeWidth={2.5} /> Publicar gratis
              </Link>
            )}

            {!loading && user && <NotificationBell />}

            {!loading && (
              user ? (
                <div className="relative" ref={userMenuRef}>
                  <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border transition-colors text-sm border-white/15 hover:border-white/30 hover:bg-white/8">
                    <div className="w-7 h-7 rounded-lg ring-1 ring-white/15 bg-gradient-to-br from-brand to-brand-light flex items-center justify-center text-white text-xs font-bold">
                      {user.nombre.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium max-w-24 truncate text-white">
                      {user.nombre.split(' ')[0]}
                    </span>
                    <ChevronDown size={13} className={`transition-transform text-white ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-30 py-1.5 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-gray-50 mb-1">
                          <p className="text-xs font-semibold text-gray-800">{user.nombre}</p>
                          <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        </div>
                        {buildMenuGroups(esProfesional, !!user.esAdmin).map((group, gi) => (
                          <div key={gi} className={gi > 0 ? 'border-t border-gray-50 mt-1 pt-1' : ''}>
                            {group.label && (
                              <p className="px-4 pt-1 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">{group.label}</p>
                            )}
                            {group.items.map((item) => (
                              <Link key={item.href} href={item.href} onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-pale hover:text-brand transition-colors">
                                <item.icon size={14} /> {item.label}
                              </Link>
                            ))}
                          </div>
                        ))}
                        <div className="border-t border-gray-50 mt-1 pt-1">
                          <button onClick={handleLogout}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                            <LogOut size={14} /> Cerrar sesión
                          </button>
                        </div>
                      </div>
                  )}
                </div>
              ) : (
                <Link href="/auth/login"
                  className="flex items-center gap-1.5 border text-sm font-medium px-3.5 py-2 rounded-xl transition-colors text-white border-white/20 hover:border-white/40">
                  <User size={14} /> Entrar
                </Link>
              )
            )}
          </div>

          {/* Mobile/tablet: notificaciones + hamburger — breakpoint en lg
              (1024px), no md (768px): a 768-1023px (tablet portrait) el nav
              de escritorio completo (5 links + acciones + menú de usuario)
              no cabía en una sola fila y el botón "Publicar gratis" quedaba
              partido en 3 líneas encimado con "Blog" (bug real confirmado
              en auditoría de responsividad, 2026-08-10). lg ya es el mismo
              breakpoint que usa el panel de filtros de /propiedades
              (FilterPanel/PropertiesClient) para su propio cambio
              sidebar-vs-botón — antes estaban desalineados entre sí. */}
          <div className="lg:hidden flex items-center gap-1">
            {!loading && user && <NotificationBell />}
            <button
              className="p-2 rounded-xl transition-colors text-white hover:bg-white/10"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          </div>
        </div>

        {/* Mobile menu — orden pedido explícito 2026-08-18: cuenta
            (iniciar sesión, o el menú de usuario si ya hay sesión) arriba
            del todo, "Publicar gratis" hasta el final. */}
        {isOpen && (
          <div className="lg:hidden border-t py-3 pb-4 space-y-0.5 border-white/10">
            {user ? (
              <div className="pb-2 mb-2 border-b border-white/10 space-y-0.5">
                {buildMenuGroups(esProfesional, !!user.esAdmin).map((group, gi) => (
                  <div key={gi} className={`space-y-0.5 ${gi > 0 ? 'border-t border-white/10 mt-2 pt-2' : ''}`}>
                    {group.label && (
                      <p className="px-4 pt-1 pb-1 text-[10px] font-bold text-white uppercase tracking-wide">{group.label}</p>
                    )}
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm rounded-xl text-white hover:bg-white/8">
                        <item.icon size={14} /> {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
                <div className="border-t border-white/10 mt-2 pt-2">
                  <button onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/15 rounded-xl">
                    <LogOut size={14} /> Cerrar sesión
                  </button>
                </div>
              </div>
            ) : (
              <Link href="/auth/login" onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 mb-2 text-sm font-medium rounded-xl text-white hover:bg-white/10">
                <User size={14} /> Iniciar sesión
              </Link>
            )}

            <Link href="/" onClick={() => setIsOpen(false)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === '/' ? 'text-white bg-white/10' : 'text-white hover:bg-white/8'
              }`}>
              <Home size={15} /> Inicio
            </Link>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}
                className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive(link)
                    ? 'text-white bg-white/10'
                    : 'text-white hover:bg-white/8'
                }`}>
                {link.label}
              </Link>
            ))}

            {!esProfesional && (
              <div className="pt-2 px-4">
                <Link href="/publicar" onClick={() => setIsOpen(false)}
                  className={buttonClasses('primary', 'lg', 'w-full')}>
                  <Plus size={15} strokeWidth={2.5} /> Publicar gratis
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
