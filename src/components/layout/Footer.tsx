'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MapPin, Phone, Mail, Droplets } from 'lucide-react';

function FooterMinimal() {
  // Mismo trío cálido del Hero (brand-pale → blanco → sand, ver page.tsx)
  // en vez de un bg-white plano — así el footer, aunque minimalista, no
  // se siente desconectado del resto de la paleta Tabasco. Muy diluido
  // (/30) porque es una barra angosta de una sola línea, no un fondo
  // protagonista como el del Hero.
  return (
    <footer className="bg-gradient-to-r from-brand-pale/30 via-white to-sand/30 border-t border-brand/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-1.5">
        <p className="text-sm text-brand-dark/70">
          © {new Date().getFullYear()} Vive Villahermosa. Todos los derechos reservados.
        </p>
        <p className="text-sm text-brand/50">
          Villahermosa · Tabasco, México
        </p>
      </div>
    </footer>
  );
}

function FooterFull() {
  return (
    // theme-tabasco ya se aplica sitio-completo en layout.tsx — no hace
    // falta repetirla aquí (ver el mismo cambio en Navbar.tsx).
    <footer className="bg-brand-dark text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Home size={16} className="text-white" />
              </span>
              <span className="font-display font-bold text-lg">
                {/* coral, no accent — mismo cambio que el wordmark del Navbar,
                    para que "Villahermosa" se vea del mismo color en los dos. */}
                Vive <span className="text-coral">Villahermosa</span>
              </span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed mb-4">
              Encontrar dónde vivir en Tabasco no debería ser difícil. Casas, departamentos,
              terrenos y cuartos en los 17 municipios del estado. Gratis para todos.
            </p>
            <div className="space-y-2">
              <a
                href="tel:+529931234567"
                className="flex items-center gap-2 text-sm text-white/70 hover:text-accent transition-colors"
              >
                <Phone size={14} /> +52 993 123 4567
              </a>
              <a
                href="mailto:hola@vivevillahermosa.mx"
                className="flex items-center gap-2 text-sm text-white/70 hover:text-accent transition-colors"
              >
                <Mail size={14} /> hola@vivevillahermosa.mx
              </a>
              <span className="flex items-center gap-2 text-sm text-white/70">
                <MapPin size={14} /> Villahermosa, Tabasco, México
              </span>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-4">
              Empresa
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/nosotros" className="text-sm text-white/70 hover:text-accent transition-colors">
                  Nosotros
                </Link>
              </li>
              <li>
                <Link href="/publicar" className="text-sm text-white/70 hover:text-accent transition-colors">
                  Publicar propiedad
                </Link>
              </li>
              <li>
                <Link href="/privacidad" className="text-sm text-white/70 hover:text-accent transition-colors">
                  Aviso de privacidad
                </Link>
              </li>
              <li>
                <Link href="/terminos" className="text-sm text-white/70 hover:text-accent transition-colors">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link href="/mapa" className="text-sm text-white/70 hover:text-accent transition-colors">
                  Mapa de propiedades
                </Link>
              </li>
            </ul>

            {/* Mismo lenguaje visual que la barra de features debajo del
                Hero (page.tsx): ícono en placa de color en vez de ícono
                suelto semi-transparente, texto con jerarquía (título +
                descripción) en vez de un párrafo con <strong> inline.
                Mismo azul cielo que el feature "Alerta de inundación" —
                mismo ícono, mismo significado, coherencia entre secciones. */}
            <div className="mt-6 p-3 bg-white/10 rounded-xl flex items-start gap-3">
              <span className="w-9 h-9 rounded-lg bg-sky/15 text-sky flex items-center justify-center flex-shrink-0">
                <Droplets size={16} />
              </span>
              <p className="text-xs text-white/70 leading-relaxed">
                <strong className="block text-white text-sm mb-0.5">¿Sabías?</strong>
                En Tabasco las lluvias importan. Por eso cada propiedad muestra si su zona se inunda. Solo en Vive Villahermosa.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} Vive Villahermosa. Todos los derechos reservados.
          </p>
          <p className="text-xs text-white/40">
            Villahermosa · Tabasco, México
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Footer() {
  const pathname = usePathname();
  // /mapa se queda sin footer a propósito: el mapa ocupa exactamente
  // 100vh menos el navbar (ver h-[calc(100vh-64px)] en MapaClient.tsx);
  // agregar cualquier footer ahí rompería esa cuenta.
  if (pathname.startsWith('/mapa')) return null;
  // Solo Home lleva el footer completo (sitemap + "¿Sabías?" + contacto)
  // — a pedido explícito (2026-08-08), el resto de la plataforma
  // (incluyendo /comparar, /dashboard/*, /admin/*) usa el footer mínimo
  // de /propiedades, no una versión reducida por sección.
  return pathname === '/' ? <FooterFull /> : <FooterMinimal />;
}
