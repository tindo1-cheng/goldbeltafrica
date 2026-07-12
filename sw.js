/* GoldBelt Africa — offline-ready service worker */
const CACHE = 'goldbelt-v3';
const SHELL = ['/', '/index.html', '/data.js', '/manifest.json', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network-first for the app shell (so updates arrive), cache-first for map tiles and fonts */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  const isTileOrFont = /basemaps\.cartocdn\.com|arcgisonline\.com|fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.host);

  if (isTileOrFont) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(hit => hit || fetch(e.request).then(res => {
          if (res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(() => hit))
      )
    );
    return;
  }

  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('/index.html')))
    );
  }
});
