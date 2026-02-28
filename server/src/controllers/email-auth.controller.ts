import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../prisma';
import { comparePassword, hashPassword, signAccessToken, signRefreshToken } from '../utils/auth-helpers';
import { authCookieConfig, authGuardConfig, authSessionConfig } from '../config';
import { getRedisClient } from '../utils/redis-client';
import { secureLogger } from '../utils/secureLogger';
import { createEmailVerificationCode, verifyEmailCode, EmailVerificationType } from '../services/email-verification.service';
import { sendVerificationEmail, sendPasswordChangedNotification, sendEmailChangedNotification } from '../services/email.service';

type LoginFailRecord = {
  count: number;
  firstAt: number;
  lockedUntil: number;
  lastAt: number;
};

type WindowCounter = {
  count: number;
  windowStart: number;
  lastAt: number;
};

const emailLoginFailByKey = new Map<string, LoginFailRecord>();
const emailLoginIpCounter = new Map<string, WindowCounter>();
const emailRegisterIpCounter = new Map<string, WindowCounter>();

const LOGIN_MAX_LOCK_MS = 10 * 60 * 1000;

/**
 * 获取客户端IP
 */
function getClientIp(req: Request): string {
  const xf = String(req.headers['x-forwarded-for'] || '').trim();
  const raw = xf ? xf.split(',')[0].trim() : String(req.ip || '').trim();
  if (!raw) {return 'unknown';}
  return raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw;
}

/**
 * 获取Cookie安全配置
 */
function getCookieSecurityOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDev = !isProduction;
  
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isDev ? 'lax' : 'strict',
    domain: undefined,
  } as const;
}

/**
 * 设置认证Cookie
 */
function setAuthCookies(res: Response, input: { accessToken: string; refreshToken: string }) {
  const base = getCookieSecurityOptions();
  
  secureLogger.info('[email-auth] 设置认证Cookie', {
    accessCookieName: authCookieConfig.accessCookieName,
    refreshCookieName: authCookieConfig.refreshCookieName,
    sameSite: base.sameSite,
    secure: base.secure,
    domain: base.domain,
  });

  res.cookie(authCookieConfig.accessCookieName, input.accessToken, {
    ...base,
    maxAge: authSessionConfig.accessCookieMaxAgeMs,
    path: '/',
  });

  res.cookie(authCookieConfig.refreshCookieName, input.refreshToken, {
    ...base,
    maxAge: authSessionConfig.refreshCookieMaxAgeMs,
    path: '/api/auth',
  });
}

/**
 * 清除认证Cookie
 */
function clearAuthCookies(res: Response) {
  const base = getCookieSecurityOptions();

  res.clearCookie(authCookieConfig.accessCookieName, { ...base, path: '/' });
  res.clearCookie(authCookieConfig.refreshCookieName, { ...base, path: '/api/auth' });
}

/**
 * 标准化邮箱地址
 */
function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

/**
 * 清理过期的内存计数器
 */
function cleanupCounters(now: number) {
  for (const [k, v] of emailLoginFailByKey.entries()) {
    const expired = now - v.lastAt > authGuardConfig.loginFailWindowMs + LOGIN_MAX_LOCK_MS;
    if (expired) {emailLoginFailByKey.delete(k);}
  }
  for (const [k, v] of emailLoginIpCounter.entries()) {
    const expired = now - v.lastAt > authGuardConfig.loginIpWindowMs * 2;
    if (expired) {emailLoginIpCounter.delete(k);}
  }
  for (const [k, v] of emailRegisterIpCounter.entries()) {
    const expired = now - v.lastAt > authGuardConfig.registerIpWindowMs * 2;
    if (expired) {emailRegisterIpCounter.delete(k);}
  }
}

/**
 * 统计窗口内的请求次数
 */
function bumpWindowCounter(map: Map<string, WindowCounter>, key: string, now: number, windowMs: number, max: number): number | null {
  const prev = map.get(key);
  if (!prev || now - prev.windowStart >= windowMs) {
    map.set(key, { count: 1, windowStart: now, lastAt: now });
    return null;
  }
  const nextCount = prev.count + 1;
  map.set(key, { count: nextCount, windowStart: prev.windowStart, lastAt: now });
  if (nextCount > max) {
    const waitMs = windowMs - (now - prev.windowStart);
    return Math.max(0, waitMs);
  }
  return null;
}

