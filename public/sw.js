// Service worker de la PWA — pedido explícito 2026-09-02. Deliberadamente
// mínimo: SIN caché offline (un sitio con datos en vivo — propiedades,
// mapa, mensajes — no gana nada fingiendo que funciona sin internet, y
// cachear mal el catálogo público es peor que no cachear nada: alguien
// vería propiedades viejas/vendidas como si siguieran disponibles). Este
// archivo cubre exactamente 2 cosas reales:
//   1. Un listener de 'fetch' (aunque no haga nada) — Chrome/Android lo
//      exige como parte del criterio de "installability", sin esto no
//      aparece el prompt nativo de instalar.
//   2. Push notifications — 'push' recibe el mensaje del servidor,
//      'notificationclick' abre/enfoca la pestaña correcta al tocar la
//      notificación.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// eslint-disable-next-line no-unused-vars
self.addEventListener('fetch', () => {
  // Sin caché a propósito — ver el comentario de arriba. Este listener
  // solo necesita EXISTIR, no hacer nada (dejar que el navegador maneje
  // la petición normal, sin llamar event.respondWith()).
});

self.addEventListener('push', (event) => {
  // Formato acordado con el backend — ver
  // docs/BACKEND-PUSH-NOTIFICACIONES-02092026.md. Si el payload no es el
  // esperado (o no hay payload), se muestra un aviso genérico en vez de
  // tronar el evento entero — mejor una notificación vacía que ninguna.
  let data = { titulo: 'Vive Villahermosa', mensaje: 'Tienes una notificación nueva.', url: '/dashboard' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* payload no era JSON válido — se queda el genérico */ }

  event.waitUntil(
    self.registration.showNotification(data.titulo, {
      body: data.mensaje,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Si ya hay una pestaña de la app abierta, la reusa (y navega)
        // en vez de abrir una pestaña nueva encima.
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
