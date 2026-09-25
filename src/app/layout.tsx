import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Navbar, NavbarFallback } from '@/components/layout/Navbar';
import { TopProgressBar } from '@/components/layout/TopProgressBar';
import { Footer } from '@/components/layout/Footer';
import { defaultMetadata } from '@/lib/seo';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { CompareProvider } from '@/context/CompareContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { CompareBar } from '@/components/property/CompareBar';
import { PushOnboarding } from '@/components/push/PushOnboarding';

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
      <body className="min-h-screen flex flex-col bg-page">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200]
                     focus:bg-brand focus:text-white focus:text-sm focus:font-semibold
                     focus:px-4 focus:py-2.5 focus:rounded-xl focus:shadow-lg"
        >
          Saltar al contenido
        </a>
        {/* Barra de progreso de navegación — pedido explícito 2026-09-13,
            "como en la aplicación": indicador arriba del header mientras se
            navega a otra página. Fuera de los providers (no necesita
            ninguno), Suspense propio por el mismo motivo que Navbar
            (useSearchParams). */}
        <Suspense fallback={null}><TopProgressBar /></Suspense>
        <AuthProvider>
          <ToastProvider>
            <CompareProvider>
              <FavoritesProvider>
                <Suspense fallback={<NavbarFallback />}><Navbar /></Suspense>
                <main id="main-content" className="flex-1">{children}</main>
                <Footer />
                <CompareBar />
                {/* Pide permiso de push, con explicación, la primera vez que se abre la app instalada en el celular. */}
                <PushOnboarding />
              </FavoritesProvider>
            </CompareProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
