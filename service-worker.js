// service-worker.js
const CACHE_NAME = 'ultraabox-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/beepbox_editor.js',
  '/beepbox_worker.js',
  '/style.css',
  // 必要なファイルをここに追加（scripts/, images/ など）
];

// インストール時にキャッシュを作成
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// リクエスト時：キャッシュ優先で応答
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
