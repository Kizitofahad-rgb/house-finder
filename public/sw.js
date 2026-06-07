const CACHE_NAME = 'housefinder-cache-v2';

// 1. Force the updated service worker to activate immediately without waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. Clear out all old caches completely on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          console.log('Clearing old application cache:', cache);
          return caches.delete(cache);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Network-first strategy to guarantee your local code updates read live
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If the network works perfectly, return it directly
        return response;
      })
      .catch(() => {
        // Only look at local fallback caches if you are completely offline
        return caches.match(event.request);
      })
  );
});