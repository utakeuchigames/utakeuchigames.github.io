// service-worker.js
const CACHE_NAME = 'timer-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './main.js',
  './manifest.json',
  './icon.ico',
  './assets/'
];

// 💾 インストール時にキャッシュ作成
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// ♻️ 古いキャッシュを削除（更新対応）
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(name => {
        if (name !== CACHE_NAME) return caches.delete(name);
      }))
    )
  );
  self.clients.claim();
});

// 🌐 通信時：キャッシュ優先で取得
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response =>
      response || fetch(event.request)
    )
  );
});
