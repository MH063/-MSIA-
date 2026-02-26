import crypto from 'crypto';
import { getRedisClient } from '../utils/redis-client';

type StoreItem = { hash: string; expireAt: number; used?: boolean };

const FALLBACK_TTL_MS = 2 * 60 * 1000;
const FALLBACK_STORE = new Map<string, StoreItem>();

/**
 * 快速获取可用的 Redis 客户端（最大等待时间可控）
 * 超时或连接不可用时立即返回 null，避免请求阻塞
 */
async function getRedisQuick(timeoutMs: number = Number(process.env.CAPTCHA_REDIS_WAIT_MS || '300')) {
  try {
    const p = getRedisClient();
    const result = await Promise.race([
      p,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), Math.max(50, timeoutMs))),
    ]);
    return result;
  } catch {
    return null;
  }
}

/**
 * 生成指定位数的验证码字符串（字母数字混合，排除易混淆字符）
 */
export function generateCode(length = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars[idx];
  }
  return result;
}

/**
 * 将验证码渲染为SVG字符串（包含简单干扰线与随机偏移）
 */
export function renderSvg(code: string): string {
  const width = 120;
  const height = 40;
  const lines = Array.from({ length: 5 })
    .map(() => {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const x2 = Math.random() * width;
      const y2 = Math.random() * height;
      const color = `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(
        Math.random() * 255
      )}, ${Math.floor(Math.random() * 255)})`;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(
        1
      )}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1"/>`;
    })
    .join('');

  const chars = code
    .split('')
    .map((ch, i) => {
      const x = 15 + i * 25;
      const y = height / 2 + (Math.random() * 6 - 3);
      const rotate = (Math.random() * 40 - 20).toFixed(1);
      const color = `rgb(${Math.floor(Math.random() * 100)}, ${Math.floor(
        Math.random() * 100
      )}, ${Math.floor(Math.random() * 100)})`;
      return `<text x="${x}" y="${y.toFixed(
        1
      )}" fill="${color}" font-family="Arial" font-size="24" font-weight="bold" transform="rotate(${rotate} ${x} ${y.toFixed(
        1
      )})">${ch}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f5f5f5"/>
    ${lines}
    ${chars}
  </svg>`;
}

/**
 * 生成并存储验证码，返回唯一ID与SVG
 */
export async function createCaptcha(): Promise<{ id: string; svg: string; ttlMs: number }> {
  const code = generateCode(4);
  const id = crypto.randomUUID();
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const ttlMs = FALLBACK_TTL_MS;

  const redis = await getRedisQuick();
  if (redis) {
    const key = `captcha:${id}`;
    // 开发环境: 将验证码作为 key 的一部分存入 Redis (仅供调试)
    if (process.env.NODE_ENV === 'development') {
      await redis.set(`debug:captcha:${code}`, id, { EX: 60 });
      // 同时在控制台打印，便于本地调试
      // 注意：仅开发环境打印，生产环境不会输出验证码
      // eslint-disable-next-line no-console
      console.log(`[DEV] Captcha generated (redis) - ID: ${id}, Code: ${code}`);
    }
    await redis.set(key, hash, { EX: Math.ceil(ttlMs / 1000) });
  } else {
    FALLBACK_STORE.set(id, { hash, expireAt: Date.now() + ttlMs, used: false });
    // 开发环境: 打印验证码到控制台
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Captcha generated (fallback) - ID: ${id}, Code: ${code}`);
    }
    // 清理过期
    for (const [k, v] of FALLBACK_STORE.entries()) {
      if (Date.now() > v.expireAt) {FALLBACK_STORE.delete(k);}
    }
  }

  const svg = renderSvg(code);
  return { id, svg, ttlMs };
}

/**
 * 校验验证码；成功后做一次性失效
 */
export async function verifyCaptcha(id: string, input: string): Promise<boolean> {
  const normalized = String(input || '').trim();
  if (!id || !normalized) {return false;}
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');

  const redis = await getRedisQuick();
  if (redis) {
    const key = `captcha:${id}`;
    const stored = await redis.get(key);
    if (!stored) {return false;}
    const ok = stored === hash;
    if (ok) {
      // 删除防重用
      await redis.del(key);
    }
    return ok;
  }

  const item = FALLBACK_STORE.get(id);
  if (!item || item.used || Date.now() > item.expireAt) {return false;}
  const ok = item.hash === hash;
  if (ok) {
    item.used = true;
    FALLBACK_STORE.set(id, item);
  }
  return ok;
}
