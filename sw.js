// pico service worker — push notifications + offline cache

var CACHE = 'pico-v2';
// HTML 파일은 캐시하지 않음 (자주 업데이트되므로)
var CORE = [
  '/manifest.json', '/img/goddess/goddess.png', '/img/goddess/goddess-app.png',
  '/img/goddess/goddess-badge.png', '/img/goddess/goddess-maskable.png',
  '/pico-icons.css', '/support-widget.js'
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.allSettled(CORE.map(function(url) {
        return c.add(url).catch(function() {});
      }));
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  // POST 등 캐시 불가 요청은 pass-through
  if (req.method !== 'GET') return;
  // API 요청은 캐시 안 함
  var url = req.url;
  if (url.indexOf('workers.dev') !== -1 || url.indexOf('vercel.app') !== -1 ||
      url.indexOf('supabase.co') !== -1 || url.indexOf('kakao') !== -1) return;

  e.respondWith(
    (function() {
      // HTML 파일은 항상 네트워크 우선 (자주 업데이트)
      var isHtml = url.match(/\.(html)(\?|$)/) || req.mode === 'navigate';
      if (isHtml) {
        return fetch(req).catch(function() {
          return caches.match(req) || caches.match('/index.html');
        });
      }
      // 이미지·CSS 등 정적 자원은 캐시 우선
      return caches.match(req).then(function(cached) {
        var networkFetch = fetch(req).then(function(res) {
          if (res && res.status === 200 && res.type !== 'opaque') {
            var clone = res.clone();
            caches.open(CACHE).then(function(c) { c.put(req, clone); });
          }
          return res;
        });
        return cached || networkFetch;
      });
    })().catch(function() {
      // 오프라인 + 캐시 미스: 네비게이션 요청이면 index.html 반환
      if (req.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});

// ── 푸시 알림 ──────────────────────────────────────────────
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}
  var title = data.title || '피코랩';
  var options = {
    body: data.body || '오늘의 운세 메시지가 도착했어요.',
    icon: '/img/goddess/goddess.png',
    badge: '/img/goddess/goddess-badge.png',
    data: { url: data.url || 'https://picolab.kr' },
    vibrate: [200, 100, 200]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : 'https://picolab.kr';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url === url && 'focus' in c) return c.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
