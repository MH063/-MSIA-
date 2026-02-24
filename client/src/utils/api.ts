import axios, { type AxiosRequestConfig, type AxiosResponse, type AxiosRequestHeaders } from 'axios';
import { logger } from './logger';
import { API_CONFIG, AUTH_CONFIG } from '../config';

const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const isProduction = import.meta.env.PROD;

/**
 * 计算开发环境下的网卡IP主机名
 * 优先使用环境变量或本地存储的网卡IP，当页面在 localhost/127.0.0.1 访问时强制切换为该网卡IP
 */
function getDevHost(): string {
  interface ViteEnv { VITE_DEV_HOST?: string }
  const envHost = ((import.meta as unknown as { env?: ViteEnv }).env?.VITE_DEV_HOST) || undefined;
  const localHost = (() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const byLocal = window.localStorage.getItem(API_CONFIG.DEV_HOST_KEY) || window.localStorage.getItem(API_CONFIG.VITE_DEV_HOST_KEY) || undefined;
      if (byLocal && typeof byLocal === 'string' && byLocal.trim()) return byLocal.trim();
      const fromQuery = new URL(window.location.href).searchParams.get('dev_host') || undefined;
      if (fromQuery && typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
      return undefined;
    } catch {
      return undefined;
    }
  })();
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (isLocal) {
    const candidate = (localHost || envHost || '').trim();
    if (candidate) {
      logger.info('[api] 使用网卡IP作为开发主机', { host: candidate });
      return candidate;
    }
    return '127.0.0.1';
  }
  return host;
}

export const API_BASE_URL = isProduction ? API_CONFIG.BASE_URL : `http://${getDevHost()}:${API_CONFIG.DEV_PORT}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: API_CONFIG.TIMEOUT,
});

api.interceptors.request.use((config) => {
  try {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_CONFIG.TOKEN_KEY) : null;
    if (token && typeof token === 'string' && token.trim()) {
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer ${token.trim()}`,
      } as AxiosRequestHeaders;
    }
  } catch {
    // ignore
  }
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
        window.localStorage.removeItem('OPERATOR_TOKEN');
        window.localStorage.removeItem('OPERATOR_ROLE');
        window.localStorage.removeItem('OPERATOR_ID');
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
