// SW v9 - always fresh, kills old versions
const CACHE = 'ff-v15';
const ASSETS = ['./','./index.html','./app.css','./db.js','./charts.js','./app.js','./manifest.json'];

self.addEventListener('install', e => {
  self.skipWaiting(); // activate immediately
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(ASSETS.map(u => c.add(u).catch(() => {})))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network first for app files (always get latest)
  // Cache fallback for offline
  e.respondWith(
    fetch(e.request, {cache: 'no-cache'}).then(r => {
      if (!r || r.status !== 200 || r.type === 'opaque') return r;
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
