const CACHE_NAME = 'af-tracker-v1';
const ASSETS = [
  '/static/css/style.css',
  '/static/css/tracker.css',
  '/static/js/tracker.js',
  '/static/images/logo.png',
  '/static/images/icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', e => {
  // Always fetch API calls from network
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Cache-first for static assets, network-first for pages
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
