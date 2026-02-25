/**
 * 应用程序配置
 * 集中管理所有配置项，避免硬编码
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * 服务器配置
 */
export const serverConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
};

/**
 * 数据库配置
 */
export const databaseConfig = {
  url: process.env.DATABASE_URL || '',
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
  queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
  ssl: parseBoolEnv('DB_SSL', serverConfig.isProduction),
};

/**
 * CORS配置
 */
export const corsConfig = {
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:8000',
    'http://localhost:8100',
  ],
  maxAge: 86400, // 24小时
};

/**
 * 文件上传配置
 */
export const fileConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  allowedExtensions: ['.txt', '.json', '.pdf', '.doc', '.docx'],
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  knowledgeBaseDir: process.env.KNOWLEDGE_BASE_DIR || './knowledge_base',
};

/**
 * 分页配置
 */
export const paginationConfig = {
  defaultPage: 1,
  defaultLimit: 20,
  maxLimit: 100,
};

/**
 * 诊断配置
 */
export const diagnosisConfig = {
  minConfidenceThreshold: 0.1,
  maxDiagnosesToReturn: 5,
  symptomWeightBase: 0.1,
  redFlagWeightBase: 0.15,
};

/**
 * NLP配置
 */
export const nlpConfig = {
  defaultModel: process.env.NLP_MODEL || 'gpt-3.5-turbo',
  maxTokens: parseInt(process.env.NLP_MAX_TOKENS || '2000', 10),
  temperature: parseFloat(process.env.NLP_TEMPERATURE || '0.7'),
  timeout: parseInt(process.env.NLP_TIMEOUT || '30000', 10),
};

/**
 * 缓存配置
 */
export const cacheConfig = {
  ttl: parseInt(process.env.CACHE_TTL || '3600', 10), // 1小时
  maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
};

/**
 * 日志配置
 */
export const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '30', 10),
};

/**
 * parseIntEnv
 * 读取整型环境变量并回退到默认值
 */
function parseIntEnv(key: string, defaultValue: number): number {
  const raw = String(process.env[key] ?? '').trim();
  if (!raw) {return defaultValue;}
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : defaultValue;
}

/**
 * parseBoolEnv
 * 读取布尔环境变量并回退到默认值
 */
function parseBoolEnv(key: string, defaultValue: boolean): boolean {
  const raw = String(process.env[key] ?? '').trim().toLowerCase();
  if (!raw) {return defaultValue;}
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y') {return true;}
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'n') {return false;}
  return defaultValue;
}

/**
 * parseEnumEnv
 * 读取枚举环境变量并回退到默认值
 */
function parseEnumEnv<T extends string>(key: string, allowed: readonly T[], defaultValue: T): T {
  const raw = String(process.env[key] ?? '').trim();
  if (!raw) {return defaultValue;}
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : defaultValue;
}

/**
 * 登录限流与锁定策略配置（可通过环境变量覆盖）
 */
export const authGuardConfig = {
  loginIpWindowMs: parseIntEnv('AUTH_LOGIN_IP_WINDOW_MS', 60 * 1000),
  loginIpMax: parseIntEnv('AUTH_LOGIN_IP_MAX', 30),

  loginFailWindowMs: parseIntEnv('AUTH_LOGIN_FAIL_WINDOW_MS', 10 * 60 * 1000),
  loginFailWindowMode: parseEnumEnv('AUTH_LOGIN_FAIL_WINDOW_MODE', ['fixed', 'sliding'] as const, 'fixed'),

  loginMaxFailsDoctor: parseIntEnv('AUTH_LOGIN_MAX_FAILS_DOCTOR', 5),
  loginLockMsDoctor: parseIntEnv('AUTH_LOGIN_LOCK_MS_DOCTOR', 10 * 60 * 1000),

  loginMaxFailsAdmin: parseIntEnv('AUTH_LOGIN_MAX_FAILS_ADMIN', 5),
  loginLockMsAdmin: parseIntEnv('AUTH_LOGIN_LOCK_MS_ADMIN', 10 * 60 * 1000),

  registerIpWindowMs: parseIntEnv('AUTH_REGISTER_IP_WINDOW_MS', 10 * 60 * 1000),
  registerIpMax: parseIntEnv('AUTH_REGISTER_IP_MAX', 20),

  allowSlidingTtlRefresh: parseBoolEnv('AUTH_LOGIN_SLIDING_REFRESH_TTL', true),
};

export const authCookieConfig = {
  accessCookieName: String(process.env.AUTH_ACCESS_COOKIE || 'msia_at').trim() || 'msia_at',
  refreshCookieName: String(process.env.AUTH_REFRESH_COOKIE || 'msia_rt').trim() || 'msia_rt',
  sameSite: parseEnumEnv('AUTH_COOKIE_SAMESITE', ['lax', 'strict', 'none'] as const, 'lax'),
  secure: parseBoolEnv('AUTH_COOKIE_SECURE', false), // 开发环境必须为 false
  domain: undefined, // 不设置 domain，让浏览器自动处理
};

export const authSessionConfig = {
  accessCookieMaxAgeMs: parseIntEnv('AUTH_ACCESS_COOKIE_MAXAGE_MS', 15 * 60 * 1000),
  refreshCookieMaxAgeMs: parseIntEnv('AUTH_REFRESH_COOKIE_MAXAGE_MS', 7 * 24 * 60 * 60 * 1000),
  refreshStoreTtlMs: parseIntEnv('AUTH_REFRESH_STORE_TTL_MS', 7 * 24 * 60 * 60 * 1000),
  refreshRotateOnUse: parseBoolEnv('AUTH_REFRESH_ROTATE', true),
};
