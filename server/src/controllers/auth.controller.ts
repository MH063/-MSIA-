import { Request, Response } from 'express';
import crypto from 'crypto';
import { loadOperatorFromToken, parseOperatorToken } from '../middleware/auth';
import prisma from '../prisma';
import { comparePassword, hashPassword, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/auth-helpers';
import { authCookieConfig, authGuardConfig, authSessionConfig } from '../config';
import { getRedisClient, incrWithExpire, incrWithTtl } from '../utils/redis-client';
import { createCaptcha, verifyCaptcha as verifyCaptchaPair } from '../services/captcha.service';
import { secureLogger } from '../utils/secureLogger';

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

type LoginGuardBlock = {
  blocked: true;
  status: number;
  message: string;
  reason: 'rate_limited' | 'locked';
  lockedUntil?: number;
};

type AuthRolePolicy = {
  maxFails: number;
  lockMs: number;
};

const LOGIN_MAX_LOCK_MS = Math.max(authGuardConfig.loginLockMsDoctor, authGuardConfig.loginLockMsAdmin);

const loginFailByKey = new Map<string, LoginFailRecord>();
const loginIpCounter = new Map<string, WindowCounter>();
const registerIpCounter = new Map<string, WindowCounter>();
const refreshSessionBySid = new Map<
  string,
  { operatorId: number; role: string; jti: string; expiresAt: number }
>();

let warnedLoginDbMissing = false;

/**
 * 获取客户端IP（兼容反向代理与 IPv6-mapped IPv4）
 */
function getClientIp(req: Request): string {
  const xf = String(req.headers['x-forwarded-for'] || '').trim();
  const raw = xf ? xf.split(',')[0].trim() : String(req.ip || '').trim();
  if (!raw) {return 'unknown';}
  return raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw;
}

function parseCookieHeader(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const s = String(raw || '').trim();
  if (!s) {return out;}
  const parts = s.split(';');
  for (const part of parts) {
    const p = part.trim();
    if (!p) {continue;}
    const idx = p.indexOf('=');
    if (idx <= 0) {continue;}
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) {continue;}
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function readCookie(req: Request, name: string): string | null {
  const raw = String(req.header('cookie') || '').trim();
  if (!raw) {return null;}
  const jar = parseCookieHeader(raw);
  const v = String(jar[name] || '').trim();
  return v || null;
}

function setAuthCookies(res: Response, input: { accessToken: string; refreshToken: string }) {
  const base = {
    httpOnly: true,
    secure: authCookieConfig.secure,
    sameSite: authCookieConfig.sameSite,
    domain: authCookieConfig.domain,
  } as const;

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

function clearAuthCookies(res: Response) {
  const base = {
    httpOnly: true,
    secure: authCookieConfig.secure,
    sameSite: authCookieConfig.sameSite,
    domain: authCookieConfig.domain,
  } as const;

  res.clearCookie(authCookieConfig.accessCookieName, { ...base, path: '/' });
  res.clearCookie(authCookieConfig.refreshCookieName, { ...base, path: '/api/auth' });
}

/**
 * normalizeUsername
 * 统一对用户名做 trim + lowerCase，避免同一用户被拆成多个计数键
 */
function normalizeUsername(username: unknown): string {
  return String(username || '').trim().toLowerCase();
}

/**
 * getRolePolicy
 * 根据角色获取登录失败阈值与锁定时长配置
 */
function getRolePolicy(role?: string | null): AuthRolePolicy {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin') {
    return {
      maxFails: Math.max(1, authGuardConfig.loginMaxFailsAdmin),
      lockMs: Math.max(1_000, authGuardConfig.loginLockMsAdmin),
    };
  }
  return {
    maxFails: Math.max(1, authGuardConfig.loginMaxFailsDoctor),
    lockMs: Math.max(1_000, authGuardConfig.loginLockMsDoctor),
  };
}

/**
 * 清理过期的内存计数器，避免 Map 无限增长
 */
function cleanupCounters(now: number) {
  for (const [k, v] of loginFailByKey.entries()) {
    const expired = now - v.lastAt > authGuardConfig.loginFailWindowMs + LOGIN_MAX_LOCK_MS;
    if (expired) {loginFailByKey.delete(k);}
  }
  for (const [k, v] of loginIpCounter.entries()) {
    const expired = now - v.lastAt > authGuardConfig.loginIpWindowMs * 2;
    if (expired) {loginIpCounter.delete(k);}
  }
  for (const [k, v] of registerIpCounter.entries()) {
    const expired = now - v.lastAt > authGuardConfig.registerIpWindowMs * 2;
    if (expired) {registerIpCounter.delete(k);}
  }
  for (const [k, v] of refreshSessionBySid.entries()) {
    if (now >= v.expiresAt) {refreshSessionBySid.delete(k);}
  }
}

async function putRefreshSession(input: { sid: string; operatorId: number; role: string; jti: string }): Promise<void> {
  const redis = await getRedisClient();
  const ttlSeconds = Math.max(1, Math.ceil(authSessionConfig.refreshStoreTtlMs / 1000));
  if (redis) {
    try {
      await redis.set(
        `auth:refresh:${input.sid}`,
        JSON.stringify({ operatorId: input.operatorId, role: input.role, jti: input.jti }),
        { EX: ttlSeconds }
      );
      return;
    } catch (e) {
      secureLogger.warn('[auth.refresh] Redis 写入失败，将使用内存兜底');
    }
  }
  refreshSessionBySid.set(input.sid, {
    operatorId: input.operatorId,
    role: input.role,
    jti: input.jti,
    expiresAt: Date.now() + authSessionConfig.refreshStoreTtlMs,
  });
}

async function getRefreshSession(sid: string): Promise<{ operatorId: number; role: string; jti: string } | null> {
  const redis = await getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(`auth:refresh:${sid}`);
      if (!raw) {return null;}
      const parsed = JSON.parse(raw) as { operatorId?: unknown; role?: unknown; jti?: unknown };
      const operatorId = Number((parsed as any).operatorId);
      const role = String((parsed as any).role || '').trim();
      const jti = String((parsed as any).jti || '').trim();
      if (!Number.isFinite(operatorId) || !role || !jti) {return null;}
      return { operatorId, role, jti };
    } catch (e) {
      secureLogger.warn('[auth.refresh] Redis 读取失败，将尝试内存兜底');
    }
  }
  const now = Date.now();
  cleanupCounters(now);
  const mem = refreshSessionBySid.get(sid);
  if (!mem || now >= mem.expiresAt) {return null;}
  return { operatorId: mem.operatorId, role: mem.role, jti: mem.jti };
}

