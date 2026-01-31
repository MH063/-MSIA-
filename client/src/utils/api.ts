import axios from 'axios';

const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const isProduction = import.meta.env.PROD;
const defaultDevHosts = ['192.168.66.42', '192.168.137.1'];

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
      const byLocal = window.localStorage.getItem('DEV_HOST') || window.localStorage.getItem('VITE_DEV_HOST') || undefined;
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
      console.log('[api] 使用网卡IP作为开发主机:', candidate);
      return candidate;
    }
    const fallback = defaultDevHosts[0];
    if (fallback) {
      console.warn('[api] 当前使用 localhost 访问开发环境，自动回退到网卡IP:', fallback);
      return fallback;
    }
    console.warn('[api] 当前使用 localhost 访问开发环境，请在地址栏添加 ?dev_host=<网卡IP> 或通过 localStorage 设置 DEV_HOST 以避免被代理软件接管');
  }
  return host;
}

const api = axios.create({
  baseURL: isProduction ? '/api' : `http://${getDevHost()}:4000/api`,
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

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