/**
 * 检查邮箱登录IP限流
 */
async function checkEmailLoginIpRateLimit(
  ip: string,
  now: number
): Promise<{ blocked: boolean; status: number; message: string } | null> {
  const redis = await getRedisClient();
  const redisKey = `rl:email:login:ip:${ip}`;
  
  if (redis) {
    try {
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, Math.ceil(authGuardConfig.loginIpWindowMs / 1000));
      }
      if (count > authGuardConfig.loginIpMax) {
        return { blocked: true, status: 429, message: '请求过于频繁，请稍后再试' };
      }
      return null;
    } catch {
      secureLogger.warn('[email-auth] Redis限流检查失败，使用内存兜底', { ip });
    }
  }
  
  const ipWait = bumpWindowCounter(emailLoginIpCounter, ip, now, authGuardConfig.loginIpWindowMs, authGuardConfig.loginIpMax);
  if (ipWait !== null) {
    return { blocked: true, status: 429, message: '请求过于频繁，请稍后再试' };
  }
  
  return null;
}

/**
 * 检查邮箱登录锁定状态
 */
async function checkEmailLoginLock(ip: string, email: string, now: number): Promise<number | null> {
  const redis = await getRedisClient();
  const lockKey = `rl:email:login:lock:${ip}:${email}`;
  
  if (redis) {
    try {
      const v = await redis.get(lockKey);
      if (!v) {return null;}
      const lockedUntil = Number(v);
      return Number.isFinite(lockedUntil) && lockedUntil > now ? lockedUntil : null;
    } catch {
      secureLogger.warn('[email-auth] Redis锁定检查失败', { ip, email });
    }
  }
  
  const key = `${ip}::${email}`;
  const mem = emailLoginFailByKey.get(key);
  if (mem?.lockedUntil && mem.lockedUntil > now) {return mem.lockedUntil;}
  return null;
}

/**
 * 记录邮箱登录失败
 */
async function recordEmailLoginFailure(
  ip: string,
  email: string
): Promise<{ failCount: number; lockedUntil: number | null }> {
  const now = Date.now();
  const redis = await getRedisClient();
  const maxFails = authGuardConfig.loginMaxFailsDoctor;
  const lockMs = authGuardConfig.loginLockMsDoctor;
  
  let lockedUntil: number | null = null;
  let failCount = 0;
  
  if (redis) {
    try {
      const failKey = `rl:email:login:fail:${ip}:${email}`;
      const lockKey = `rl:email:login:lock:${ip}:${email}`;
      const ttlSeconds = Math.ceil(authGuardConfig.loginFailWindowMs / 1000);
      
      failCount = await redis.incr(failKey);
      if (failCount === 1) {
        await redis.expire(failKey, ttlSeconds);
      }
      
      if (failCount >= maxFails) {
        lockedUntil = now + lockMs;
        await redis.set(lockKey, String(lockedUntil), { EX: Math.ceil(lockMs / 1000) });
        secureLogger.warn('[email-auth] 触发登录失败锁定', { ip, email, lockedUntil: new Date(lockedUntil).toISOString() });
      }
    } catch {
      secureLogger.warn('[email-auth] Redis失败计数写入失败', { ip, email });
    }
  }
  
  const key = `${ip}::${email}`;
  const prev = emailLoginFailByKey.get(key);
  const windowExpired = !prev || now - prev.firstAt >= authGuardConfig.loginFailWindowMs;
  
  if (windowExpired) {
    emailLoginFailByKey.set(key, { count: 1, firstAt: now, lockedUntil: 0, lastAt: now });
    return { failCount: Math.max(failCount, 1), lockedUntil };
  }
  
  const nextCount = prev.count + 1;
  const nextLockedUntil = nextCount >= maxFails ? Math.max(prev.lockedUntil, now + lockMs) : prev.lockedUntil;
  emailLoginFailByKey.set(key, { count: nextCount, firstAt: prev.firstAt, lockedUntil: nextLockedUntil, lastAt: now });
  
  if (nextLockedUntil > now) {lockedUntil = Math.max(lockedUntil || 0, nextLockedUntil);}
  return { failCount: Math.max(failCount, nextCount), lockedUntil };
}

