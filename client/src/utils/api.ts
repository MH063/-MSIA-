import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { logger } from './logger';
import { API_CONFIG } from '../config';

const isProduction = import.meta.env.PROD;

/**
 * 获取当前页面的主机名
 * 开发环境下使用与页面相同的主机名，确保 Cookie 的 domain 匹配
 */
function getDevHost(): string {
  if (typeof window === 'undefined') return 'localhost';
  try {
    // 使用与页面相同的主机名，确保 Cookie 的 domain 匹配
    return window.location.hostname;
  } catch {
    return 'localhost';
  }
}

export const API_BASE_URL = isProduction ? API_CONFIG.BASE_URL : `http://${getDevHost()}:${API_CONFIG.DEV_PORT}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: API_CONFIG.TIMEOUT,
});

/**
 * CSRF 相关常量与状态
 */
const CSRF_HEADER = 'X-CSRF-Token';
const SESSION_ID_HEADER = 'X-Session-Id';
const CSRF_TTL_MS = 50 * 60 * 1000; // 50分钟，本地比服务端1小时略短，确保及时刷新
let csrfToken: string | null = null;
let lastCsrfAt = 0;

/**
 * 从响应头捕获 CSRF 令牌
 * @param response Axios 响应对象
 */
function captureCsrfFromHeaders(response: AxiosResponse | undefined): void {
  try {
    const token = response?.headers?.['x-csrf-token'] as string | undefined;
    if (token && token.trim()) {
      csrfToken = token.trim();
      lastCsrfAt = Date.now();
      logger.info('[api] 捕获到CSRF令牌');
    }
  } catch {
    // 忽略读取异常
  }
}

/**
 * 主动向后端获取 CSRF 令牌
 * 优先使用 X-Session-Id，提升在生产环境的通过率
 * @param sessionId 可选的会话ID
 */
async function fetchCsrfToken(sessionId?: string): Promise<void> {
  try {
    const url = sessionId ? `/csrf-token?sessionId=${encodeURIComponent(sessionId)}` : '/csrf-token';
    const resp = await refreshApi.get(url, {
      headers: sessionId ? { [SESSION_ID_HEADER]: sessionId } : undefined,
    });
    captureCsrfFromHeaders(resp as AxiosResponse);
    const rawData: unknown = (resp as AxiosResponse).data;
    const directToken =
      (rawData && typeof rawData === 'object' ? (rawData as Record<string, unknown>).token : undefined) as
        | string
        | undefined;
    const nestedToken =
      (rawData &&
        typeof rawData === 'object' &&
        (rawData as Record<string, unknown>).data &&
        typeof (rawData as Record<string, unknown>).data === 'object'
        ? ((rawData as Record<string, unknown>).data as Record<string, unknown>).token
        : undefined) as string | undefined;
    const picked = directToken || nestedToken;
    if (picked && typeof picked === 'string' && !csrfToken) {
      csrfToken = picked;
      lastCsrfAt = Date.now();
      logger.info('[api] 通过接口获取到CSRF令牌');
    }
  } catch (e) {
    logger.warn('[api] 获取CSRF令牌失败', e);
  }
}

/**
 * 判断当前 CSRF 是否新鲜，必要时触发获取
 * @param sessionId 会话ID（若可推断）
 */
async function ensureCsrf(sessionId?: string): Promise<void> {
  const fresh = csrfToken && Date.now() - lastCsrfAt < CSRF_TTL_MS;
  if (fresh) return;
  await fetchCsrfToken(sessionId);
}

/**
 * 安全设置请求头（兼容 AxiosHeaders 与普通对象）
 * @param config Axios 请求配置
 * @param key 头名
 * @param value 值
 */
function setHeader(config: AxiosRequestConfig, key: string, value: string): void {
  const headers = config.headers;
  // 结构化检测：若存在 set 方法，优先使用以保持类型
  const maybeSet = (headers as unknown as { set?: (k: string, v: string) => void })?.set;
  if (typeof maybeSet === 'function') {
    try {
      maybeSet.call(headers, key, value);
      return;
    } catch {
      // fallthrough
    }
  }
  const plain =
    (headers && typeof headers === 'object' ? (headers as Record<string, string>) : {}) as Record<string, string>;
  plain[key] = value;
  config.headers = plain;
}

/**
 * 从请求配置中推断 SessionId
 * @param config Axios 请求配置
 * @returns 推断出的 sessionId（若能推断）
 */
function inferSessionId(config: AxiosRequestConfig): string | undefined {
  try {
    const data = config?.data as Record<string, unknown> | undefined;
    const sid = data && typeof data.sessionId !== 'undefined' ? String(data.sessionId) : '';
    if (sid) return sid;
    const url = String(config.url || '');
    const m = /^\/?sessions\/(\d+)\b/iu.exec(url);
    if (m) return m[1];
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * 请求拦截器
 * Cookie-only 方案：不再从 localStorage 读取 token
 * 认证信息完全通过 Cookie 传递，由浏览器自动处理
 */
api.interceptors.request.use(async (config) => {
  const method = String(config.method || 'get').toUpperCase();
  const url = String(config.url || '');
  logger.info(`[api] 发送请求: ${method} ${url}`);

  // 仅对会修改数据的请求附加 CSRF
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const isCsrfExcluded =
      url.startsWith('/auth/login') ||
      url.startsWith('/auth/register') ||
      url.startsWith('/captcha');
    if (!isCsrfExcluded) {
      // 推断并附加 X-Session-Id
      const sid = inferSessionId(config);
      if (sid) {
        setHeader(config, SESSION_ID_HEADER, sid);
      }
      // 若调用方未显式带 CSRF，则自动补充
      const hasCsrf =
        !!(config.headers && (CSRF_HEADER in (config.headers as Record<string, unknown>)));
      if (!hasCsrf) {
        await ensureCsrf(sid);
        if (csrfToken) {
          setHeader(config, CSRF_HEADER, csrfToken);
        }
      }
    }
  }
  return config;
});

const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: API_CONFIG.TIMEOUT,
});

/**
 * 扩展的可重试 Axios 配置
 */
type RetriableAxiosConfig = AxiosRequestConfig & {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
  _retryCsrf?: boolean;
};

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
}

/**
 * 解包后端响应的双层 data 结构
 * 支持 { success, data } 或 { success, data: { data: T } } 两种形式，返回最终有效负载
 */
export function unwrapData<T>(res: ApiResponse<T | { data: T }>): T | undefined {
  const payload = res?.data as T | { data: T } | undefined;
  if (!payload) return undefined;
  if (typeof payload === 'object' && payload !== null && 'data' in (payload as { data: T })) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function getNestedValue(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  const msg1 = getNestedValue(err, ['response', 'data', 'error', 'message']);
  if (typeof msg1 === 'string' && msg1.trim()) return msg1.trim();

  const msg2 = getNestedValue(err, ['response', 'data', 'message']);
  if (typeof msg2 === 'string' && msg2.trim()) return msg2.trim();

  if (typeof err === 'object' && err !== null) {
    const m = (err as Record<string, unknown>).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }

  return fallback;
}

export async function getBlob(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<Blob>> {
  const merged: AxiosRequestConfig = { ...(config || {}), responseType: 'blob' };
  const resp = await api.get(url, merged);
  return resp as unknown as AxiosResponse<Blob>;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const resp = await refreshApi.post<{ success: boolean }>('/auth/refresh');
      // 捕获刷新响应上的 CSRF 令牌（若后端附带）
      captureCsrfFromHeaders(resp as AxiosResponse);
      const ok = Boolean(resp?.data?.success);
      return ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => {
    logger.info(`[api] 收到响应: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    // 捕获可能下发的 CSRF 令牌
    captureCsrfFromHeaders(response);
    const rt = response.config.responseType;
    if (rt === 'blob' || rt === 'arraybuffer') {
      return response;
    }
    return response.data;
  },
  async (error) => {
    const status = getNestedValue(error, ['response', 'status']);
    const original = axios.isAxiosError(error)
      ? ((error.config || undefined) as RetriableAxiosConfig | undefined)
      : undefined;
    logger.error(`[api] 请求失败: ${original?.method?.toUpperCase()} ${original?.url} - ${status || error.message}`);
    const currentPath = typeof window !== 'undefined' ? String(window.location.pathname || '/') : '/';
    const isLoginPage = currentPath.startsWith('/login');
    const isAuthMe = String(original?.url || '').includes('/auth/me');
    const skipRefresh =
      Boolean(original?._skipAuthRefresh) ||
      String(original?.url || '').includes('/auth/refresh') ||
      (isLoginPage && isAuthMe);
    if (status === 401 && original && !original._retry && !skipRefresh) {
      original._retry = true;
      const ok = await tryRefresh();
      if (ok) {
        return api.request(original);
      }
    }

    // 捕获 CSRF 相关的 403 并重试一次
    const code = String(getNestedValue(error, ['response', 'data', 'error', 'code']) || '');
    const isCsrf = status === 403 && (code.includes('CSRF_TOKEN') || code === 'FORBIDDEN');
    if (isCsrf && original && !original._retryCsrf) {
      original._retryCsrf = true;
      try {
        const sid = inferSessionId(original);
        await ensureCsrf(sid);
        if (csrfToken) {
          setHeader(original, CSRF_HEADER, csrfToken);
        }
        if (sid) {
            setHeader(original, SESSION_ID_HEADER, sid);
        }
        logger.warn('[api] 403/CSRF：已获取令牌并重试一次', { url: original.url });
        return api.request(original);
      } catch (e) {
        logger.error('[api] 403/CSRF 重试失败', e);
      }
    }

    if (status === 401) {
      // 如果请求标记了 _skipAuthRefresh，不要自动跳转，让调用方处理
      if (!original?._skipAuthRefresh) {
        try {
          const p = typeof window !== 'undefined' ? String(window.location.pathname || '/') : '/';
          // 登录页和白名单页面不跳转
          const noRedirectPaths = ['/login', '/register', '/forgot-password', '/email-register', '/security-settings'];
          const shouldRedirect = !noRedirectPaths.some(path => p.startsWith(path));
          if (shouldRedirect) {
            logger.warn('[api] 认证失败(401)，即将跳转到登录页', { path: p });
            window.location.assign(`/login?redirect=${encodeURIComponent(p)}`);
          } else {
            logger.info('[api] 认证失败(401)，但当前页面在白名单中，不自动跳转', { path: p });
          }
        } catch (e) {
          logger.warn('[api] 401处理失败', e);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
