import { NextFunction, Request, Response } from 'express';
import { authCookieConfig, serverConfig } from '../config';
import { verifyToken } from '../utils/auth-helpers';
import { secureLogger } from '../utils/secureLogger';
import { parseCookieHeader } from '../utils/cookie';

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
  if (!trimmed) {return null;}
  const match = /^Bearer\s+(.+)$/iu.exec(trimmed);
  if (!match) {return null;}
  const token = String(match[1] || '').trim();
  return token || null;
}

function parseAccessTokenFromCookie(req: Request): string | null {
  const raw = String(req.header('cookie') || '').trim();
  if (!raw) {return null;}
  const jar = parseCookieHeader(raw);
  const t = String(jar[authCookieConfig.accessCookieName] || '').trim();
  return t || null;
}

function parseTokenFromQuery(req: Request): string | null {
  const accept = String(req.header('accept') || '').toLowerCase();
  const maybeSse = accept.includes('text/event-stream') || String(req.path || '').endsWith('/stream');
  if (!maybeSse) {return null;}

  const raw = req.query?.token;
  const t = Array.isArray(raw) ? String(raw[0] || '').trim() : String(raw || '').trim();
  return t || null;
}

export function parseOperatorToken(req: Request): string | null {
  return parseAccessTokenFromCookie(req) || parseBearerToken(req) || parseTokenFromQuery(req);
}

/**
 * 检查是否允许使用开发测试 Token
 * 必须同时满足以下条件：
 * 1. NODE_ENV=development
 * 2. ENABLE_DEV_TOKENS=true（显式启用）
 * 3. 不在生产环境
 */
function isDevTokenAllowed(): boolean {
  if (serverConfig.isProduction) {
    return false;
  }
  const devTokenEnabled = String(process.env.ENABLE_DEV_TOKENS || '').trim().toLowerCase();
  return serverConfig.isDevelopment && devTokenEnabled === 'true';
}

/**
 * 预定义的开发测试 Token 列表
 * 仅在开发环境且 ENABLE_DEV_TOKENS=true 时生效
 */
const DEV_TOKENS: Record<string, { operatorId: number; role: OperatorRole }> = {
  'dev-admin': { operatorId: 0, role: 'admin' },
  'dev-doctor': { operatorId: 0, role: 'doctor' },
};

export function loadOperatorFromToken(token: string): OperatorIdentity | null {
  const t = String(token || '').trim();
  if (!t) {return null;}

  // 1. 尝试验证 JWT（优先级最高）
  const jwtPayload = verifyToken(t);
  if (jwtPayload) {
    return {
      token: t,
      operatorId: jwtPayload.operatorId,
      role: jwtPayload.role as OperatorRole,
    };
  }

  // 2. 检查开发测试 Token（仅开发环境且显式启用时生效）
  if (isDevTokenAllowed() && t in DEV_TOKENS) {
    const devToken = DEV_TOKENS[t];
    secureLogger.warn('[auth] 开发环境使用测试 Token', { token: t, role: devToken.role });
    return { token: t, operatorId: devToken.operatorId, role: devToken.role };
  }

  // 3. 检查环境变量配置的 Token 映射（JSON 格式）
  const json = process.env.OPERATOR_TOKENS_JSON || '';
  if (json.trim()) {
    try {
      const parsed = JSON.parse(json) as Record<
        string,
        { operatorId?: unknown; role?: unknown }
      >;
      const hit = parsed[t];
      if (hit && typeof hit === 'object') {
        const operatorId = Number(hit.operatorId);
        const roleRaw = String(hit.role || '').trim();
        const role: OperatorRole = roleRaw === 'doctor' ? 'doctor' : 'admin';
        if (Number.isFinite(operatorId) && operatorId >= 0) {
          return { token: t, operatorId, role };
        }
        if (role === 'admin') {
          return { token: t, operatorId: 0, role };
        }
      }
    } catch (e) {
      secureLogger.warn('[auth] OPERATOR_TOKENS_JSON 解析失败');
      if (serverConfig.isDevelopment) {secureLogger.warn('[auth] 解析错误', { error: e instanceof Error ? e.message : String(e) });}
    }
  }

  // 4. 检查单一环境变量 Token（生产环境禁止使用默认值）
  const single = (() => {
    const raw = String(process.env.OPERATOR_TOKEN || '').trim();
    if (!raw) {return '';}
    if (serverConfig.isProduction && raw === 'default_token_change_in_production') {return '';}
    return raw;
  })();
  if (single && t === single) {
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

  req.operator = operator;
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

    req.operator = operator;
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

    req.operator = operator;
    next();
  };
}

export const requireAdmin = requireRoles('admin');
