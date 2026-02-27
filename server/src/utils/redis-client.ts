import { createClient } from 'redis';
import { serverConfig } from '../config';
import { secureLogger } from './secureLogger';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connecting: Promise<RedisClient | null> | null = null;
let disabledUntil = 0;
const CONNECT_TIMEOUT = 5000;
const KEEP_ALIVE = 30000;
const MAX_RETRIES = 3;

/**
 * getRedisClient
 * 获取可用的 Redis 客户端（单例），未配置或不可用时返回 null
 */
export async function getRedisClient(): Promise<RedisClient | null> {
  const now = Date.now();
  if (disabledUntil && now < disabledUntil) {return null;}

  const url = String(process.env.REDIS_URL || '').trim();
  if (!url) {return null;}

  if (client) {return client;}
  if (connecting) {return connecting;}

  connecting = (async () => {
    try {
      const c = createClient({ 
        url,
        socket: {
          connectTimeout: CONNECT_TIMEOUT,
          keepAlive: KEEP_ALIVE,
          noDelay: true,
          reconnectStrategy: (retries) => {
            if (retries > MAX_RETRIES) {
              secureLogger.warn('[redis] 重连次数超过上限，临时禁用');
              disabledUntil = Date.now() + 30_000;
              return new Error('重连次数超过上限');
            }
            const delay = Math.min(retries * 100, 3000);
            secureLogger.info('[redis] 尝试重连', { retries, delay });
            return delay;
          },
        },
        commandsQueueMaxLength: 1000,
      });
      
      c.on('error', (err) => {
        secureLogger.error('[redis] 连接错误', err instanceof Error ? err : undefined);
      });
      
      c.on('end', () => {
        secureLogger.warn('[redis] 连接已关闭');
        client = null;
      });
      
      c.on('reconnecting', () => {
        secureLogger.info('[redis] 正在重连...');
      });
      
      c.on('ready', () => {
        secureLogger.info('[redis] 连接就绪');
      });
      
      const connectPromise = c.connect();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Redis 连接超时')), CONNECT_TIMEOUT);
      });
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      secureLogger.info('[redis] 已连接', { url: sanitizeRedisUrl(url), env: serverConfig.nodeEnv });
      client = c;
      return client;
    } catch (err) {
      secureLogger.warn('[redis] 连接失败，将临时禁用', { url: sanitizeRedisUrl(url) });
      if (err instanceof Error) {
        secureLogger.error('[redis] 错误详情', err);
      }
      disabledUntil = Date.now() + 30_000;
      client = null;
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedisClient(): Promise<void> {
  if (client) {
    try {
      await client.quit();
      secureLogger.info('[redis] 连接已主动关闭');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      secureLogger.warn('[redis] 关闭连接时出错', { error: errMsg });
    }
    client = null;
  }
}

/**
 * 检查 Redis 连接是否健康
 */
export async function isRedisHealthy(): Promise<boolean> {
  if (!client) {return false;}
  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * incrWithExpire
 * INCR 计数并在首次写入时设置过期时间（秒）
 */
export async function incrWithExpire(
  c: RedisClient,
  key: string,
  ttlSeconds: number
): Promise<number> {
  const n = await c.incr(key);
  if (n === 1) {
    await c.expire(key, ttlSeconds);
  }
  return n;
}

/**
 * incrWithTtl
 * INCR 计数并设置过期时间（可选：每次都刷新 TTL，用于滑动窗口）
 */
export async function incrWithTtl(
  c: RedisClient,
  key: string,
  ttlSeconds: number,
  refreshTtlEveryTime: boolean
): Promise<number> {
  const n = await c.incr(key);
  if (refreshTtlEveryTime || n === 1) {
    await c.expire(key, ttlSeconds);
  }
  return n;
}

/**
 * sanitizeRedisUrl
 * 对 Redis 连接串做脱敏输出，避免日志泄露密码
 */
function sanitizeRedisUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.password) {u.password = '******';}
    return u.toString();
  } catch {
    return 'invalid_redis_url';
  }
}