/**
 * 清除邮箱登录失败记录
 */
async function clearEmailLoginFailures(ip: string, email: string) {
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.del([`rl:email:login:fail:${ip}:${email}`, `rl:email:login:lock:${ip}:${email}`]);
    } catch {
      secureLogger.warn('[email-auth] Redis清理失败计数失败', { ip, email });
    }
  }
  
  const key = `${ip}::${email}`;
  emailLoginFailByKey.delete(key);
}

/**
 * 发送邮箱验证码
 * POST /api/auth/email/send-code
 */
export const sendEmailCode = async (req: Request, res: Response) => {
  try {
    const { email, type } = req.body;
    
    const normalizedEmail = normalizeEmail(email);
    const verificationType = String(type || 'register') as EmailVerificationType;
    
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: '邮箱格式无效' });
    }
    
    if (!['register', 'reset_password', 'change_email'].includes(verificationType)) {
      return res.status(400).json({ success: false, message: '验证码类型无效' });
    }
    
    if (verificationType === 'register') {
      const existing = await prisma.operator.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: '该邮箱已被注册' });
      }
    }
    
    if (verificationType === 'reset_password') {
      const existing = await prisma.operator.findUnique({
        where: { email: normalizedEmail },
      });
      if (!existing) {
        return res.status(400).json({ success: false, message: '该邮箱未注册' });
      }
    }
    
    const result = await createEmailVerificationCode(normalizedEmail, verificationType);
    
    if (!result.success) {
      return res.status(429).json({ 
        success: false, 
        message: result.error,
        data: { waitMs: result.waitMs }
      });
    }
    
    const emailResult = await sendVerificationEmail(normalizedEmail, result.code!, verificationType);
    
    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: emailResult.error || '邮件发送失败' });
    }
    
    secureLogger.info('[email-auth] 验证码发送成功', { email: normalizedEmail, type: verificationType });
    
    return res.json({
      success: true,
      message: '验证码已发送到您的邮箱',
      data: {
        email: normalizedEmail,
        expiresIn: 600,
      },
    });
  } catch (error) {
    secureLogger.error('[email-auth] 发送验证码失败', error instanceof Error ? error : undefined);
    return res.status(500).json({ success: false, message: '发送验证码失败' });
  }
};

/**
 * 邮箱注册
 * POST /api/auth/email/register
 */
export const emailRegister = async (req: Request, res: Response) => {
  try {
    const { email, password, name, code, role } = req.body;
    const ip = getClientIp(req);
    const now = Date.now();
    
    cleanupCounters(now);
    
    const ipWait = bumpWindowCounter(emailRegisterIpCounter, ip, now, authGuardConfig.registerIpWindowMs, authGuardConfig.registerIpMax);
    if (ipWait !== null) {
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' });
    }
    
    const normalizedEmail = normalizeEmail(email);
    
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: '邮箱格式无效' });
    }
    
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: '密码至少8个字符' });
    }
    
    if (!code || code.length !== 6) {
      return res.status(400).json({ success: false, message: '验证码格式无效' });
    }
    
    const verifyResult = await verifyEmailCode(normalizedEmail, code, 'register');
    if (!verifyResult.success) {
      return res.status(400).json({ success: false, message: verifyResult.error });
    }
    
    const existingByEmail = await prisma.operator.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingByEmail) {
      return res.status(400).json({ success: false, message: '该邮箱已被注册' });
    }
    
    const hashedPassword = await hashPassword(password);
    const operator = await prisma.operator.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name || normalizedEmail.split('@')[0],
        role: role || 'doctor',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    
    const sid = crypto.randomUUID();
    const jti = crypto.randomUUID();
    const accessToken = signAccessToken({ operatorId: operator.id, role: operator.role });
    const refreshToken = signRefreshToken({ operatorId: operator.id, role: operator.role, sid, jti });
    
    const redis = await getRedisClient();
    if (redis) {
      const ttlSeconds = Math.ceil(authSessionConfig.refreshStoreTtlMs / 1000);
      await redis.set(
        `auth:refresh:${sid}`,
        JSON.stringify({ operatorId: operator.id, role: operator.role, jti }),
        { EX: ttlSeconds }
      );
    }
    
    setAuthCookies(res, { accessToken, refreshToken });
    
    secureLogger.info('[email-auth] 邮箱注册成功', { operatorId: operator.id, email: normalizedEmail });
    
    return res.json({
      success: true,
      data: {
        token: accessToken,
        operatorId: operator.id,
        role: operator.role,
        name: operator.name,
        email: operator.email,
      },
    });
  } catch (error) {
    secureLogger.error('[email-auth] 邮箱注册失败', error instanceof Error ? error : undefined);
    return res.status(500).json({ success: false, message: '注册失败' });
  }
};

