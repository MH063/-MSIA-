import axios, { type AxiosRequestConfig, type AxiosResponse, type AxiosRequestHeaders } from 'axios';
import { logger } from './logger';
import { API_CONFIG, AUTH_CONFIG } from '../config';

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
 * 请求拦截器
 * Cookie-only 方案：不再从 localStorage 读取 token
 * 认证信息完全通过 Cookie 传递，由浏览器自动处理
 */
api.interceptors.request.use((config) => {
  return config;
});

const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: API_CONFIG.TIMEOUT,
});

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
    const rt = response.config.responseType;
    if (rt === 'blob' || rt === 'arraybuffer') {
      return response;
    }
    return response.data;
  },
  async (error) => {
    const status = getNestedValue(error, ['response', 'status']);
    const original = axios.isAxiosError(error)
      ? ((error.config || undefined) as (AxiosRequestConfig & { _retry?: boolean; _skipAuthRefresh?: boolean }) | undefined)
      : undefined;
    const skipRefresh = Boolean(original?._skipAuthRefresh) || String(original?.url || '').includes('/auth/refresh');
    if (status === 401 && original && !original._retry && !skipRefresh) {
      original._retry = true;
      const ok = await tryRefresh();
      if (ok) {
        return api.request(original);
      }
    }

    if (status === 401) {
      try {
        const p = typeof window !== 'undefined' ? String(window.location.pathname || '/') : '/';
        logger.warn('[api] 认证失败(401)，即将跳转到登录页', { path: p });
        if (!p.startsWith('/login')) {
          window.location.assign(`/login?redirect=${encodeURIComponent(p)}`);
        }
      } catch (e) {
        logger.warn('[api] 401处理失败', e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
