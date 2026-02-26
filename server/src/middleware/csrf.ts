/**
 * CSRF防护中间件
 * 为所有涉及数据修改的请求添加CSRF令牌验证
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { secureLogger } from '../utils/secureLogger';

/**
 * CSRF令牌配置
 */
const CSRF_CONFIG = {
  tokenLength: 32,
  headerName: 'X-CSRF-Token',
  cookieName: 'csrf_token',
  expiresIn: 3600000, // 1小时
};

/**
 * CSRF令牌存储（生产环境应使用Redis等分布式存储）
 */
const tokenStore = new Map<string, { token: string; expires: number }>();

/**
 * 生成CSRF令牌
 * @returns CSRF令牌
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
}

/**
 * 创建CSRF令牌并存储
 * @param sessionId 会话ID
 * @returns CSRF令牌
 */
export function createCsrfToken(sessionId: string): string {
  const token = generateCsrfToken();
  const expires = Date.now() + CSRF_CONFIG.expiresIn;
  
  tokenStore.set(sessionId, { token, expires });
  
  // 清理过期令牌
  cleanupExpiredTokens();
  
  return token;
}

/**
 * 验证CSRF令牌
 * @param sessionId 会话ID
 * @param token 待验证的令牌
 * @returns 是否有效
 */
export function verifyCsrfToken(sessionId: string, token: string): boolean {
  const stored = tokenStore.get(sessionId);
  
  if (!stored) {
    return false;
  }
  
  if (Date.now() > stored.expires) {
    tokenStore.delete(sessionId);
    return false;
  }
  
  return stored.token === token;
}

/**
 * 清理过期令牌
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [key, value] of tokenStore.entries()) {
    if (now > value.expires) {
      tokenStore.delete(key);
    }
  }
}

/**
 * 需要CSRF保护的方法
 */
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * 不需要CSRF保护的路径
 */
const EXCLUDED_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/captcha',
  '/health',
  '/health/detailed',
];

/**
 * CSRF保护中间件
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // 检查是否需要CSRF保护
  if (!PROTECTED_METHODS.includes(req.method)) {
    return next();
  }
  
  // 检查是否在排除列表中
  if (EXCLUDED_PATHS.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // 开发环境默认跳过CSRF验证
  if (process.env.NODE_ENV !== 'production' || process.env.SKIP_CSRF === 'true') {
    secureLogger.debug('[CSRF] 开发环境跳过CSRF验证');
    return next();
  }
  
  // 获取CSRF令牌
  const csrfToken = req.headers[CSRF_CONFIG.headerName.toLowerCase()] as string;
  
  if (!csrfToken) {
    secureLogger.warn('[CSRF] 缺少CSRF令牌', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: '缺少安全令牌，请刷新页面重试',
      },
    });
    return;
  }
  
  // 获取会话ID（从请求体、查询参数或header中获取）
  const sessionId = (req.body?.sessionId || req.query?.sessionId || req.headers['x-session-id']) as string;
  
  if (!sessionId) {
    // 如果没有会话ID，使用IP地址作为标识
    const ipBasedId = req.ip || 'unknown';
    if (!verifyCsrfToken(ipBasedId, csrfToken)) {
      secureLogger.warn('[CSRF] CSRF令牌验证失败（基于IP）', {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });
      
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: '安全令牌无效，请刷新页面重试',
        },
      });
      return;
    }
  } else {
    if (!verifyCsrfToken(sessionId, csrfToken)) {
      secureLogger.warn('[CSRF] CSRF令牌验证失败', {
        method: req.method,
        path: req.path,
        sessionId,
        ip: req.ip,
      });
      
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: '安全令牌无效，请刷新页面重试',
        },
      });
      return;
    }
  }
  
  next();
};

/**
 * CSRF令牌获取端点
 */
export const getCsrfToken = (req: Request, res: Response): void => {
  const sessionId = (req.query?.sessionId || req.headers['x-session-id'] || req.ip) as string;
  const token = createCsrfToken(sessionId);
  
  res.json({
    success: true,
    data: {
      token,
      expiresIn: CSRF_CONFIG.expiresIn,
    },
  });
};

/**
 * 为响应添加CSRF令牌的中间件
 */
export const attachCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  // 为GET请求生成新的CSRF令牌
  if (req.method === 'GET') {
    const sessionId = (req.query?.sessionId || req.headers['x-session-id'] || req.ip) as string;
    const token = createCsrfToken(sessionId);
    res.setHeader('X-CSRF-Token', token);
  }
  
  next();
};
