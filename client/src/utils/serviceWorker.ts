/**
 * Service Worker 注册和管理工具
 * 提供 PWA 离线支持、后台同步和推送通知功能
 */

import { logger } from './logger';

/**
 * Service Worker 配置选项
 */
interface SWConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

/**
 * 注册 Service Worker
 */
export function registerServiceWorker(config?: SWConfig): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = '/sw.js';

      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          logger.debug('[SW] Service Worker registered');

          // 监听更新
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) {
              return;
            }

            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // 有新版本可用
                  logger.info('[SW] New content available, please refresh');
                  config?.onUpdate?.(registration);
                } else {
                  // 首次安装完成
                  logger.info('[SW] Content cached for offline use');
                  config?.onSuccess?.(registration);
                }
              }
            };
          };
        })
        .catch((error) => {
          logger.error('[SW] Service Worker registration failed', error);
        });
    });

    // 监听网络状态变化
    window.addEventListener('online', () => {
      logger.info('[SW] Network is online');
      config?.onOnline?.();
    });

    window.addEventListener('offline', () => {
      logger.warn('[SW] Network is offline');
      config?.onOffline?.();
    });
  }
}

/**
 * 注销 Service Worker
 */
export async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.unregister();
    logger.info('[SW] Service Worker unregistered');
  }
}

/**
 * 更新 Service Worker
 */
export async function updateServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    logger.debug('[SW] Service Worker updated');
  }
}

/**
 * 跳过等待并激活新版本
 */
export async function skipWaiting(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * 清除所有缓存
 */
export async function clearCache(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'CLEAR_CACHE' });
  }
}

/**
 * 获取 Service Worker 版本
 */
export async function getServiceWorkerVersion(): Promise<string | null> {
  if ('serviceWorker' in navigator) {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        resolve(event.data?.version || null);
      };

      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
      });
    });
  }
  return null;
}

/**
 * 请求后台同步
 */
export async function requestBackgroundSync(tag: string): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      // @ts-expect-error Background Sync API is not yet in types
      await registration.sync.register(tag);
      logger.debug('[SW] Background sync registered', { tag });
    }
  }
}

/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    logger.warn('[SW] This browser does not support notifications');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  logger.debug('[SW] Notification permission', { permission });
  return permission;
}

/**
 * 显示本地通知
 */
export function showNotification(title: string, options?: NotificationOptions): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, options);
    });
  }
}

/**
 * 订阅推送通知
 */
export async function subscribeToPushNotifications(
  publicVapidKey: string
): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    logger.warn('[SW] Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
    });

    logger.info('[SW] Push subscription successful');
    return subscription;
  } catch (error) {
    logger.error('[SW] Push subscription failed', error);
    return null;
  }
}

/**
 * 取消推送订阅
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      logger.info('[SW] Push unsubscription successful');
      return true;
    }
    return false;
  } catch (error) {
    logger.error('[SW] Push unsubscription failed', error);
    return false;
  }
}

/**
 * 检查网络状态
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * 监听网络状态变化
 */
export function watchNetworkStatus(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  // 返回取消监听的函数
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

/**
 * 将 base64 URL 转换为 Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * 检查 PWA 是否已安装
 */
export function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error Standalone property is non-standard
    window.navigator.standalone === true;
}

/**
 * 检查是否支持 PWA 安装
 */
export function canInstallPWA(): boolean {
  return 'BeforeInstallPromptEvent' in window;
}

/**
 * 延迟提示 PWA 安装
 */
let deferredPrompt: Event | null = null;

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 阻止默认提示
    e.preventDefault();
    // 保存事件以便稍后触发
    deferredPrompt = e;
    logger.debug('[SW] Install prompt captured');
  });
}

/**
 * 显示 PWA 安装提示
 */
export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }
  
  // @ts-expect-error BeforeInstallPromptEvent prompt method
  deferredPrompt.prompt();
  // @ts-expect-error BeforeInstallPromptEvent userChoice property
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;

  logger.info('[SW] Install prompt shown', { outcome });
  return outcome === 'accepted';
}

export default {
  register: registerServiceWorker,
  unregister: unregisterServiceWorker,
  update: updateServiceWorker,
  skipWaiting,
  clearCache,
  getVersion: getServiceWorkerVersion,
  requestBackgroundSync,
  requestNotificationPermission,
  showNotification,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isOnline,
  watchNetworkStatus,
  isPWAInstalled,
  canInstallPWA,
  captureInstallPrompt,
  showInstallPrompt,
};
