import { NextFunction, Request, Response } from 'express';
import { serverConfig } from '../config';

export type OperatorRole = 'admin' | 'doctor';

export interface OperatorIdentity {
  token: string;
  operatorId: number;
  role: OperatorRole;
}

export function parseBearerToken(req: Request): string | null {
  const raw = req.header('authorization') || req.header('Authorization') || '';
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const match = /^Bearer\s+(.+)$/iu.exec(trimmed);
  if (!match) return null;
  const token = String(match[1] || '').trim();
  return token || null;
}

export function loadOperatorFromToken(token: string): OperatorIdentity | null {
  const t = String(token || '').trim();
  if (!t) return null;

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
      console.warn('[auth] OPERATOR_TOKENS_JSON 解析失败', e);
    }
  }

  const single = String(process.env.OPERATOR_TOKEN || '').trim();
  if (single && t === single) {
    return { token: t, operatorId: 0, role: 'admin' };
  }

  if (serverConfig.isDevelopment && !single && !json.trim()) {
    if (t === 'dev-admin') {
      console.warn('[auth] 当前未配置 OPERATOR_TOKEN/OPERATOR_TOKENS_JSON，使用 dev-admin 作为开发环境管理员 token');
      return { token: t, operatorId: 0, role: 'admin' };
    }
  }

  return null;
}

export function requireOperator(req: Request, res: Response, next: NextFunction) {
  const token = parseBearerToken(req);
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

