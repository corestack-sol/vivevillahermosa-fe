import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Navbar, NavbarFallback } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { defaultMetadata } from '@/lib/seo';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { CompareProvider } from '@/context/CompareContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { CompareBar } from '@/components/property/CompareBar';
import { ADSENSE_CLIENT_ID, ADSENSE_ENABLED } from '@/lib/ads';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = defaultMetadata;

// themeColor vive aparte de `metadata` desde Next 14 (deprecado ahí, ver
// node_modules/next/dist/docs) — controla el color de la barra de estado/
// tabs en Android y del área de la notch en iOS instalado.
export const viewport: Viewport = {
  themeColor: '#1D4A2C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <head>
        {/* Google AdSense — pedido explícito 2026-09-08. Un solo <script>
            global (nunca uno por AdSlot.tsx, cargarlo N veces por página
            rompe el conteo de anuncios de Google), condicionado a que
            existan credenciales reales — mientras NEXT_PUBLIC_ADSENSE_
            CLIENT_ID esté vacío, no se pide nada a Google ni se planta su
            cookie de terceros. `afterInteractive` es la estrategia que la
            propia documentación de AdSense recomienda (no bloquea el
            render inicial). */}
        {ADSENSE_ENABLED && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="min-h-screen flex flex-col bg-page">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200]
                     focus:bg-brand focus:text-white focus:text-sm focus:font-semibold
                     focus:px-4 focus:py-2.5 focus:rounded-xl focus:shadow-lg"
        >
          Saltar al contenido
        </a>
        <AuthProvider>
          <ToastProvider>
            <CompareProvider>
              <FavoritesProvider>
                <Suspense fallback={<NavbarFallback />}><Navbar /></Suspense>
                <main id="main-content" className="flex-1">{children}</main>
                <Footer />
                <CompareBar />
              </FavoritesProvider>
            </CompareProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
