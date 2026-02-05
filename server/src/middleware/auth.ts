import { NextFunction, Request, Response } from 'express';
import { authCookieConfig, serverConfig } from '../config';
import { verifyToken } from '../utils/auth-helpers';

export type OperatorRole = 'admin' | 'doctor';

export type OperatorPermission =
  | 'auth:me'
  | 'diagnosis:init'
  | 'diagnosis:read'
  | 'diagnosis:suggest'
  | 'knowledge:read'
  | 'knowledge:write'
  | 'mapping:read'
  | 'nlp:use'
  | 'patient:create'
  | 'patient:delete'
  | 'patient:list'
  | 'session:bulkDelete'
  | 'session:create'
  | 'session:export'
  | 'session:list'
  | 'session:read'
  | 'session:report'
  | 'session:stats'
  | 'session:update'
  | 'session:delete';

export interface OperatorIdentity {
  token: string;
  operatorId: number;
  role: OperatorRole;
}

const ROLE_PERMISSIONS: Record<OperatorRole, OperatorPermission[]> = {
  admin: [
    'auth:me',
    'diagnosis:init',
    'diagnosis:read',
    'diagnosis:suggest',
    'knowledge:read',
    'knowledge:write',
    'mapping:read',
    'nlp:use',
    'patient:create',
    'patient:delete',
    'patient:list',
    'session:bulkDelete',
    'session:create',
    'session:delete',
    'session:export',
    'session:list',
    'session:read',
    'session:report',
    'session:stats',
    'session:update',
  ],
  doctor: [
    'auth:me',
    'diagnosis:read',
    'diagnosis:suggest',
    'knowledge:read',
    'mapping:read',
    'nlp:use',
    'patient:create',
    'patient:list',
    'session:create',
    'session:delete',
    'session:export',
    'session:list',
    'session:read',
    'session:report',
    'session:stats',
    'session:update',
  ],
};

export function parseBearerToken(req: Request): string | null {
  const raw = req.header('authorization') || req.header('Authorization') || '';
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const match = /^Bearer\s+(.+)$/iu.exec(trimmed);
  if (!match) return null;
  const token = String(match[1] || '').trim();
  return token || null;
}

function parseCookieHeader(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const s = String(raw || '').trim();
  if (!s) return out;
  const parts = s.split(';');
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const idx = p.indexOf('=');
    if (idx <= 0) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function parseAccessTokenFromCookie(req: Request): string | null {
  const raw = String(req.header('cookie') || '').trim();
  if (!raw) return null;
  const jar = parseCookieHeader(raw);
  const t = String(jar[authCookieConfig.accessCookieName] || '').trim();
  return t || null;
}

function parseTokenFromQuery(req: Request): string | null {
  const accept = String(req.header('accept') || '').toLowerCase();
  const maybeSse = accept.includes('text/event-stream') || String(req.path || '').endsWith('/stream');
  if (!maybeSse) return null;

  const raw = (req.query as any)?.token;
  const t = Array.isArray(raw) ? String(raw[0] || '').trim() : String(raw || '').trim();
  return t || null;
}

export function parseOperatorToken(req: Request): string | null {
  return parseAccessTokenFromCookie(req) || parseBearerToken(req) || parseTokenFromQuery(req);
}

export function loadOperatorFromToken(token: string): OperatorIdentity | null {
  const t = String(token || '').trim();
  if (!t) return null;

  // 1. 尝试验证 JWT
  const jwtPayload = verifyToken(t);
  if (jwtPayload) {
    return {
      token: t,
      operatorId: jwtPayload.operatorId,
      role: jwtPayload.role as OperatorRole,
    };
  }

  if (serverConfig.isDevelopment && t === 'dev-admin') {
    console.warn('[auth] 开发环境使用 dev-admin 作为管理员 token');
    return { token: t, operatorId: 0, role: 'admin' };
  }

  const json = process.env.OPERATOR_TOKENS_JSON || '';
  if (json.trim()) {
    try {
      const parsed = JSON.parse(json) as Record<
        string,
        { operatorId?: unknown; role?: unknown }
      >;
      const hit = parsed[t];
      if (hit && typeof hit === 'object') {
        const operatorId = Number((hit as any).operatorId);
        const roleRaw = String((hit as any).role || '').trim();
        const role: OperatorRole = roleRaw === 'doctor' ? 'doctor' : 'admin';
        if (Number.isFinite(operatorId) && operatorId >= 0) {
          return { token: t, operatorId, role };
        }
        if (role === 'admin') {
          return { token: t, operatorId: 0, role };
        }
      }
    } catch (e) {
      console.warn('[auth] OPERATOR_TOKENS_JSON 解析失败');
      if (serverConfig.isDevelopment) console.warn(e);
    }
  }

  const single = (() => {
    const raw = String(process.env.OPERATOR_TOKEN || '').trim();
    if (!raw) return '';
    if (serverConfig.isProduction && raw === 'default_token_change_in_production') return '';
    return raw;
  })();
  if (single && t === single) {
    return { token: t, operatorId: 0, role: 'admin' };
  }
  
  // 开发环境默认token
  if (serverConfig.isDevelopment && t === 'dev-token') {
    return { token: t, operatorId: 0, role: 'admin' };
  }

  return null;
}

export function requireOperator(req: Request, res: Response, next: NextFunction) {
  const token = parseOperatorToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '缺少操作人Token' },
    });
    return;
  }

  const operator = loadOperatorFromToken(token);
  if (!operator) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '无效的操作人Token' },
    });
    return;
  }

  (req as any).operator = operator;
  next();
}

export function requirePermission(perms: OperatorPermission | OperatorPermission[]) {
  const required = Array.isArray(perms) ? perms : [perms];
  return (req: Request, res: Response, next: NextFunction) => {
    const token = parseOperatorToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '缺少操作人Token' },
      });
      return;
    }

    const operator = loadOperatorFromToken(token);
    if (!operator) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '无效的操作人Token' },
      });
      return;
    }

    const allowed = new Set(ROLE_PERMISSIONS[operator.role] || []);
    const ok = required.every((p) => allowed.has(p));
    if (!ok) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: '权限不足' },
      });
      return;
    }

    (req as any).operator = operator;
    next();
  };
}

export function requireRoles(roles: OperatorRole | OperatorRole[]) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req: Request, res: Response, next: NextFunction) => {
    const token = parseOperatorToken(req);
    if (!token) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '缺少操作人Token' },
      });
      return;
    }

    const operator = loadOperatorFromToken(token);
    if (!operator) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '无效的操作人Token' },
      });
      return;
    }

    if (!allowed.includes(operator.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: '权限不足' },
      });
      return;
    }

    (req as any).operator = operator;
    next();
  };
}

export const requireAdmin = requireRoles('admin');
