/**
 * CSRF防护中间件
 * 为所有涉及数据修改的请求添加CSRF令牌验证
 * 支持Redis分布式存储
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { secureLogger } from '../utils/secureLogger';
import { getRedisClient } from '../utils/redis-client';
import { serverConfig } from '../config';

/**
 * CSRF令牌配置
 */
const CSRF_CONFIG = {
  tokenLength: 32,
  headerName: 'X-CSRF-Token',
  cookieName: 'csrf_token',
  expiresIn: 3600000, // 1小时
  redisKeyPrefix: 'csrf:',
};

/**
 * 内存存储（本地开发或Redis不可用时的降级方案）
 */
const memoryTokenStore = new Map<string, { token: string; expires: number }>();

/**
 * 生成CSRF令牌
 * @returns CSRF令牌
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
}

/**
 * 创建CSRF令牌并存储
 * @param sessionId 会话ID
 * @returns CSRF令牌
 */
export async function createCsrfToken(sessionId: string): Promise<string> {
  const token = generateCsrfToken();
  const expires = Date.now() + CSRF_CONFIG.expiresIn;
  const key = `${CSRF_CONFIG.redisKeyPrefix}${sessionId}`;
  
  // 优先使用Redis
  const redis = await getRedisClient();
  if (redis) {
    try {
      const ttlSeconds = Math.ceil(CSRF_CONFIG.expiresIn / 1000);
      await redis.set(key, JSON.stringify({ token, expires }), { EX: ttlSeconds });
      secureLogger.debug('[CSRF] Token已存储到Redis', { sessionId: sessionId.substring(0, 8) + '...' });
    } catch (err) {
      secureLogger.warn('[CSRF] Redis存储失败，降级到内存存储', { error: err instanceof Error ? err.message : String(err) });
      memoryTokenStore.set(sessionId, { token, expires });
    }
  } else {
    // Redis不可用，使用内存存储
    memoryTokenStore.set(sessionId, { token, expires });
  }
  
  // 清理过期令牌（内存）
  cleanupExpiredTokens();
  
  return token;
}

/**
 * 验证CSRF令牌
 * @param sessionId 会话ID
 * @param token 待验证的令牌
 * @returns 是否有效
 */
export async function verifyCsrfToken(sessionId: string, token: string): Promise<boolean> {
  const key = `${CSRF_CONFIG.redisKeyPrefix}${sessionId}`;
  
  // 优先从Redis获取
  const redis = await getRedisClient();
  if (redis) {
    try {
      const stored = await redis.get(key);
      if (!stored) {
        secureLogger.debug('[CSRF] Redis中未找到Token', { sessionId: sessionId.substring(0, 8) + '...' });
        return false;
      }
      
      const parsed = JSON.parse(stored) as { token: string; expires: number };
      if (Date.now() > parsed.expires) {
        await redis.del(key);
        return false;
      }
      
      return parsed.token === token;
    } catch (err) {
      secureLogger.warn('[CSRF] Redis读取失败，尝试内存存储', { error: err instanceof Error ? err.message : String(err) });
      // 降级到内存存储验证
    }
  }
  
  // 从内存存储获取
  const stored = memoryTokenStore.get(sessionId);
  if (!stored) {
    return false;
  }
  
  if (Date.now() > stored.expires) {
    memoryTokenStore.delete(sessionId);
    return false;
  }
  
  return stored.token === token;
}

/**
 * 删除CSRF令牌
 * @param sessionId 会话ID
 */
export async function deleteCsrfToken(sessionId: string): Promise<void> {
  const key = `${CSRF_CONFIG.redisKeyPrefix}${sessionId}`;
  
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // 忽略错误
    }
  }
  
  memoryTokenStore.delete(sessionId);
}

/**
 * 清理过期令牌（内存）
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [key, value] of memoryTokenStore.entries()) {
    if (now > value.expires) {
      memoryTokenStore.delete(key);
    }
  }
}

/**
 * 需要CSRF保护的方法
 */
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * 不需要CSRF保护的路径
 */
const EXCLUDED_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/captcha',
  '/health',
  '/health/detailed',
];

/**
 * CSRF保护中间件
 */
export const csrfProtection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // 检查是否需要CSRF保护
  if (!PROTECTED_METHODS.includes(req.method)) {
    return next();
  }
  
  // 检查是否在排除列表中
  if (EXCLUDED_PATHS.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // 开发环境默认跳过CSRF验证（前端可能未完整实现CSRF支持）
  // 生产环境强制启用CSRF验证
  // 可通过环境变量 SKIP_CSRF=true 强制跳过（用于测试）
  // 或通过 ENABLE_CSRF_IN_DEV=true 在开发环境强制启用
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_CSRF_IN_DEV !== 'true') {
    secureLogger.debug('[CSRF] 开发环境跳过CSRF验证');
    return next();
  }
  
  if (process.env.SKIP_CSRF === 'true') {
    secureLogger.debug('[CSRF] 跳过CSRF验证（SKIP_CSRF=true）');
    return next();
  }
  
  // 获取CSRF令牌
  const csrfToken = req.headers[CSRF_CONFIG.headerName.toLowerCase()] as string;
  
  if (!csrfToken) {
    secureLogger.warn('[CSRF] 缺少CSRF令牌', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: '缺少安全令牌，请刷新页面重试',
      },
    });
    return;
  }
  
  // 获取会话ID（从请求体、查询参数或header中获取）
  const sessionId = (req.body?.sessionId || req.query?.sessionId || req.headers['x-session-id']) as string;
  
  // 验证CSRF令牌
  const ipBasedId = sessionId || req.ip || 'unknown';
  const isValid = await verifyCsrfToken(ipBasedId, csrfToken);
  
  if (!isValid) {
    secureLogger.warn('[CSRF] CSRF令牌验证失败', {
      method: req.method,
      path: req.path,
      sessionId: sessionId ? sessionId.substring(0, 8) + '...' : 'ip-based',
      ip: req.ip,
    });
    
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: '安全令牌无效，请刷新页面重试',
      },
    });
    return;
  }
  
  next();
};

/**
 * CSRF令牌获取端点
 */
export const getCsrfToken = async (req: Request, res: Response): Promise<void> => {
  const sessionId = (req.query?.sessionId || req.headers['x-session-id'] || req.ip) as string;
  const token = await createCsrfToken(sessionId);
  
  res.json({
    success: true,
    data: {
      token,
      expiresIn: CSRF_CONFIG.expiresIn,
    },
  });
};

/**
 * 为响应添加CSRF令牌的中间件
 */
export const attachCsrfToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // 为GET请求生成新的CSRF令牌
  if (req.method === 'GET') {
    const sessionId = (req.query?.sessionId || req.headers['x-session-id'] || req.ip) as string;
    const token = await createCsrfToken(sessionId);
    res.setHeader('X-CSRF-Token', token);
  }
  
  next();
};

/**
 * 获取CSRF存储统计（用于监控）
 */
export async function getCsrfStats(): Promise<{
  memoryCount: number;
  redisAvailable: boolean;
}> {
  const redis = await getRedisClient();
  
  return {
    memoryCount: memoryTokenStore.size,
    redisAvailable: !!redis,
  };
}
