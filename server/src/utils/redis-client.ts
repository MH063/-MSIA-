import { createClient } from 'redis';
import { serverConfig } from '../config';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connecting: Promise<RedisClient | null> | null = null;
let disabledUntil = 0;

/**
 * getRedisClient
 * 获取可用的 Redis 客户端（单例），未配置或不可用时返回 null
 */
export async function getRedisClient(): Promise<RedisClient | null> {
  const now = Date.now();
  if (disabledUntil && now < disabledUntil) return null;

  const url = String(process.env.REDIS_URL || '').trim();
  if (!url) return null;

  if (client) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const c = createClient({ url });
      c.on('error', (err) => {
        console.error('[redis] 连接错误', err);
      });
      await c.connect();
      console.log('[redis] 已连接', { url: sanitizeRedisUrl(url), env: serverConfig.nodeEnv });
      client = c;
      return client;
    } catch (err) {
      console.warn('[redis] 连接失败，将临时禁用', { url: sanitizeRedisUrl(url) });
      console.warn(err);
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
    if (u.password) u.password = '******';
    return u.toString();
  } catch {
    return 'invalid_redis_url';
  }
}

