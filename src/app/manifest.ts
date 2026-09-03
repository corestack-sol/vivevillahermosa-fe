import type { MetadataRoute } from 'next';

/**
 * Manifest de la PWA — pedido explícito 2026-09-02 (plataforma
 * instalable en móviles). Íconos generados desde el logo real
 * (scripts/generate-pwa-icons.mjs, no inventados). `display: 'standalone'`
 * es lo que además resuelve, de paso, la barra de dirección visible en
 * iOS que se reportó antes en esta misma sesión — Safari solo la oculta
 * cuando la página se abrió desde un ícono instalado en modo standalone,
 * nunca en una pestaña normal.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vive Villahermosa',
    short_name: 'Vive VHSA',
    description: 'Casas, departamentos, terrenos y locales en renta y venta en Tabasco. Contacto directo con el dueño, sin comisión.',
    start_url: '/',
    display: 'standalone',
    // --color-brand-dark (globals.css) — mismo verde del header/footer,
    // color de fondo mientras carga la app instalada.
    background_color: '#1D4A2C',
    theme_color: '#1D4A2C',
    orientation: 'portrait-primary',
    lang: 'es-MX',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