async function deleteRefreshSession(sid: string): Promise<void> {
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.del(`auth:refresh:${sid}`);
    } catch (e) {
      secureLogger.warn('[auth.refresh] Redis 删除失败，将继续清理内存兜底');
    }
  }
  refreshSessionBySid.delete(sid);
}

/**
 * 统计窗口内的请求次数，超过限制则返回需要等待的毫秒数
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
 * 检查登录失败锁定与IP限流（Redis 优先，数据库回溯兜底，最后使用内存）
 */
async function checkLoginGuard(req: Request, username?: string | null): Promise<LoginGuardBlock | null> {
  const now = Date.now();
  cleanupCounters(now);

  const ip = getClientIp(req);
  const redis = await getRedisClient();
  const ipBlocked = await checkLoginIpRateLimit(ip, now, redis);
  if (ipBlocked) {return ipBlocked;}

  const u = normalizeUsername(username);
  if (!u) {return null;}

  const lockedUntil = await getLoginLockedUntil(ip, u, now, redis);
  if (lockedUntil && lockedUntil > now) {
    const remainMs = lockedUntil - now;
    const remainMin = Math.ceil(remainMs / 60000);
    secureLogger.warn('[auth.login] 账号已被临时锁定', { ip, username: u, remainMin });
    return { blocked: true, status: 429, message: `登录失败次数过多，请${remainMin}分钟后再试`, reason: 'locked', lockedUntil };
  }

  return null;
}

/**
 * 检查登录 IP 速率限制（Redis 优先，数据库兜底，最后使用内存）
 */
