const CACHE_NAME = 'checklist-campo-v9';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/db.js',
  './js/state.js',
  './js/geo.js',
  './js/photos.js',
  './js/sync.js',
  './js/history.js',
  './js/pdf.js',
  './js/ui.js',
  './js/templates.js',
  './js/signature.js',
  './js/share.js',
  './js/admin.js',
  './js/app.js'
];

const CDN_ASSETS = [
  'https://unpkg.com/dexie@4.0.11/dist/dexie.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js'
];

// Install — pre-cache static assets (critical) + CDN assets (optional)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Static assets are critical — must all succeed
      await cache.addAll(STATIC_ASSETS);

      // CDN assets are optional — individual failures don't break install
      const cdnResults = await Promise.allSettled(
        CDN_ASSETS.map(url =>
          fetch(url).then(res => {
            if (res.ok) cache.put(url, res);
          })
        )
      );

      const failed = cdnResults.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        console.warn('[SW] CDN assets não cacheados:', failed.length);
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Removing old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

// Allow app.js to force skipWaiting on new SW
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch — strategy per resource type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // HTML — Network First
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // CSS & JS — Network First (always get latest code when online)
  if (request.destination === 'style' || request.destination === 'script' ||
      url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Images — Stale While Revalidate
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|ico)$/)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Fonts — Cache First
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // CDN — Cache First
  if (url.hostname === 'unpkg.com' || url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default — Network First
  event.respondWith(networkFirst(request));
});

// ===== STRATEGIES =====

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('./index.html');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await networkPromise || new Response('Offline', { status: 503 });
}
