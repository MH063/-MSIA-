/**
 * 前端全局配置
 * 集中管理所有硬编码的配置项
 */

// API 配置
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
  DEV_PORT: 4000,
  DEV_HOST_KEY: 'DEV_HOST',
  VITE_DEV_HOST_KEY: 'VITE_DEV_HOST',
  TIMEOUT: 30000,
} as const;

// 缓存配置
export const CACHE_CONFIG = {
  SYMPTOM_MAPPINGS: {
    STALE_TIME: 5 * 60 * 1000, // 5分钟
    CACHE_TIME: 10 * 60 * 1000, // 10分钟
  },
  KNOWLEDGE_LIST: {
    STALE_TIME: 2 * 60 * 1000, // 2分钟
    CACHE_TIME: 5 * 60 * 1000, // 5分钟
  },
  DIAGNOSIS_LIST: {
    STALE_TIME: 10 * 60 * 1000, // 10分钟
    CACHE_TIME: 30 * 60 * 1000, // 30分钟
  },
} as const;

// 验证码配置
export const CAPTCHA_CONFIG = {
  AUTO_REFRESH_INTERVAL: 30000, // 30秒自动刷新
  TTL_MS: 5 * 60 * 1000, // 5分钟有效期
} as const;

// 开发服务器配置
export const DEV_SERVER_CONFIG = {
  PORT: 8000,
  HOST: '0.0.0.0',
} as const;

// 分页配置
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;
