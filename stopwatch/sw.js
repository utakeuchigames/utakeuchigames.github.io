// sw.js
const CACHE_NAME = 'stopwatch-cache-v5'; // ← 更新時に番号を上げる
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './script.js',
  './icon.svg',
  // === assets ===
  './assets/1eff2d687714a758e61ce97e570895ed.svg',
  './assets/2d371f75ed8be31d37fa34d6edeb3db.svg',
  './assets/3339a2953a3bf62bb80e54ff575dbced.svg',
  './assets/405ceeea374177631d8a703437dad7d9.svg',
  './assets/47c991e57f316bee0265911970363349.svg',
  './assets/480ecb8552c9d8f785b647e134f44a.svg',
  './assets/5e52f56fd2ab227560df33be15772f24.svg',
  './assets/5ff9d17c62ad76e06dcc49972ac61bc.svg',
  './assets/6f84d804a1b3022fb7577ed67405aa71.svg',
  './assets/77b2756ea1d37dbb91abe29e9164d1b.svg',
  './assets/786cba44bc5ae8c305e7eb853fe2c51.svg',
  './assets/83a978d4cb6f3b7623b4ddfefb74367.wav', // ← WAVファイルもOK
  './assets/a497c78db889fe8733096934d74a626.svg',
  './assets/a4af354a24a8bd01fa73f3a5bdc57ef1.svg',
  './assets/cd215140531fdfffb22240e0ec5ed84a.svg',
  './assets/cda9b644a0cf0a970beda67d525a18a8.svg',
  './assets/e8a32240047939bfd3ab75ac1074217.svg',
  './assets/ecbbd2e12bb78bd5470796c6cf01a85.svg',
  './assets/f1a276d2675957ee1903b23be2c23a8b.svg',
  './assets/fcec575b3d3ed75a9941ceb6e9692.svg',
  './assets/project.json',
];

// 🪴 install: キャッシュ作成
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// 🧹 activate: 古いキャッシュ削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('🧹 Deleting old cache:', key);
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// 🌐 fetch: ネット優先＋変更検知＋キャッシュ更新
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        caches.open(CACHE_NAME).then(cache => {
          cache.match(event.request).then(cachedResponse => {
            if (!cachedResponse) {
              // 新規ファイル
              notifyClients('新しいファイルをキャッシュしました');
            } else {
              // 変更検知（サイズ・日付で比較）
              const newDate = networkResponse.headers.get('last-modified');
              const oldDate = cachedResponse.headers.get('last-modified');
              if (newDate && newDate !== oldDate) {
                notifyClients('変更点があったのでキャッシュを更新しました');
              }
            }
            cache.put(event.request, networkResponse.clone());
          });
        });
        return networkResponse;
      })
      .catch(() => caches.match(event.request)) // オフライン時はキャッシュから取得
  );
});

// クライアント（ページ側）に通知
function notifyClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({
      type: 'UPDATE_ALERT',
      message: message
    }));
  });
}
