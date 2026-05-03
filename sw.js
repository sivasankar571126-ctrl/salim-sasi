/* ============================================================
   sw.js  —  SALIM SOS Service Worker
   Handles push notifications when phone is locked/sleeping
   Place this file at ROOT of your project (same level as index.html)
   ============================================================ */

var CACHE = 'salim-sos-v3';
var STATIC = ['/', '/index.html', '/icons/salim.jpg', '/icons/icon-192.png'];

/* Install */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return Promise.allSettled(STATIC.map(function(u) {
        return c.add(u).catch(function() {});
      }));
    }).then(function() { return self.skipWaiting(); })
  );
});

/* Activate */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

/* Fetch — serve from cache when offline */
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com')) {
    e.respondWith(fetch(e.request).catch(function() { return caches.match(e.request); }));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(res) {
        if (res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return res;
      });
    }).catch(function() { return caches.match('/index.html'); })
  );
});

/* ============================================================
   PUSH — fires even when phone is locked / app is closed
   ============================================================ */
self.addEventListener('push', function(e) {
  var data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (_) {
    data = { title: 'SALIM SOS', body: 'EMERGENCY! Salim needs help NOW!' };
  }

  var title   = data.title   || '🚨 SALIM SOS EMERGENCY';
  var body    = data.body    || 'Salim has activated SOS! Open the app immediately!';
  var lat     = data.latitude  || '';
  var lng     = data.longitude || '';
  var mapsUrl = lat && lng
    ? 'https://maps.google.com/?q=' + lat + ',' + lng
    : 'https://salim-sos-emer.vercel.app/?role=guardian';

  var options = {
    body:    body,
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    image:   '/icons/salim.jpg',
    vibrate: [800,150,800,150,800,400,200,100,200,100,200,400,800,200,800,200,800],
    sound:   '/icons/alarm.mp3',
    tag:     'sos-emergency',
    renotify: true,
    requireInteraction: true,          /* stays on screen until dismissed */
    actions: [
      { action: 'open',  title: '🗺 Open App & Map' },
      { action: 'call',  title: '📞 Call Salim' },
    ],
    data: { url: mapsUrl, phone: '+917010733249', lat: lat, lng: lng }
  };

  e.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* Notification click handler */
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var data = e.notification.data || {};

  var targetUrl = data.url || 'https://salim-sos-emer.vercel.app/?role=guardian';
  if (e.action === 'call') {
    targetUrl = 'tel:' + (data.phone || '+917010733249');
  }

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes('salim-sos') && 'focus' in list[i]) {
          return list[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

/* Push subscription change */
self.addEventListener('pushsubscriptionchange', function(e) {
  e.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true })
      .then(function(sub) { console.log('[SW] Subscription refreshed'); })
  );
});
