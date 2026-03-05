const CACHE = 'quilex-v3';
const ASSETS = ['/', '/index.html', '/dashboard.html', '/quilex-login.html', '/profile-setup.html', '/image-gen.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {title:'QUILEX AI', body:'New update available!'};
  e.waitUntil(self.registration.showNotification(data.title || 'QUILEX AI', {
    body: data.body || 'Check out what's new!',
    icon: '/logo-192.png',
    badge: '/logo-192.png'
  }));
});
