/**
 * 安全工具函数
 * 提供XSS防护、SQL注入防护等安全功能
 */

import { Request, Response, NextFunction } from 'express';

/**
 * XSS防护 - 清理用户输入
 * @param input 用户输入
 * @returns 清理后的字符串
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return '';

  return (
    input
      // 转义HTML特殊字符
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      // 移除潜在的脚本事件
      .replace(/on\w+\s*=/gi, '')
      // 移除javascript:伪协议
      .replace(/javascript:/gi, '')
      // 移除data: URI（可能包含恶意代码）
      .replace(/data:/gi, '')
      // 移除表达式
      .replace(/expression\s*\(/gi, '')
      .trim()
  );
}

/**
 * 递归清理对象中的所有字符串值
 * @param obj 要清理的对象
 * @returns 清理后的对象
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeInput(value) as T[keyof T];
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        sanitized[key as keyof T] = value.map((item) =>
          typeof item === 'string' ? sanitizeInput(item) : typeof item === 'object' ? sanitizeObject(item as Record<string, unknown>) : item
        ) as T[keyof T];
      } else {
        sanitized[key as keyof T] = sanitizeObject(value as Record<string, unknown>) as T[keyof T];
      }
    } else {
      sanitized[key as keyof T] = value as T[keyof T];
    }
  }

  return sanitized;
}

/**
 * SQL注入检测
 * 检测常见的SQL注入模式
 * @param input 输入字符串
 * @returns 是否包含SQL注入风险
 */
export function detectSqlInjection(input: string): boolean {
  if (!input) return false;

  // SQL注入检测模式
  const sqlInjectionPatterns = [
    // 注释
    /(--|#|\/\*)/i,
    // 联合查询
    /union\s+select/i,
    // 堆叠查询
    /;\s*drop\s+/i,
    /;\s*delete\s+/i,
    /;\s*insert\s+/i,
    /;\s*update\s+/i,
    // 布尔盲注
    /'\s*or\s*'\d+'\s*=\s*'\d+/i,
    /'\s*or\s*\d+\s*=\s*\d+/i,
    // 时间盲注
    /waitfor\s+delay/i,
    /benchmark\s*\(/i,
    /sleep\s*\(/i,
    // 错误注入
    /'\s*and\s*\d+\s*=\s*\d+/i,
    // 子查询
    /\(\s*select\s+/i,
    // 存储过程
    /exec\s*\(/i,
    /execute\s*\(/i,
    // 系统表访问
    /information_schema/i,
    /sys\./i,
    // 危险函数
    /xp_/i,
    /sp_/i,
  ];

  return sqlInjectionPatterns.some((pattern) => pattern.test(input));
}

/**
 * SQL注入防护中间件
 * 检测请求中的SQL注入风险
 */
export function sqlInjectionProtection(req: Request, res: Response, next: NextFunction) {
  const checkValue = (value: unknown, path: string): string | null => {
    if (typeof value === 'string') {
      if (detectSqlInjection(value)) {
        return path;
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        const result = checkValue(val, `${path}.${key}`);
        if (result) return result;
      }
    }
    return null;
  };

  // 检查请求体
  if (req.body && typeof req.body === 'object') {
    const suspiciousField = checkValue(req.body, 'body');
    if (suspiciousField) {
      console.warn(`[Security] SQL注入风险检测: ${suspiciousField}`, {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      return res.status(400).json({
        success: false,
        error: {
          code: 'SECURITY_VIOLATION',
          message: '请求包含不安全的内容',
        },
      });
    }
  }

  // 检查查询参数
  if (req.query && typeof req.query === 'object') {
    const suspiciousField = checkValue(req.query, 'query');
    if (suspiciousField) {
      console.warn(`[Security] SQL注入风险检测: ${suspiciousField}`, {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      return res.status(400).json({
        success: false,
        error: {
          code: 'SECURITY_VIOLATION',
          message: '请求包含不安全的内容',
        },
      });
    }
  }

  next();
}

/**
 * XSS防护中间件
 * 清理请求中的所有字符串值
 */
export function xssProtection(req: Request, res: Response, next: NextFunction) {
  // 清理请求体
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // 清理查询参数
  if (req.query && typeof req.query === 'object') {
    const sanitizedQuery: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        sanitizedQuery[key] = sanitizeInput(value);
      } else if (Array.isArray(value)) {
        sanitizedQuery[key] = value.map((item) =>
          typeof item === 'string' ? sanitizeInput(item) : String(item)
        );
      } else {
        sanitizedQuery[key] = value === undefined ? undefined : String(value);
      }
    }
    const queryObj = req.query as Record<string, unknown>;
    for (const key of Object.keys(queryObj)) {
      delete (queryObj as any)[key];
    }
    for (const [key, value] of Object.entries(sanitizedQuery)) {
      (queryObj as any)[key] = value;
    }
  }

  next();
}

/**
 * 速率限制配置
 */
export const rateLimitConfig = {
  // 通用API限制
  api: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 1000, // 最多1000次请求
  },
  // 诊断建议API限制（更严格）
  diagnosis: {
    windowMs: 60 * 1000, // 1分钟
    max: 30, // 最多30次请求
  },
  // 文件上传限制
  upload: {
    windowMs: 60 * 60 * 1000, // 1小时
    max: 50, // 最多50次上传
  },
};

/**
 * 安全响应头中间件
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  // 防止MIME类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS保护
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // 强制HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // 内容安全策略
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
  );
  // 引用策略
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 权限策略
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

/**
 * 生成安全的文件名
 * @param originalName 原始文件名
 * @returns 安全的文件名
 */
export function generateSafeFileName(originalName: string): string {
  // 移除路径分隔符和危险字符
  const safeName = originalName
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\.\./g, '')
    .trim();

  // 添加随机前缀防止文件名冲突
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  // 提取扩展名
  const lastDotIndex = safeName.lastIndexOf('.');
  const extension = lastDotIndex > 0 ? safeName.substring(lastDotIndex) : '';
  const baseName = lastDotIndex > 0 ? safeName.substring(0, lastDotIndex) : safeName;

  return `${timestamp}-${random}-${baseName}${extension}`;
}

/**
 * 验证文件扩展名
 * @param fileName 文件名
 * @param allowedExtensions 允许的扩展名列表
 * @returns 是否允许
 */
export function isAllowedFileType(
  fileName: string,
  allowedExtensions: string[]
): boolean {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return allowedExtensions.includes(extension);
}
