/**
 * API 限流中间件
 * 支持基于用户级别、IP级别、接口级别的限流
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../utils/redis-client';
import { secureLogger } from '../utils/secureLogger';
import { serverConfig } from '../config';

/**
 * 限流策略配置
 */
interface RateLimitConfig {
  windowMs: number;      // 时间窗口（毫秒）
  maxRequests: number;   // 最大请求数
  keyPrefix?: string;    // Redis键前缀
  skipSuccessfulRequests?: boolean;  // 是否跳过成功请求计数
  skipFailedRequests?: boolean;      // 是否跳过失败请求计数
}

/**
 * 限流结果
 */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

/**
 * 限流存储接口
 */
interface RateLimitStore {
  increment(key: string): Promise<RateLimitResult>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
}

/**
 * Redis 限流存储实现
 */
class RedisRateLimitStore implements RateLimitStore {
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<RateLimitResult> {
    const client = await getRedisClient();
    if (!client) {
      // Redis 不可用时允许请求通过
      return {
        allowed: true,
        remaining: 0,
        resetTime: Date.now() + this.windowMs,
        totalHits: 0,
      };
    }

    const now = Date.now();
    const windowStart = now - this.windowMs;
    const resetTime = now + this.windowMs;

    // 使用 Redis 有序集合实现滑动窗口限流
    const multi = client.multi();

    // 移除窗口外的旧记录
    multi.zRemRangeByScore(key, 0, windowStart);

    // 添加当前请求记录
    multi.zAdd(key, { score: now, value: `${now}-${Math.random()}` });

    // 设置键过期时间
    multi.pExpire(key, this.windowMs);

    // 获取当前窗口内的请求数
    multi.zCard(key);

    const results = await multi.exec();
    const totalHits = results?.[3] as number || 0;

    return {
      allowed: true,
      remaining: 0,
      resetTime,
      totalHits,
    };
  }

  async decrement(key: string): Promise<void> {
    const client = await getRedisClient();
    if (!client) {return;}

    // 移除最新的一个记录
    const members = await client.zRange(key, -1, -1);
    if (members.length > 0) {
      await client.zRem(key, members[0]);
    }
  }

  async resetKey(key: string): Promise<void> {
    const client = await getRedisClient();
    if (!client) {return;}

    await client.del(key);
  }
}

/**
 * 内存限流存储实现（Redis不可用时降级使用）
 */
class MemoryRateLimitStore implements RateLimitStore {
  private windowMs: number;
  private storage: Map<string, number[]> = new Map();

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const resetTime = now + this.windowMs;

    // 获取或创建时间戳列表
    let timestamps = this.storage.get(key) || [];

    // 清理窗口外的旧记录
    timestamps = timestamps.filter(ts => ts > windowStart);

    // 添加当前请求
    timestamps.push(now);
    this.storage.set(key, timestamps);

    // 清理过期键
    this.cleanup();

    return {
      allowed: true,
      remaining: 0,
      resetTime,
      totalHits: timestamps.length,
    };
  }

  async decrement(key: string): Promise<void> {
    const timestamps = this.storage.get(key);
    if (timestamps && timestamps.length > 0) {
      timestamps.pop();
    }
  }

  async resetKey(key: string): Promise<void> {
    this.storage.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.storage.entries()) {
      const filtered = timestamps.filter(ts => ts > windowStart);
      if (filtered.length === 0) {
        this.storage.delete(key);
      } else {
        this.storage.set(key, filtered);
      }
    }
  }
}

/**
 * 创建限流中间件
 */
export function createRateLimiter(config: RateLimitConfig) {
  const store = serverConfig.isProduction
    ? new RedisRateLimitStore(config.windowMs)
    : new MemoryRateLimitStore(config.windowMs);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 生成限流键
      const key = generateRateLimitKey(req, config.keyPrefix);
      const result = await store.increment(key);

      // 检查是否超过限制
      if (result.totalHits > config.maxRequests) {
        // 触发限流
        await handleRateLimitExceeded(req, res, result, config);
        return;
      }

      // 设置响应头
      setRateLimitHeaders(res, result, config);

      // 监听响应，根据配置决定是否减少计数
      res.on('finish', () => {
        const statusCode = res.statusCode;

        if (config.skipSuccessfulRequests && statusCode < 400) {
          void store.decrement(key);
        }

        if (config.skipFailedRequests && statusCode >= 400) {
          void store.decrement(key);
        }
      });

      next();
    } catch (error) {
      secureLogger.error('[RateLimiter] 限流检查失败', error instanceof Error ? error : new Error(String(error)));
      // 限流出错时允许请求通过，避免阻塞正常业务
      next();
    }
  };
}

/**
 * 生成限流键
 */
function generateRateLimitKey(req: Request, prefix?: string): string {
  const basePrefix = prefix || 'ratelimit';

  // 优先使用用户ID
  const userId = (req as unknown as { operator?: { operatorId: number } }).operator?.operatorId;
  if (userId) {
    return `${basePrefix}:user:${userId}:${req.path}`;
  }

  // 其次使用IP
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${basePrefix}:ip:${ip}:${req.path}`;
}

/**
 * 处理限流超出
 */
async function handleRateLimitExceeded(
  req: Request,
  res: Response,
  result: RateLimitResult,
  config: RateLimitConfig
): Promise<void> {
  const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

  secureLogger.warn('[RateLimiter] 请求被限流', {
    path: req.path,
    ip: req.ip,
    userId: (req as unknown as { operator?: { operatorId: number } }).operator?.operatorId,
    totalHits: result.totalHits,
    maxRequests: config.maxRequests,
  });

  res.setHeader('Retry-After', retryAfter);
  res.status(429).json({
    success: false,
    message: '请求过于频繁，请稍后重试',
    retryAfter,
  });
}

/**
 * 设置限流响应头
 */
function setRateLimitHeaders(
  res: Response,
  result: RateLimitResult,
  config: RateLimitConfig
): void {
  const remaining = Math.max(0, config.maxRequests - result.totalHits);

  res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
}

/**
 * 预定义的限流策略
 */
export const rateLimitStrategies = {
  // 严格限流 - 用于敏感操作（登录、注册等）
  strict: createRateLimiter({
    windowMs: 15 * 60 * 1000,  // 15分钟
    maxRequests: 5,
    keyPrefix: 'ratelimit:strict',
  }),

  // 标准限流 - 用于普通API
  standard: createRateLimiter({
    windowMs: 60 * 1000,  // 1分钟
    maxRequests: 60,
    keyPrefix: 'ratelimit:standard',
  }),

  // 宽松限流 - 用于读操作
  relaxed: createRateLimiter({
    windowMs: 60 * 1000,  // 1分钟
    maxRequests: 120,
    keyPrefix: 'ratelimit:relaxed',
  }),

  // 知识库查询限流
  knowledge: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'ratelimit:knowledge',
  }),

  // 诊断建议限流
  diagnosis: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'ratelimit:diagnosis',
  }),
};

// 导出类型
export type { RateLimitConfig, RateLimitResult, RateLimitStore };
