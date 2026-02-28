import crypto from 'crypto';
import prisma from '../prisma';
import { getRedisClient } from '../utils/redis-client';
import { secureLogger } from '../utils/secureLogger';

export type EmailVerificationType = 'register' | 'reset_password' | 'change_email';

const CODE_LENGTH = 6;
const CODE_EXPIRE_MS = 10 * 60 * 1000;
const CODE_COOLDOWN_MS = 60 * 1000;

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 3;

const emailRateLimitStore = new Map<string, { count: number; windowStart: number }>();
const emailCooldownStore = new Map<string, number>();

/**
 * 生成6位数字验证码
 */
export function generateEmailCode(): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = crypto.randomInt(0, digits.length);
    code += digits[idx];
  }
  return code;
}

/**
 * 清理过期的内存存储
 */
function cleanupExpiredStores(): void {
  const now = Date.now();
  
  for (const [email, data] of emailRateLimitStore.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      emailRateLimitStore.delete(email);
    }
  }
  
  for (const [email, lastSentAt] of emailCooldownStore.entries()) {
    if (now - lastSentAt > CODE_COOLDOWN_MS * 2) {
      emailCooldownStore.delete(email);
    }
  }
}

/**
 * 检查发送频率限制
 */
async function checkRateLimit(email: string): Promise<{ allowed: boolean; waitMs?: number }> {
  cleanupExpiredStores();
  
  const redis = await getRedisClient();
  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();
  
  if (redis) {
    try {
      const rateKey = `email:rate:${normalizedEmail}`;
      const count = await redis.incr(rateKey);
      
      if (count === 1) {
        await redis.expire(rateKey, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
      }
      
      if (count > RATE_LIMIT_MAX) {
        const ttl = await redis.ttl(rateKey);
        return { allowed: false, waitMs: Math.max(0, ttl * 1000) };
      }
      
      return { allowed: true };
    } catch (err) {
      secureLogger.warn('[email-verification] Redis rate limit check failed, using memory fallback', { email: normalizedEmail });
    }
  }
  
  const prev = emailRateLimitStore.get(normalizedEmail);
  if (!prev || now - prev.windowStart >= RATE_LIMIT_WINDOW_MS) {
    emailRateLimitStore.set(normalizedEmail, { count: 1, windowStart: now });
    return { allowed: true };
  }
  
  if (prev.count >= RATE_LIMIT_MAX) {
    return { allowed: false, waitMs: RATE_LIMIT_WINDOW_MS - (now - prev.windowStart) };
  }
  
  prev.count++;
  return { allowed: true };
}

/**
 * 检查发送冷却时间
 */
async function checkCooldown(email: string): Promise<{ allowed: boolean; waitMs?: number }> {
  const redis = await getRedisClient();
  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();
  
  if (redis) {
    try {
      const cooldownKey = `email:cooldown:${normalizedEmail}`;
      const lastSent = await redis.get(cooldownKey);
      
      if (lastSent) {
        const lastSentTime = parseInt(lastSent, 10);
        const elapsed = now - lastSentTime;
        if (elapsed < CODE_COOLDOWN_MS) {
          return { allowed: false, waitMs: CODE_COOLDOWN_MS - elapsed };
        }
      }
      
      return { allowed: true };
    } catch (err) {
      secureLogger.warn('[email-verification] Redis cooldown check failed, using memory fallback', { email: normalizedEmail });
    }
  }
  
  const lastSentAt = emailCooldownStore.get(normalizedEmail);
  if (lastSentAt && now - lastSentAt < CODE_COOLDOWN_MS) {
    return { allowed: false, waitMs: CODE_COOLDOWN_MS - (now - lastSentAt) };
  }
  
  return { allowed: true };
}

/**
 * 设置发送冷却时间
 */
async function setCooldown(email: string): Promise<void> {
  const redis = await getRedisClient();
  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();
  
  if (redis) {
    try {
      const cooldownKey = `email:cooldown:${normalizedEmail}`;
      await redis.set(cooldownKey, String(now), { EX: Math.ceil(CODE_COOLDOWN_MS / 1000) });
      return;
    } catch (err) {
      secureLogger.warn('[email-verification] Redis set cooldown failed, using memory fallback', { email: normalizedEmail });
    }
  }
  
  emailCooldownStore.set(normalizedEmail, now);
}

/**
 * 创建邮箱验证码
 */
export async function createEmailVerificationCode(
  email: string,
  type: EmailVerificationType,
  operatorId?: number
): Promise<{ success: boolean; code?: string; error?: string; waitMs?: number }> {
  const normalizedEmail = email.toLowerCase().trim();
  
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: '邮箱格式无效' };
  }
  
  const rateCheck = await checkRateLimit(normalizedEmail);
  if (!rateCheck.allowed) {
    return { success: false, error: `发送频率过高，请${Math.ceil((rateCheck.waitMs || 0) / 1000)}秒后重试`, waitMs: rateCheck.waitMs };
  }
  
  const cooldownCheck = await checkCooldown(normalizedEmail);
  if (!cooldownCheck.allowed) {
    return { success: false, error: `请${Math.ceil((cooldownCheck.waitMs || 0) / 1000)}秒后重试`, waitMs: cooldownCheck.waitMs };
  }
  
  const code = generateEmailCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRE_MS);
  
  try {
    await prisma.emailVerificationCode.create({
      data: {
        email: normalizedEmail,
        code,
        type,
        operatorId: operatorId || null,
        expiresAt,
      },
    });
    
    await setCooldown(normalizedEmail);
    
    secureLogger.info('[email-verification] 验证码创建成功', { email: normalizedEmail, type, operatorId });
    
    return { success: true, code };
  } catch (err) {
    secureLogger.error('[email-verification] 创建验证码失败', err instanceof Error ? err : undefined);
    return { success: false, error: '创建验证码失败，请稍后重试' };
  }
}

/**
 * 验证邮箱验证码
 */
export async function verifyEmailCode(
  email: string,
  code: string,
  type: EmailVerificationType
): Promise<{ success: boolean; error?: string; operatorId?: number }> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCode = code.trim();
  
  if (!normalizedEmail || !normalizedCode) {
    return { success: false, error: '邮箱或验证码不能为空' };
  }
  
  try {
    const record = await prisma.emailVerificationCode.findFirst({
      where: {
        email: normalizedEmail,
        code: normalizedCode,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!record) {
      secureLogger.warn('[email-verification] 验证码无效或已过期', { email: normalizedEmail, type });
      return { success: false, error: '验证码无效或已过期' };
    }
    
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    
    secureLogger.info('[email-verification] 验证码验证成功', { email: normalizedEmail, type });
    
    return { success: true, operatorId: record.operatorId || undefined };
  } catch (err) {
    secureLogger.error('[email-verification] 验证码验证失败', err instanceof Error ? err : undefined);
    return { success: false, error: '验证码验证失败，请稍后重试' };
  }
}

/**
 * 清理过期的验证码
 */
export async function cleanupExpiredCodes(): Promise<number> {
  try {
    const result = await prisma.emailVerificationCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });
    
    if (result.count > 0) {
      secureLogger.info('[email-verification] 清理过期验证码', { count: result.count });
    }
    
    return result.count;
  } catch (err) {
    secureLogger.error('[email-verification] 清理过期验证码失败', err instanceof Error ? err : undefined);
    return 0;
  }
}
