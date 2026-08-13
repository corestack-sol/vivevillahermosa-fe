'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, LayoutDashboard, Users, FileWarning, FlagTriangleRight, ShieldAlert, Wrench, ScrollText, MapPin } from 'lucide-react';

const LINKS = [
  { href: '/admin', icon: LayoutDashboard, label: 'Métricas', exact: true },
  { href: '/admin/usuarios', icon: Users, label: 'Usuarios' },
  { href: '/admin/solicitudes', icon: FileWarning, label: 'Solicitudes de revisión' },
  { href: '/admin/reportes', icon: FlagTriangleRight, label: 'Reportes' },
  { href: '/admin/intentos-sospechosos', icon: ShieldAlert, label: 'Intentos sospechosos' },
  { href: '/admin/servicios', icon: Wrench, label: 'Servicios' },
  { href: '/admin/zonas', icon: MapPin, label: 'Colonias con ficha' },
  { href: '/admin/auditoria', icon: ScrollText, label: 'Auditoría' },
];

export function AdminNav({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  return (
    <header className="bg-brand-dark border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 gap-2">
          <Link href="/admin" className="flex items-center gap-2 text-white font-display font-bold mr-4">
            <ShieldCheck size={18} className="text-accent" />
            Admin
          </Link>
          <span className="text-xs text-white/40 hidden sm:inline mr-4">{nombre}</span>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto pb-2 -mt-1">
          {LINKS.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <link.icon size={14} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
