const CACHE = 'themis-v1';
const ASSETS = [
  '/themis/',
  '/themis/index.html',
  '/themis/css/main.css',
  '/themis/js/app.js',
  '/themis/js/api.js',
  '/themis/js/chat.js',
  '/themis/js/i18n.js',
  '/themis/js/storage.js',
  '/themis/js/ui.js',
  '/themis/js/paywall.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first for API, cache first for assets
  if (e.request.url.includes('workers.dev') || e.request.url.includes('railway.app')) {
    return; // Don't cache API calls
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