async function checkLoginIpRateLimit(
  ip: string,
  now: number,
  redis: Awaited<ReturnType<typeof getRedisClient>>
): Promise<LoginGuardBlock | null> {
  const redisKey = `rl:auth:login:ip:${ip}`;
  if (redis) {
    try {
      const count = await incrWithExpire(redis, redisKey, Math.ceil(authGuardConfig.loginIpWindowMs / 1000));
      if (count > authGuardConfig.loginIpMax) {
        secureLogger.warn('[auth.login] IP请求过于频繁（Redis）', { ip, count });
        return { blocked: true, status: 429, message: '请求过于频繁，请稍后再试', reason: 'rate_limited' };
      }
      return null;
    } catch (e) {
      secureLogger.warn('[auth.login] Redis 限流检查失败，尝试数据库兜底', { ip });
    }
  }

  try {
    const since = new Date(now - authGuardConfig.loginIpWindowMs);
    const count = await prisma.authLoginAttempt.count({
      where: { ip, createdAt: { gte: since } },
    });
    if (count >= authGuardConfig.loginIpMax) {
      secureLogger.warn('[auth.login] IP请求过于频繁（DB兜底）', { ip, count });
      return { blocked: true, status: 429, message: '请求过于频繁，请稍后再试', reason: 'rate_limited' };
    }
    return null;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (isMissingTableError(err)) {warnLoginDbMissingOnce(err);}
  }

  const ipWait = bumpWindowCounter(loginIpCounter, ip, now, authGuardConfig.loginIpWindowMs, authGuardConfig.loginIpMax);
  if (ipWait !== null) {
    secureLogger.warn('[auth.login] IP请求过于频繁（内存兜底）', { ip, waitMs: ipWait });
    return { blocked: true, status: 429, message: '请求过于频繁，请稍后再试', reason: 'rate_limited' };
  }

  return null;
}

/**
 * 获取账号锁定截止时间（Redis 优先，数据库兜底，最后使用内存）
 */
async function getLoginLockedUntil(
  ip: string,
  username: string,
  now: number,
  redis: Awaited<ReturnType<typeof getRedisClient>>
): Promise<number | null> {
  const u = normalizeUsername(username);
  if (!u) {return null;}

  const lockKey = `rl:auth:login:lock:${ip}:${u}`;
  if (redis) {
    try {
      const v = await redis.get(lockKey);
      if (!v) {return null;}
      const lockedUntil = Number(v);
      return Number.isFinite(lockedUntil) ? lockedUntil : null;
    } catch (e) {
      secureLogger.warn('[auth.login] Redis 锁定检查失败，尝试数据库兜底', { ip, username: u });
    }
  }

  try {
    const rec = await prisma.authLoginLockout.findUnique({
      where: { ip_username: { ip, username: u } },
      select: { lockedUntil: true },
    });
    if (rec?.lockedUntil && rec.lockedUntil.getTime() > now) {
      return rec.lockedUntil.getTime();
    }
    if (rec?.lockedUntil && rec.lockedUntil.getTime() <= now) {
      try {
        await prisma.authLoginLockout.update({
          where: { ip_username: { ip, username: u } },
          data: {
            failCount: 0,
            firstFailedAt: new Date(now),
            lastFailedAt: new Date(now),
            lockedUntil: null,
          },
        });
      } catch {
        // ignore
      }
    }
    return null;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (isMissingTableError(err)) {warnLoginDbMissingOnce(err);}
  }

  const key = `${ip}::${u}`;
  const mem = loginFailByKey.get(key);
  if (mem?.lockedUntil && mem.lockedUntil > now) {return mem.lockedUntil;}
  return null;
}

/**
 * 记录登录失败次数并按阈值进行锁定（Redis + 数据库联合持久化，内存兜底）
 */
