'use client';

import { useEffect } from 'react';
import { ServerCrash } from 'lucide-react';

/**
 * error.tsx (la envoltura normal: Navbar/Footer/AuthProvider en
 * layout.tsx) no cubre un error DENTRO de esa misma envoltura — hoy eso no
 * pasa (layout.tsx no le pide nada al backend directo, solo arma
 * Navbar/Footer, que cargan sus propios datos ya en el navegador) pero se
 * agrega como prevención: la plataforma va a crecer (más servicios, más
 * estados, pagos) y es plausible que el layout raíz termine necesitando un
 * dato real del backend al momento de construir la página. Sin este
 * archivo, ese caso específico caía a la pantalla de error genérica de
 * Next.js, sin marca — mismo motivo por el que existe error.tsx.
 *
 * global-error.tsx SIEMPRE reemplaza TODO, hasta <html>/<body> — no puede
 * asumir que layout.tsx sigue montado (es justo lo que se rompió), así que
 * no reutiliza Navbar/Footer ni ninguna clase de globals.css que dependa
 * de que el layout cargó — estilos inline, autocontenido a propósito.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D7065', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 24px', borderRadius: 16, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ServerCrash size={28} color="#fff" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 12 }}>
            Algo salió mal
          </p>
          <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', marginBottom: 12, letterSpacing: '-0.02em' }}>
            No pudimos cargar Vive Villahermosa
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
            Fue un problema pasajero de nuestro lado. Intenta de nuevo en un momento.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ background: '#fff', color: '#0D7065', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer' }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
