import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getRedisClient } from './redis-client';
import { secureLogger } from './secureLogger';
import { serverConfig } from '../config';

const SALT_ROUNDS = 10;

/**
 * JWT密钥轮换管理
 * 支持多密钥验证，实现平滑的密钥轮换
 */

interface JwtSecretConfig {
  current: string;
  previous?: string;
  rotatedAt?: number;
  expiresAt?: number;
}

interface KeyRotationStatus {
  lastRotation: string | null;
  nextRotation: string | null;
  currentKeyAge: number;
  isRotationDue: boolean;
}

const ROTATION_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30天
const ROTATION_OVERLAP_MS = 24 * 60 * 60 * 1000; // 密钥轮换后旧密钥保留24小时

let secretConfig: JwtSecretConfig;
let rotationTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 初始化JWT密钥配置
 */
function initSecretConfig(): JwtSecretConfig {
  const currentSecret = process.env.JWT_SECRET;
  const previousSecret = process.env.JWT_PREVIOUS_SECRET;
  
  if (!currentSecret || currentSecret.trim() === '') {
    throw new Error('JWT_SECRET 未配置：请在环境变量中设置 JWT_SECRET');
  }

  return {
    current: currentSecret,
    previous: previousSecret || undefined,
    rotatedAt: previousSecret ? Date.now() : undefined,
    expiresAt: previousSecret ? Date.now() + ROTATION_OVERLAP_MS : undefined,
  };
}

secretConfig = initSecretConfig();

const REFRESH_JWT_SECRET = process.env.REFRESH_JWT_SECRET || process.env.JWT_SECRET;

if (!REFRESH_JWT_SECRET || REFRESH_JWT_SECRET.trim() === '') {
  throw new Error('REFRESH_JWT_SECRET 未配置');
}

