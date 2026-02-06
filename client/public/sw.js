/**
 * Service Worker for MSIA PWA
 * 提供离线缓存、后台同步和推送通知支持
 */

const CACHE_NAME = 'msia-v1';
const STATIC_CACHE = 'msia-static-v1';
const DYNAMIC_CACHE = 'msia-dynamic-v1';
const IMAGE_CACHE = 'msia-images-v1';

// 需要预缓存的核心资源
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// 缓存策略配置
const CACHE_STRATEGIES = {
  // 静态资源 - 缓存优先
  static: {
    pattern: /\.(js|css|woff2?|json)$/,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30天
  },
  // 图片资源 - 缓存优先，带过期
  images: {
    pattern: /\.(png|jpg|jpeg|gif|svg|webp)$/,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
  },
  // API 请求 - 网络优先
  api: {
    pattern: /\/api\//,
    maxAge: 5 * 60 * 1000, // 5分钟
  },
};

// 安装事件 - 预缓存核心资源
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching assets...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Pre-cache complete');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Pre-cache failed:', err);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return (
                name.startsWith('msia-') &&
                name !== STATIC_CACHE &&
                name !== DYNAMIC_CACHE &&
                name !== IMAGE_CACHE
              );
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// 获取请求策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') {
    return;
  }

  // 跳过浏览器扩展请求
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
    return;
  }

  // 根据请求类型选择策略
  if (CACHE_STRATEGIES.api.pattern.test(url.pathname)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (CACHE_STRATEGIES.images.pattern.test(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
  } else if (CACHE_STRATEGIES.static.pattern.test(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else {
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

/**
 * 缓存优先策略
 */
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // 检查缓存是否过期
    const dateHeader = cached.headers.get('sw-cache-date');
    if (dateHeader) {
      const age = Date.now() - parseInt(dateHeader, 10);
      const maxAge =
        cacheName === IMAGE_CACHE
          ? CACHE_STRATEGIES.images.maxAge
          : CACHE_STRATEGIES.static.maxAge;

      if (age < maxAge) {
        return cached;
      }
    } else {
      return cached;
    }
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cache-date', Date.now().toString());

      const modifiedResponse = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers,
      });

      cache.put(request, modifiedResponse);
    }
    return networkResponse;
  } catch (error) {
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * 网络优先策略
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    // 返回离线页面
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

/**
 * 过时重新验证策略
 */
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// 后台同步事件
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-interviews') {
    event.waitUntil(syncInterviews());
  }
});

/**
 * 同步问诊数据
 */
async function syncInterviews() {
  // 从 IndexedDB 获取待同步的数据
  // 这里可以实现离线数据的同步逻辑
  console.log('[SW] Syncing interviews...');
}

// 推送通知事件
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || '您有新的消息',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(data.title || 'MSIA', options));
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data;
  let url = '/';

  if (notificationData && notificationData.url) {
    url = notificationData.url;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 查找已打开的窗口
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // 打开新窗口
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// 消息事件 - 与主线程通信
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'GET_VERSION':
        event.ports[0].postMessage({ version: CACHE_NAME });
        break;
      case 'CLEAR_CACHE':
        event.waitUntil(
          caches.keys().then((cacheNames) => {
            return Promise.all(cacheNames.map((name) => caches.delete(name)));
          })
        );
        break;
    }
  }
});

console.log('[SW] Service Worker loaded');
