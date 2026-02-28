import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;

const JWT_SECRET_RAW = process.env.JWT_SECRET;
const REFRESH_JWT_SECRET_RAW = process.env.REFRESH_JWT_SECRET || process.env.JWT_SECRET;

if (!JWT_SECRET_RAW || JWT_SECRET_RAW.trim() === '') {
  throw new Error('JWT_SECRET 未配置：请在环境变量中设置 JWT_SECRET');
}

if (!REFRESH_JWT_SECRET_RAW || REFRESH_JWT_SECRET_RAW.trim() === '') {
  throw new Error('REFRESH_JWT_SECRET 未配置：请在环境变量中设置 REFRESH_JWT_SECRET（或使用 JWT_SECRET 作为默认值）');
}

const JWT_SECRET: string = JWT_SECRET_RAW;
const REFRESH_JWT_SECRET: string = REFRESH_JWT_SECRET_RAW;

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
    const raw = jwt.verify(token, JWT_SECRET) as unknown;
    if (!raw || typeof raw !== 'object') {return null;}
    const p = raw as Partial<AccessJwtPayload>;
    if (p.typ && p.typ !== 'access') {return null;}
    if (!('operatorId' in p) || typeof p.operatorId !== 'number' || !Number.isFinite(p.operatorId)) {return null;}
    if (!('role' in p) || typeof p.role !== 'string') {return null;}
    return { operatorId: p.operatorId, role: p.role };
  } catch (_error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshJwtPayload | null {
  try {
    const raw = jwt.verify(token, REFRESH_JWT_SECRET) as unknown;
    if (!raw || typeof raw !== 'object') {return null;}
    const p = raw as Partial<RefreshJwtPayload>;
    if (p.typ !== 'refresh') {return null;}
    if (!('operatorId' in p) || typeof p.operatorId !== 'number' || !Number.isFinite(p.operatorId)) {return null;}
    if (!('role' in p) || typeof p.role !== 'string') {return null;}
    const sid = typeof p.sid === 'string' ? p.sid.trim() : '';
    const jti = typeof p.jti === 'string' ? p.jti.trim() : '';
    if (!sid || !jti) {return null;}
    return {
      operatorId: p.operatorId,
      role: p.role,
      typ: 'refresh',
      sid,
      jti,
    };
  } catch {
    return null;
  }
}
