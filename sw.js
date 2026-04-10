/* ==========================================
   Service Worker — 離線緩存（快取殼）
   ========================================== */
const CACHE_NAME = 'casino-tracker-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/manifest.json',
  // 外部 CDN（需網絡，但允許緩存加速）
];

// 安裝 → 預緩存靜態資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 只緩存本地資源，不強迫緩存 CDN
      return cache.addAll(STATIC_ASSETS).catch(() => {
        console.warn('SW: 部分資源緩存失敗（正常，CDN 需網絡）');
      });
    })
  );
  self.skipWaiting();
});

// 激活 → 清理舊緩存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 請求攔截 → 網絡優先，快取兜底
self.addEventListener('fetch', event => {
  // 不攔截非 GET
  if (event.request.method !== 'GET') return;

  // 認證相關跳過（避免緩存登入狀態）
  if (event.request.url.includes('/auth/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 成功 → 克隆一份存入緩存
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // 網絡失敗 → 讀緩存
        return caches.match(event.request);
      })
  );
});