/**
 * 邮箱登录
 * POST /api/auth/email/login
 */
export const emailLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ip = getClientIp(req);
    const now = Date.now();
    
    cleanupCounters(now);
    
    const ipBlock = await checkEmailLoginIpRateLimit(ip, now);
    if (ipBlock) {
      return res.status(ipBlock.status).json({ success: false, message: ipBlock.message });
    }
    
    const normalizedEmail = normalizeEmail(email);
    
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: '邮箱格式无效' });
    }
    
    if (!password) {
      return res.status(400).json({ success: false, message: '请输入密码' });
    }
    
    const lockedUntil = await checkEmailLoginLock(ip, normalizedEmail, now);
    if (lockedUntil) {
      const remainMs = lockedUntil - now;
      const remainMin = Math.ceil(remainMs / 60000);
      return res.status(429).json({ 
        success: false, 
        message: `登录失败次数过多，请${remainMin}分钟后再试` 
      });
    }
    
    const operator = await prisma.operator.findUnique({
      where: { email: normalizedEmail },
    });
    
    if (!operator || !(await comparePassword(password, operator.password))) {
      await recordEmailLoginFailure(ip, normalizedEmail);
      return res.status(401).json({ success: false, message: '邮箱或密码错误' });
    }
    
    await clearEmailLoginFailures(ip, normalizedEmail);
    
    const sid = crypto.randomUUID();
    const jti = crypto.randomUUID();
    const accessToken = signAccessToken({ operatorId: operator.id, role: operator.role });
    const refreshToken = signRefreshToken({ operatorId: operator.id, role: operator.role, sid, jti });
    
    const redis = await getRedisClient();
    if (redis) {
      const ttlSeconds = Math.ceil(authSessionConfig.refreshStoreTtlMs / 1000);
      await redis.set(
        `auth:refresh:${sid}`,
        JSON.stringify({ operatorId: operator.id, role: operator.role, jti }),
        { EX: ttlSeconds }
      );
    }
    
    setAuthCookies(res, { accessToken, refreshToken });
    
    secureLogger.info('[email-auth] 邮箱登录成功', { operatorId: operator.id, email: normalizedEmail });
    
    return res.json({
      success: true,
      data: {
        token: accessToken,
        operatorId: operator.id,
        role: operator.role,
        name: operator.name || operator.email,
        email: operator.email,
      },
    });
  } catch (error) {
    secureLogger.error('[email-auth] 邮箱登录失败', error instanceof Error ? error : undefined);
    return res.status(500).json({ success: false, message: '登录失败' });
  }
};

