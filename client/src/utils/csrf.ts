/**
 * CSRF防护客户端模块
 * 自动管理CSRF令牌的获取和发送
 */

import api from './api';

const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_LOCAL_KEY = 'csrf_token';
const CSRF_EXPIRES_KEY = 'csrf_token_expires';

interface CsrfTokenResponse {
  token: string;
  expiresIn: number;
}

/**
 * 获取存储的CSRF令牌
 */
function getStoredToken(): { token: string; expires: number } | null {
  try {
    const token = localStorage.getItem(CSRF_LOCAL_KEY);
    const expires = localStorage.getItem(CSRF_EXPIRES_KEY);
    
    if (token && expires) {
      return { token, expires: parseInt(expires, 10) };
    }
  } catch {
    // localStorage不可用时忽略
  }
  
  return null;
}

/**
 * 存储CSRF令牌
 */
function storeToken(token: string, expiresIn: number): void {
  try {
    const expires = Date.now() + expiresIn;
    localStorage.setItem(CSRF_LOCAL_KEY, token);
    localStorage.setItem(CSRF_EXPIRES_KEY, expires.toString());
  } catch {
    // localStorage不可用时忽略
  }
}

/**
 * 清除存储的CSRF令牌
 */
function clearStoredToken(): void {
  try {
    localStorage.removeItem(CSRF_LOCAL_KEY);
    localStorage.removeItem(CSRF_EXPIRES_KEY);
  } catch {
    // localStorage不可用时忽略
  }
}

/**
 * 检查令牌是否过期
 */
function isTokenExpired(expires: number): boolean {
  return Date.now() >= expires;
}

/**
 * 从服务器获取新的CSRF令牌
 */
async function fetchNewToken(): Promise<string | null> {
  try {
    const response = await api.get('/csrf-token');
    
    if (response.success && response.data) {
      const data = response.data as CsrfTokenResponse;
      storeToken(data.token, data.expiresIn);
      return data.token;
    }
  } catch (error) {
    console.warn('[CSRF] 获取令牌失败:', error);
  }
  
  return null;
}

/**
 * 获取有效的CSRF令牌
 * 如果本地令牌有效则返回，否则从服务器获取新令牌
 */
export async function getCsrfToken(): Promise<string | null> {
  const stored = getStoredToken();
  
  if (stored && !isTokenExpired(stored.expires)) {
    return stored.token;
  }
  
  clearStoredToken();
  return fetchNewToken();
}

/**
 * 为请求添加CSRF令牌头
 */
export async function addCsrfHeader(headers: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getCsrfToken();
  
  if (token) {
    headers[CSRF_HEADER] = token;
  }
  
  return headers;
}

/**
 * CSRF令牌刷新
 * 在令牌即将过期时主动刷新
 */
export async function refreshTokenIfNeeded(): Promise<void> {
  const stored = getStoredToken();
  
  // 如果令牌将在5分钟内过期，主动刷新
  if (stored && stored.expires - Date.now() < 5 * 60 * 1000) {
    await fetchNewToken();
  }
}

/**
 * 初始化CSRF保护
 * 在应用启动时调用
 */
export async function initCsrfProtection(): Promise<void> {
  await getCsrfToken();
  
  // 定期检查并刷新令牌
  setInterval(refreshTokenIfNeeded, 60 * 1000);
}

/**
 * 为fetch请求添加CSRF保护的包装函数
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers || {});
  
  const token = await getCsrfToken();
  if (token) {
    headers.set(CSRF_HEADER, token);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

export default {
  getCsrfToken,
  addCsrfHeader,
  refreshTokenIfNeeded,
  initCsrfProtection,
  fetchWithCsrf,
};
