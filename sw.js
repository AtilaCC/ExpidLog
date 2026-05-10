/* ════════════════════════════════════════════════════════════
   DOCKCHECK v2 — SERVICE WORKER (PWA Offline-First)
════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'dockcheck-v2';
const CACHE_STATIC = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap',
];

// ── INSTALL: pré-cache dos recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_STATIC.map(url => new Request(url, { mode: 'no-cors' }))))
      .catch(() => {}) // não bloqueia se fontes falharem
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: cache-first para assets, network-first para API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Requests para API Anthropic — sempre network, sem cache
  if (url.hostname === 'api.anthropic.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Google Fonts — cache-first
  if (url.hostname.includes('fonts.')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => cached))
    );
    return;
  }

  // App shell — cache-first com fallback network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => caches.match('./index.html')); // offline fallback
    })
  );
});