const JWT_EXPIRES_IN = '7d' as const;
const ACCESS_JWT_EXPIRES_IN = (process.env.AUTH_ACCESS_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];
const REFRESH_JWT_EXPIRES_IN = (process.env.AUTH_REFRESH_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

/**
 * 对明文密码进行加盐哈希
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 比较明文密码与已存储哈希
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtPayload {
  operatorId: number;
  role: string;
}

export interface AccessJwtPayload extends JwtPayload {
  typ?: 'access';
  kid?: string; // 密钥ID，用于标识使用的密钥版本
}

export interface RefreshJwtPayload extends JwtPayload {
  typ: 'refresh';
  sid: string;
  jti: string;
}

/**
 * 获取当前签名密钥
 */
function getCurrentSecret(): { secret: string; kid: string } {
  return {
    secret: secretConfig.current,
    kid: 'current',
  };
}

/**
 * 验证JWT时尝试所有有效密钥
 */
function verifyWithAnySecret(token: string): { payload: jwt.JwtPayload; kid: string } | null {
  const secrets = [
    { secret: secretConfig.current, kid: 'current' },
    ...(secretConfig.previous ? [{ secret: secretConfig.previous, kid: 'previous' }] : []),
  ];

  for (const { secret, kid } of secrets) {
    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      return { payload, kid };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 生成登录JWT
 */
export function signToken(payload: JwtPayload): string {
  const { secret, kid } = getCurrentSecret();
  return jwt.sign({ ...payload, kid }, secret, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 生成Access Token
 */
export function signAccessToken(payload: JwtPayload): string {
  const { secret, kid } = getCurrentSecret();
  return jwt.sign({ ...payload, typ: 'access', kid }, secret, { expiresIn: ACCESS_JWT_EXPIRES_IN });
}

/**
 * 生成Refresh Token
 */
export function signRefreshToken(input: { operatorId: number; role: string; sid: string; jti: string }): string {
  const { secret, kid } = getCurrentSecret();
  return jwt.sign(
    { operatorId: input.operatorId, role: input.role, sid: input.sid, jti: input.jti, typ: 'refresh', kid },
    secret,
    { expiresIn: REFRESH_JWT_EXPIRES_IN }
  );
}

/**
 * 验证JWT并解析负载
 */
export function verifyToken(token: string): JwtPayload | null {
  const result = verifyWithAnySecret(token);
  if (!result || !result.payload) {
    return null;
  }

  const p = result.payload as Partial<AccessJwtPayload>;
  if (p.typ && p.typ !== 'access') {
    return null;
  }
  if (!('operatorId' in p) || typeof p.operatorId !== 'number' || !Number.isFinite(p.operatorId)) {
    return null;
  }
  if (!('role' in p) || typeof p.role !== 'string') {
    return null;
  }

  // 如果使用旧密钥签发的Token，记录日志
  if (result.kid === 'previous') {
    secureLogger.info('[JWT] 使用旧密钥验证Token，建议客户端刷新', { operatorId: p.operatorId });
  }

  return { operatorId: p.operatorId, role: p.role };
}

/**
 * 验证Refresh Token
 */
export function verifyRefreshToken(token: string): RefreshJwtPayload | null {
  const result = verifyWithAnySecret(token);
  if (!result || !result.payload) {
    return null;
  }

  const p = result.payload as Partial<RefreshJwtPayload>;
  if (p.typ !== 'refresh') {
    return null;
  }
  if (!('operatorId' in p) || typeof p.operatorId !== 'number' || !Number.isFinite(p.operatorId)) {
    return null;
  }
  if (!('role' in p) || typeof p.role !== 'string') {
    return null;
  }
  const sid = typeof p.sid === 'string' ? p.sid.trim() : '';
  const jti = typeof p.jti === 'string' ? p.jti.trim() : '';
  if (!sid || !jti) {
    return null;
  }

  return {
    operatorId: p.operatorId,
    role: p.role,
    typ: 'refresh',
    sid,
    jti,
  };
}

/**
 * 检查是否需要轮换密钥
 */
export function isRotationDue(): boolean {
  if (!secretConfig.rotatedAt) {
    return false;
  }
  return Date.now() - secretConfig.rotatedAt > ROTATION_INTERVAL_MS;
}

/**
 * 获取密钥轮换状态
 */
export function getRotationStatus(): KeyRotationStatus {
  const now = Date.now();
  const lastRotation = secretConfig.rotatedAt ? new Date(secretConfig.rotatedAt).toISOString() : null;
  const nextRotation = secretConfig.rotatedAt 
    ? new Date(secretConfig.rotatedAt + ROTATION_INTERVAL_MS).toISOString() 
    : null;
  const currentKeyAge = secretConfig.rotatedAt ? now - secretConfig.rotatedAt : 0;

  return {
    lastRotation,
    nextRotation,
    currentKeyAge,
    isRotationDue: isRotationDue(),
  };
}

/**
 * 执行密钥轮换
 * 需要手动调用，通常通过管理接口或定时任务触发
 */
export async function rotateSecret(newSecret: string): Promise<{ success: boolean; message: string }> {
  if (!newSecret || newSecret.length < 32) {
    return { success: false, message: '新密钥长度必须至少32位' };
  }

  const now = Date.now();

  // 将当前密钥降级为previous
  secretConfig = {
    current: newSecret,
    previous: secretConfig.current,
    rotatedAt: now,
    expiresAt: now + ROTATION_OVERLAP_MS,
  };

  // 记录审计日志
  secureLogger.logSecurity('JWT_KEY_ROTATION', {
    rotatedAt: new Date(now).toISOString(),
    previousKeyExpiresAt: secretConfig.expiresAt ? new Date(secretConfig.expiresAt).toISOString() : undefined,
  });

  // 尝试存储到Redis（用于分布式环境同步）
  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.set('jwt:rotation:status', JSON.stringify({
        rotatedAt: now,
        currentKeyHash: newSecret.substring(0, 8) + '...',
      }), { EX: 3600 });
    }
  } catch (err) {
    secureLogger.warn('[JWT] 无法将轮换状态同步到Redis', { error: err instanceof Error ? err.message : String(err) });
  }

  return { 
    success: true, 
    message: `密钥轮换成功，旧密钥将在 ${ROTATION_OVERLAP_MS / 3600000} 小时后失效` 
  };
}

/**
 * 清理过期的previous密钥
 */
export function cleanupExpiredSecrets(): void {
  if (secretConfig.expiresAt && Date.now() > secretConfig.expiresAt) {
    secureLogger.info('[JWT] 清理过期的旧密钥');
    secretConfig.previous = undefined;
    secretConfig.expiresAt = undefined;
  }
}

/**
 * 启动定时清理任务
 */
export function startRotationScheduler(): void {
  if (rotationTimer) {
    return;
  }

  // 每小时检查一次
  rotationTimer = setInterval(() => {
    cleanupExpiredSecrets();
    
    if (isRotationDue()) {
      secureLogger.warn('[JWT] 密钥轮换周期已到，请执行密钥轮换');
    }
  }, 60 * 60 * 1000);

  secureLogger.info('[JWT] 密钥轮换调度器已启动');
}

/**
 * 停止定时清理任务
 */
export function stopRotationScheduler(): void {
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
    secureLogger.info('[JWT] 密钥轮换调度器已停止');
  }
}

// 自动启动调度器（生产环境）
if (serverConfig.isProduction) {
  startRotationScheduler();
}