/**
 * 重置密码
 * POST /api/auth/email/reset-password
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    
    const normalizedEmail = normalizeEmail(email);
    
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: '邮箱格式无效' });
    }
    
    if (!code || code.length !== 6) {
      return res.status(400).json({ success: false, message: '验证码格式无效' });
    }
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: '密码至少8个字符' });
    }
    
    const verifyResult = await verifyEmailCode(normalizedEmail, code, 'reset_password');
    if (!verifyResult.success) {
      return res.status(400).json({ success: false, message: verifyResult.error });
    }
    
    const operator = await prisma.operator.findUnique({
      where: { email: normalizedEmail },
    });
    
    if (!operator) {
      return res.status(400).json({ success: false, message: '用户不存在' });
    }
    
    const hashedPassword = await hashPassword(newPassword);
    
    await prisma.operator.update({
      where: { id: operator.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });
    
    await sendPasswordChangedNotification(normalizedEmail);
    
    secureLogger.info('[email-auth] 密码重置成功', { operatorId: operator.id, email: normalizedEmail });
    
    return res.json({
      success: true,
      message: '密码重置成功，请使用新密码登录',
    });
  } catch (error) {
    secureLogger.error('[email-auth] 密码重置失败', error instanceof Error ? error : undefined);
    return res.status(500).json({ success: false, message: '密码重置失败' });
  }
};

/**
 * 修改密码（已登录状态）
 * POST /api/auth/email/change-password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user?.operatorId;
    
    if (!operatorId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword) {
      return res.status(400).json({ success: false, message: '请输入当前密码' });
    }
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: '新密码至少8个字符' });
    }
    
    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
    });
    
    if (!operator) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    if (!(await comparePassword(oldPassword, operator.password))) {
      return res.status(400).json({ success: false, message: '当前密码错误' });
    }
    
    const hashedPassword = await hashPassword(newPassword);
    
    await prisma.operator.update({
      where: { id: operatorId },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });
    
    if (operator.email) {
      await sendPasswordChangedNotification(operator.email);
    }
    
    secureLogger.info('[email-auth] 密码修改成功', { operatorId });
    
    return res.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    secureLogger.error('[email-auth] 密码修改失败', error instanceof Error ? error : undefined);
    return res.status(500).json({ success: false, message: '密码修改失败' });
  }
};

/**
 * 修改邮箱（已登录状态）
 * POST /api/auth/email/change-email
 */
export const changeEmail = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user?.operatorId;
    
    if (!operatorId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    const { newEmail, code } = req.body;
    
    const normalizedEmail = normalizeEmail(newEmail);
    
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: '邮箱格式无效' });
    }
    
    if (!code || code.length !== 6) {
      return res.status(400).json({ success: false, message: '验证码格式无效' });
    }
    
    const verifyResult = await verifyEmailCode(normalizedEmail, code, 'change_email');
    if (!verifyResult.success) {
      return res.status(400).json({ success: false, message: verifyResult.error });
    }
    
    const existingOperator = await prisma.operator.findUnique({
      where: { email: normalizedEmail },
    });
    
    if (existingOperator) {
      return res.status(400).json({ success: false, message: '该邮箱已被其他账户使用' });
    }
    
    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
    });
    
    if (!operator) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    const oldEmail = operator.email;
    
    await prisma.operator.update({
      where: { id: operatorId },
      data: {
        email: normalizedEmail,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    
    if (oldEmail) {
      await sendEmailChangedNotification(oldEmail, normalizedEmail);
    }
    
    secureLogger.info('[email-auth] 邮箱修改成功', { operatorId, oldEmail, newEmail: normalizedEmail });
    
    return res.json({
      success: true,
      message: '邮箱修改成功',
      data: {
        email: normalizedEmail,
      },
    });
  } catch (error) {
    secureLogger.error('[email-auth] 邮箱修改失败', error instanceof Error ? error : undefined);
    return res.status(500).json({ success: false, message: '邮箱修改失败' });
  }
};

/**
 * 获取当前用户信息
 * GET /api/auth/email/me
 */
export const emailMe = async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user?.operatorId;
    
    if (!operatorId) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    
    if (!operator) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    return res.json({
      success: true,
      data: {
        operatorId: operator.id,
        username: operator.username,
        email: operator.email,
        name: operator.name,
        role: operator.role,
        emailVerified: operator.emailVerified,
        createdAt: operator.createdAt,
      },
    });
  } catch (error) {
    secureLogger.error('[email-auth] 获取用户信息失败', error instanceof Error ? error : undefined);
    return res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
};
