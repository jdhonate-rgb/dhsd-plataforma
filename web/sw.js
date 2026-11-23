// Service worker mínimo (v1): guarda la "cáscara" de la app para abrir rápido.
// Nunca guarda respuestas de la base de datos ni de Supabase.
const V = 'dhsd-plataforma-v1';
const CASCARA = ['./', 'index.html', 'style.css', 'app.js', 'lib.js', 'datos.js', 'config.js', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(CASCARA))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((ca) => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
