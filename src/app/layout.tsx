import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Navbar, NavbarFallback } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { defaultMetadata } from '@/lib/seo';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { CompareProvider } from '@/context/CompareContext';
import { CompareBar } from '@/components/property/CompareBar';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = defaultMetadata;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      {/* theme-tabasco (ver globals.css) aplicada aquí, en la raíz, para
          que TODA la plataforma —páginas públicas y paneles internos
          (/dashboard, /admin)— use la misma paleta. Antes vivía repetida
          en Navbar/Footer/Home/Comparar porque el rediseño era solo para
          Home; ahora que es sitio-completo, un solo punto le gana a
          cuatro copias del mismo condicional de pathname. */}
      <body className="min-h-screen flex flex-col bg-page theme-tabasco">
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
              <Suspense fallback={<NavbarFallback />}><Navbar /></Suspense>
              <main id="main-content" className="flex-1">{children}</main>
              <Footer />
              <CompareBar />
            </CompareProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
