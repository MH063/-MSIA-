import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serverConfig } from '../config';

const SALT_ROUNDS = 10;
const DEFAULT_JWT_SECRET = 'your-secret-key';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const JWT_EXPIRES_IN = '7d' as const;
const ACCESS_JWT_EXPIRES_IN = (process.env.AUTH_ACCESS_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];
const REFRESH_JWT_EXPIRES_IN = (process.env.AUTH_REFRESH_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
const DEFAULT_REFRESH_JWT_SECRET = `${DEFAULT_JWT_SECRET}-refresh`;
const REFRESH_JWT_SECRET =
  process.env.REFRESH_JWT_SECRET || process.env.JWT_SECRET || DEFAULT_REFRESH_JWT_SECRET;

if (serverConfig.isProduction && JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET 未配置：生产环境禁止使用默认密钥');
}

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
}

export interface RefreshJwtPayload extends JwtPayload {
  typ: 'refresh';
  sid: string;
  jti: string;
}

/**
 * 生成登录JWT
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, typ: 'access' }, JWT_SECRET, { expiresIn: ACCESS_JWT_EXPIRES_IN });
}

export function signRefreshToken(input: { operatorId: number; role: string; sid: string; jti: string }): string {
  return jwt.sign(
    { operatorId: input.operatorId, role: input.role, sid: input.sid, jti: input.jti, typ: 'refresh' },
    REFRESH_JWT_SECRET,
    { expiresIn: REFRESH_JWT_EXPIRES_IN }
  );
}

/**
 * 验证JWT并解析负载
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AccessJwtPayload;
    if (!payload || typeof payload !== 'object') return null;
    if (payload.typ && payload.typ !== 'access') return null;
    if (!Number.isFinite((payload as any).operatorId)) return null;
    if (typeof (payload as any).role !== 'string') return null;
    return { operatorId: Number((payload as any).operatorId), role: String((payload as any).role) };
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshJwtPayload | null {
  try {
    const payload = jwt.verify(token, REFRESH_JWT_SECRET) as RefreshJwtPayload;
    if (!payload || typeof payload !== 'object') return null;
    if ((payload as any).typ !== 'refresh') return null;
    if (!Number.isFinite((payload as any).operatorId)) return null;
    if (typeof (payload as any).role !== 'string') return null;
    const sid = String((payload as any).sid || '').trim();
    const jti = String((payload as any).jti || '').trim();
    if (!sid || !jti) return null;
    return {
      operatorId: Number((payload as any).operatorId),
      role: String((payload as any).role),
      typ: 'refresh',
      sid,
      jti,
    };
  } catch {
    return null;
  }
}
