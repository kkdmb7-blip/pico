// pico service worker — push notification handler

self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}
  var title = data.title || '🔮 피코랩';
  var options = {
    body: data.body || '오늘의 운세 메시지가 도착했어요.',
    icon: '/img/goddess.png',
    badge: '/img/goddess-badge.png',
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
