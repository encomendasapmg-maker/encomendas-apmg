// Service worker do app: guarda os arquivos para abrir sem internet e mostra
// as notificações enviadas pela rotina agendada (GitHub Actions → Firebase
// Cloud Messaging).
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { notification: { title: 'Encomendas', body: event.data?.text() ?? '' } };
  }
  // O Firebase Cloud Messaging pode entregar o texto em "notification" ou em "data".
  const extra = dados.data || {};
  const n = dados.notification || { title: extra.title, body: extra.body };
  event.waitUntil(
    self.registration.showNotification(n.title || 'Encomendas', {
      body: n.body || '',
      icon: '/icone.svg',
      badge: '/icone.svg',
      tag: extra.tag || undefined,
      data: { url: extra.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if ('focus' in j) {
          j.navigate(url);
          return j.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