async function recordLoginFailure(
  req: Request,
  username: string,
  operatorRole?: string | null
): Promise<{ failCount: number; lockedUntil: number | null }> {
  const now = Date.now();
  const ip = getClientIp(req);
  const u = normalizeUsername(username);
  if (!u) {return { failCount: 0, lockedUntil: null };}

  const meta = getRequestMeta(req);
  const redis = await getRedisClient();

  const policy = getRolePolicy(operatorRole);

  let lockedUntil: number | null = null;
  let failCount = 0;

  if (redis) {
    try {
      const failKey = `rl:auth:login:fail:${ip}:${u}`;
      const lockKey = `rl:auth:login:lock:${ip}:${u}`;
      const ttlSeconds = Math.ceil(authGuardConfig.loginFailWindowMs / 1000);
      const refreshTtl = authGuardConfig.loginFailWindowMode === 'sliding' && authGuardConfig.allowSlidingTtlRefresh;
      failCount = refreshTtl
        ? await incrWithTtl(redis, failKey, ttlSeconds, true)
        : await incrWithExpire(redis, failKey, ttlSeconds);
      if (failCount >= policy.maxFails) {
        lockedUntil = now + policy.lockMs;
        await redis.set(lockKey, String(lockedUntil), { EX: Math.ceil(policy.lockMs / 1000) });
        secureLogger.warn('[auth.login] 触发登录失败锁定（Redis）', { ip, username: u, lockedUntil: new Date(lockedUntil).toISOString() });
      }
    } catch (e) {
      secureLogger.warn('[auth.login] Redis 失败计数写入失败，尝试数据库兜底', { ip, username: u });
    }
  }

  try {
    const db = await recordLoginFailureInDb({
      ip,
      username: u,
      now,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
      policy,
      windowMode: authGuardConfig.loginFailWindowMode,
      failWindowMs: authGuardConfig.loginFailWindowMs,
    });
    failCount = Math.max(failCount, db.failCount);
    if (db.lockedUntil) {lockedUntil = Math.max(lockedUntil || 0, db.lockedUntil);}
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (isMissingTableError(err)) {warnLoginDbMissingOnce(err);}
  }

  const key = `${ip}::${u}`;
  const prev = loginFailByKey.get(key);
  const windowExpired =
    !prev ||
    (authGuardConfig.loginFailWindowMode === 'sliding'
      ? now - prev.lastAt >= authGuardConfig.loginFailWindowMs
      : now - prev.firstAt >= authGuardConfig.loginFailWindowMs);
  if (windowExpired) {
    loginFailByKey.set(key, { count: 1, firstAt: now, lockedUntil: 0, lastAt: now });
    return { failCount: Math.max(failCount, 1), lockedUntil };
  }

  const nextCount = prev.count + 1;
  const nextLockedUntil = nextCount >= policy.maxFails ? Math.max(prev.lockedUntil, now + policy.lockMs) : prev.lockedUntil;
  const nextFirstAt = authGuardConfig.loginFailWindowMode === 'sliding' ? now : prev.firstAt;
  loginFailByKey.set(key, { count: nextCount, firstAt: nextFirstAt, lockedUntil: nextLockedUntil, lastAt: now });
  if (nextCount >= policy.maxFails) {
    secureLogger.warn('[auth.login] 触发登录失败锁定', { ip, username: u, lockedUntil: new Date(nextLockedUntil).toISOString() });
  }
  if (nextLockedUntil > now) {lockedUntil = Math.max(lockedUntil || 0, nextLockedUntil);}
  return { failCount: Math.max(failCount, nextCount), lockedUntil };
}

/**
 * 登录成功后清除失败计数（Redis + 数据库联合清理，内存兜底）
 */
