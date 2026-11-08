// Minimal PWA service worker for "Luyện Tiếng Anh".
// Purpose: make the app installable ("Add to Home Screen") + an offline shell.
// Deliberately conservative about caching: it NEVER stores page navigations
// (those go through the class-code + face-checkin gates on the server — caching
// them could leak gated content offline). It caches only the app shell "/" and
// immutable static assets (_next, icons). Navigations are network-first with an
// offline fallback to the cached shell.
const CACHE = 'eg-shell-v1';
const CORE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Page navigations: always try the network (respects gating/redirects);
  // fall back to the cached shell only when offline. Never cache the response.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }

  // Immutable static assets: cache-first, populate on first fetch.
  const isStatic = url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icons/') || CORE.includes(url.pathname);
  if (!isStatic) return; // everything else (APIs, content) goes straight to network
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
