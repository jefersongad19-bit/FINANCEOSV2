const CACHE='ff-v8';
const ASSETS=['./','./index.html','./app.css','./db.js','./charts.js','./app.js','./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>Promise.allSettled(ASSETS.map(u=>c.add(u).catch(()=>{}))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
      .then(()=>self.clients.matchAll().then(cls=>cls.forEach(c=>c.postMessage({type:'RELOAD'}))))
  );
});

self.addEventListener('fetch',e=>{
  const url = e.request.url;
  
  // External fonts/scripts: cache first
  if(url.includes('fonts.goog') || url.includes('fonts.gstatic') || url.includes('cdnjs')){
    e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{
      if(r&&r.status===200){ const cl=r.clone(); caches.open(CACHE).then(ca=>ca.put(e.request,cl)); }
      return r;
    }).catch(()=>c)));
    return;
  }
  
  // App files: network first, cache fallback (always fresh)
  e.respondWith(
    fetch(e.request).then(r=>{
      if(!r||r.status!==200||r.type==='opaque') return r;
      const cl=r.clone(); caches.open(CACHE).then(ca=>ca.put(e.request,cl));
      return r;
    }).catch(()=>caches.match(e.request))
  );
});