async function clearLoginFailures(req: Request, username: string) {
  const ip = getClientIp(req);
  const u = normalizeUsername(username);
  if (!u) {return;}
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.del([`rl:auth:login:fail:${ip}:${u}`, `rl:auth:login:lock:${ip}:${u}`]);
    } catch (e) {
      secureLogger.warn('[auth.login] Redis 清理失败计数失败', { ip, username: u });
    }
  }

  try {
    await prisma.authLoginLockout.update({
      where: { ip_username: { ip, username: u } },
      data: {
        failCount: 0,
        firstFailedAt: new Date(),
        lastFailedAt: new Date(),
        lockedUntil: null,
      },
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (isMissingTableError(err)) {warnLoginDbMissingOnce(err);}
  }

  const key = `${ip}::${u}`;
  loginFailByKey.delete(key);
}

/**
 * 检查注册限流（按IP）
 */
function checkRegisterGuard(req: Request): { blocked: boolean; status: number; message: string } | null {
  const now = Date.now();
  cleanupCounters(now);
  const ip = getClientIp(req);
  const wait = bumpWindowCounter(registerIpCounter, ip, now, authGuardConfig.registerIpWindowMs, authGuardConfig.registerIpMax);
  if (wait !== null) {
    secureLogger.warn('[auth.register] IP请求过于频繁', { ip, waitMs: wait });
    return { blocked: true, status: 429, message: '请求过于频繁，请稍后再试' };
  }
  return null;
}

/**
 * 生成验证码错误响应并附带新的验证码
 */
async function buildCaptchaErrorResponse(message: string) {
  const captcha = await createCaptcha();
  secureLogger.warn('[auth.captcha] 校验失败，生成新验证码', { reason: message });
  return {
    success: false,
    message,
    data: {
      captcha,
    },
  };
}

export const login = async (req: Request, res: Response) => {
  try {
    const { token, username, password, captchaId, captcha } = req.body;
    const meta = getRequestMeta(req);

    // 验证码校验
    if (!captchaId || !captcha) {
      secureLogger.warn('[auth.login] 验证码校验失败');
      return res.status(400).json({ success: false, message: '请先获取验证码并填写' });
    }
    const captchaOk = await verifyCaptchaPair(String(captchaId), String(captcha));
    if (!captchaOk) {
      const body = await buildCaptchaErrorResponse('验证码错误或已过期');
      return res.status(400).json(body);
    }

    // 1. Token Login (Old way or manual token)
    if (token) {
      const guard = await checkLoginGuard(req, null);
      if (guard?.blocked) {
        await persistLoginAttempt({
          ip: meta.ip,
          username: null,
          operatorId: null,
          ok: false,
          reason: guard.reason,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
          lockedUntil: guard.lockedUntil || null,
        });
        return res.status(guard.status).json({ success: false, message: guard.message });
      }

      const operator = loadOperatorFromToken(token);
      if (!operator) {
        await persistLoginAttempt({
          ip: meta.ip,
          username: null,
          operatorId: null,
          ok: false,
          reason: 'invalid_token',
          userAgent: meta.userAgent,
          requestId: meta.requestId,
          lockedUntil: null,
        });
        return res.status(401).json({ success: false, message: 'token 无效' });
      }
      const sid = crypto.randomUUID();
      const jti = crypto.randomUUID();
      const accessToken = signAccessToken({ operatorId: operator.operatorId, role: operator.role });
      const refreshToken = signRefreshToken({ operatorId: operator.operatorId, role: operator.role, sid, jti });
      await putRefreshSession({ sid, operatorId: operator.operatorId, role: operator.role, jti });
      setAuthCookies(res, { accessToken, refreshToken });

      secureLogger.info('[auth.login] Token登录成功', { operatorId: operator.operatorId, role: operator.role });
      await persistLoginAttempt({
        ip: meta.ip,
        username: null,
        operatorId: operator.operatorId > 0 ? operator.operatorId : null,
        ok: true,
        reason: 'token_login',
        userAgent: meta.userAgent,
        requestId: meta.requestId,
        lockedUntil: null,
      });
      let name = 'Doctor';
      if (operator.operatorId > 0) {
        try {
          const dbOp = await prisma.operator.findUnique({ where: { id: operator.operatorId } });
          if (dbOp) {name = dbOp.name || dbOp.username;}
        } catch {
          // ignore
        }
      }
      return res.json({
        success: true,
        data: {
          token: accessToken,
          operatorId: operator.operatorId,
          role: operator.role,
          name,
        },
      });
    }

    // 2. Username/Password Login
    if (username && password) {
      const guard = await checkLoginGuard(req, username);
      if (guard?.blocked) {
        if (guard.reason === 'locked') {
          const u = normalizeUsername(username);
          if (u && guard.lockedUntil) {
            await upsertLockoutFromBlocked(meta.ip, u, guard.lockedUntil);
          }
        }
        await persistLoginAttempt({
          ip: meta.ip,
          username: normalizeUsername(username),
          operatorId: null,
          ok: false,
          reason: guard.reason,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
          lockedUntil: guard.lockedUntil || null,
        });
        return res.status(guard.status).json({ success: false, message: guard.message });
      }

      const usernameKey = String(username || '').trim();
      const operator = await prisma.operator.findUnique({
        where: { username: usernameKey },
      });

      if (!operator || !(await comparePassword(password, operator.password))) {
        await recordLoginFailure(req, usernameKey, operator?.role || null);
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
      }

      await clearLoginFailures(req, username);
      const sid = crypto.randomUUID();
      const jti = crypto.randomUUID();
      const accessToken = signAccessToken({ operatorId: operator.id, role: operator.role });
      const refreshToken = signRefreshToken({ operatorId: operator.id, role: operator.role, sid, jti });
      await putRefreshSession({ sid, operatorId: operator.id, role: operator.role, jti });
      setAuthCookies(res, { accessToken, refreshToken });

      secureLogger.info('[auth.login] 密码登录成功', { operatorId: operator.id, role: operator.role });
      await persistLoginAttempt({
        ip: meta.ip,
        username: normalizeUsername(username),
        operatorId: operator.id,
        ok: true,
        reason: 'password_login',
        userAgent: meta.userAgent,
        requestId: meta.requestId,
        lockedUntil: null,
      });
      
      return res.json({
        success: true,
        data: {
          token: accessToken,
          operatorId: operator.id,
          role: operator.role,
          name: operator.name || operator.username,
        },
      });
    }

    return res.status(400).json({ success: false, message: '请提供Token或用户名密码' });
  } catch (error) {
    secureLogger.error('[auth.login] 登录失败', error instanceof Error ? error : undefined);
    return res.status(500).json({ success: false, message: '登录失败' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, name, role, captchaId, captcha } = req.body;

    const guard = checkRegisterGuard(req);
    if (guard?.blocked) {
      return res.status(guard.status).json({ success: false, message: guard.message });
    }

    // 验证码校验
    if (!captchaId || !captcha) {
      return res.status(400).json({ success: false, message: '请先获取验证码并填写' });
    }
    const captchaOk = await verifyCaptchaPair(String(captchaId), String(captcha));
    if (!captchaOk) {
      const body = await buildCaptchaErrorResponse('验证码错误或已过期');
      return res.status(400).json(body);
    }

    const existing = await prisma.operator.findUnique({
      where: { username },
    });

    if (existing) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    const hashedPassword = await hashPassword(password);
    const operator = await prisma.operator.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: role || 'doctor',
      },
    });

    const sid = crypto.randomUUID();
    const jti = crypto.randomUUID();
    const accessToken = signAccessToken({ operatorId: operator.id, role: operator.role });
    const refreshToken = signRefreshToken({ operatorId: operator.id, role: operator.role, sid, jti });
    await putRefreshSession({ sid, operatorId: operator.id, role: operator.role, jti });
    setAuthCookies(res, { accessToken, refreshToken });
    secureLogger.info('[auth.register] 注册成功', { operatorId: operator.id });

    return res.json({
      success: true,
      data: {
        token: accessToken,
        operatorId: operator.id,
        role: operator.role,
        name: operator.name || operator.username,
      },
    });

  } catch (error) {
    secureLogger.error('[auth.register] 注册失败', error instanceof Error ? error : undefined);
    return res.status(500).json({ success: false, message: '注册失败' });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const token = parseOperatorToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: '缺少token' });
    }

    const operator = loadOperatorFromToken(token);
    if (!operator) {
      return res.status(401).json({ success: false, message: 'token 无效' });
    }
    
    // If it's a DB user (ID > 0), fetch details
    let name = 'Doctor';
    if (operator.operatorId > 0) {
        try {
            const dbOp = await prisma.operator.findUnique({ where: { id: operator.operatorId } });
            if (dbOp) {
                name = dbOp.name || dbOp.username;
            }
        } catch (_e) {
            // ignore if table doesn't exist yet or other error
        }
    }

    return res.json({
      success: true,
      data: {
        operatorId: operator.operatorId,
        role: operator.role,
        name,
      },
    });
  } catch (error) {
    secureLogger.error('[auth.me] 获取当前用户失败', error instanceof Error ? error : undefined);
    return res.status(500).json({ success: false, message: '获取当前用户失败' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const rt = readCookie(req, authCookieConfig.refreshCookieName);
    if (!rt) {
      return res.status(401).json({ success: false, message: '缺少刷新令牌' });
    }

    const payload = verifyRefreshToken(rt);
    if (!payload) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: '刷新令牌无效' });
    }

    const session = await getRefreshSession(payload.sid);
    if (!session) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: '刷新会话已失效' });
    }

    if (session.operatorId !== payload.operatorId || session.role !== payload.role || session.jti !== payload.jti) {
      await deleteRefreshSession(payload.sid);
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: '刷新令牌已吊销' });
    }

    const accessToken = signAccessToken({ operatorId: payload.operatorId, role: payload.role });
    let refreshToken = rt;
    if (authSessionConfig.refreshRotateOnUse) {
      const nextJti = crypto.randomUUID();
      refreshToken = signRefreshToken({ operatorId: payload.operatorId, role: payload.role, sid: payload.sid, jti: nextJti });
      await putRefreshSession({ sid: payload.sid, operatorId: payload.operatorId, role: payload.role, jti: nextJti });
    }
    setAuthCookies(res, { accessToken, refreshToken });

    secureLogger.info('[auth.refresh] 刷新成功', { operatorId: payload.operatorId, role: payload.role, rotate: authSessionConfig.refreshRotateOnUse });
    return res.json({
      success: true,
      data: { operatorId: payload.operatorId, role: payload.role },
    });
  } catch (e) {
    secureLogger.error('[auth.refresh] 刷新失败', e instanceof Error ? e : undefined);
    return res.status(500).json({ success: false, message: '刷新失败' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const rt = readCookie(req, authCookieConfig.refreshCookieName);
    const payload = rt ? verifyRefreshToken(rt) : null;
    if (payload) {
      await deleteRefreshSession(payload.sid);
    }
    clearAuthCookies(res);
    secureLogger.info('[auth.logout] 退出登录', { hasSession: Boolean(payload) });
    return res.json({ success: true, data: { ok: true } });
  } catch (e) {
    secureLogger.error('[auth.logout] 退出失败', e instanceof Error ? e : undefined);
    clearAuthCookies(res);
    return res.status(500).json({ success: false, message: '退出失败' });
  }
};

/**
 * getRequestMeta
 * 统一提取登录请求的元信息，便于日志与审计落库
 */
function getRequestMeta(req: Request): { ip: string; userAgent: string | null; requestId: string | null } {
  const ip = getClientIp(req);
  const userAgent = String(req.headers['user-agent'] || '').trim() || null;
  const requestId = String(req.headers['x-request-id'] || '').trim() || null;
  return { ip, userAgent, requestId };
}

/**
 * recordLoginFailureInDb
 * 以锁定表作为“失败窗口状态”的主来源，避免每次都 count 审计表
 */
async function recordLoginFailureInDb(input: {
  ip: string;
  username: string;
  now: number;
  userAgent: string | null;
  requestId: string | null;
  policy: AuthRolePolicy;
  windowMode: 'fixed' | 'sliding';
  failWindowMs: number;
}): Promise<{ failCount: number; lockedUntil: number | null }> {
  const nowDate = new Date(input.now);
  return prisma.$transaction(async (tx) => {
    const prev = await tx.authLoginLockout.findUnique({
      where: { ip_username: { ip: input.ip, username: input.username } },
    });

    const prevLockedUntil = prev?.lockedUntil ? prev.lockedUntil.getTime() : null;
    const isLocked = prevLockedUntil !== null && prevLockedUntil > input.now;

    if (isLocked) {
      await tx.authLoginLockout.update({
        where: { ip_username: { ip: input.ip, username: input.username } },
        data: { lastFailedAt: nowDate },
      });
      await tx.authLoginAttempt.create({
        data: {
          ip: input.ip,
          username: input.username,
          ok: false,
          reason: 'locked',
          userAgent: input.userAgent,
          requestId: input.requestId,
          lockedUntil: prev?.lockedUntil || null,
        },
      });
      return { failCount: prev?.failCount || input.policy.maxFails, lockedUntil: prevLockedUntil };
    }

    const prevBaseMs =
      input.windowMode === 'sliding'
        ? (prev?.lastFailedAt ? prev.lastFailedAt.getTime() : 0)
        : (prev?.firstFailedAt ? prev.firstFailedAt.getTime() : 0);
    const windowExpired = !prev || input.now - prevBaseMs >= input.failWindowMs || (prev.failCount || 0) <= 0;

    const nextFailCount = windowExpired ? 1 : (prev.failCount || 0) + 1;
    const nextFirstFailedAt = windowExpired ? nowDate : (input.windowMode === 'sliding' ? nowDate : prev.firstFailedAt);
    const nextLockedUntilDate = nextFailCount >= input.policy.maxFails ? new Date(input.now + input.policy.lockMs) : null;

    await tx.authLoginLockout.upsert({
      where: { ip_username: { ip: input.ip, username: input.username } },
      create: {
        ip: input.ip,
        username: input.username,
        failCount: nextFailCount,
        firstFailedAt: nextFirstFailedAt,
        lastFailedAt: nowDate,
        lockedUntil: nextLockedUntilDate,
      },
      update: {
        failCount: nextFailCount,
        firstFailedAt: nextFirstFailedAt,
        lastFailedAt: nowDate,
        lockedUntil: nextLockedUntilDate,
      },
    });

    await tx.authLoginAttempt.create({
      data: {
        ip: input.ip,
        username: input.username,
        ok: false,
        reason: 'invalid_credentials',
        userAgent: input.userAgent,
        requestId: input.requestId,
        lockedUntil: nextLockedUntilDate,
      },
    });

    return {
      failCount: nextFailCount,
      lockedUntil: nextLockedUntilDate ? nextLockedUntilDate.getTime() : null,
    };
  });
}

/**
 * upsertLockoutFromBlocked
 * 当请求因“已锁定”被拦截时，更新 lockout 的 last_failed_at，必要时补齐 locked_until
 */
async function upsertLockoutFromBlocked(ip: string, username: string, lockedUntil: number) {
  try {
    const now = new Date();
    const lockedUntilDate = new Date(lockedUntil);
    const maxFails = Math.max(authGuardConfig.loginMaxFailsDoctor, authGuardConfig.loginMaxFailsAdmin, 1);
    await prisma.authLoginLockout.upsert({
      where: { ip_username: { ip, username } },
      create: {
        ip,
        username,
        failCount: maxFails,
        firstFailedAt: now,
        lastFailedAt: now,
        lockedUntil: lockedUntilDate,
      },
      update: {
        failCount: maxFails,
        lastFailedAt: now,
        lockedUntil: lockedUntilDate,
      },
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (isMissingTableError(err)) {warnLoginDbMissingOnce(err);}
  }
}

/**
 * persistLoginAttempt
 * 将登录尝试写入数据库（无表或异常时不影响主流程）
 */
async function persistLoginAttempt(input: {
  ip: string;
  username: string | null;
  operatorId: number | null;
  ok: boolean;
  reason: string | null;
  userAgent: string | null;
  requestId: string | null;
  lockedUntil: number | null;
}) {
  try {
    await prisma.authLoginAttempt.create({
      data: {
        ip: input.ip,
        username: input.username,
        operatorId: input.operatorId,
        ok: input.ok,
        reason: input.reason,
        userAgent: input.userAgent,
        requestId: input.requestId,
        lockedUntil: input.lockedUntil ? new Date(input.lockedUntil) : null,
      },
    });
  } catch (e: any) {
    if (isMissingTableError(e)) {warnLoginDbMissingOnce(e);}
  }
}

/**
 * isMissingTableError
 * 判断是否为 Prisma 的“表不存在”错误，便于在未执行建表 SQL 时兼容运行
 */
function isMissingTableError(e: any): boolean {
  const code = String(e?.code || '').trim();
  if (code === 'P2021') {return true;}
  const msg = String(e?.message || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('table');
}

/**
 * warnLoginDbMissingOnce
 * 首次检测到登录审计相关表不存在时打印提示日志，避免刷屏
 */
function warnLoginDbMissingOnce(e: any) {
  if (warnedLoginDbMissing) {return;}
  warnedLoginDbMissing = true;
  secureLogger.warn('[auth.login] 登录审计/锁定相关表不存在，已自动退化为 Redis/内存方案，请先执行建表 SQL');
}
