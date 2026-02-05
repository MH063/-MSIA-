/**
 * 安全工具 - 防止信息泄露
 */

import { Request, Response, NextFunction } from 'express';

/**
 * 安全响应头中间件
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // 防止XSS攻击
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // 防止MIME类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  
  // 内容安全策略
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
  
  // 引用者策略
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 隐藏服务器信息
  res.setHeader('X-Powered-By', '');
  
  next();
};

/**
 * SQL注入防护中间件
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  // 检查请求体中的可疑SQL模式
  const suspiciousPatterns = [
    /(\bor\b|\band\b|\bxor\b|\bselect\b|\bunion\b|\bdrop\b|\binsert\b|\bupdate\b|\bdelete\b)/i,
    /['";\\]/,
    /(\bexec\b|\bexecute\b|\bsp_)/i
  ];
  
  const checkValue = (value: unknown): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  // 检查查询参数
  const queryValues = Object.values(req.query || {});
  if (queryValues.some(checkValue)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请求包含非法字符' }
    });
    return;
  }
  
  // 检查请求体
  if (req.body && typeof req.body === 'object') {
    const bodyValues = Object.values(req.body);
    if (bodyValues.some(checkValue)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请求包含非法字符' }
      });
      return;
    }
  }
  
  next();
};

/**
 * XSS防护中间件
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction): void => {
  // XSS检测模式
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<[^>]*on\w+[^>]*>/gi
  ];
  
  const checkForXSS = (value: unknown): boolean => {
    if (typeof value === 'string') {
      return xssPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  // 检查文本输入字段
  if (req.body && typeof req.body === 'object') {
    const bodyValues = Object.values(req.body);
    if (bodyValues.some(checkForXSS)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '检测到潜在的XSS攻击' }
      });
      return;
    }
  }
  
  next();
};

export interface SecurityConfig {
  enableFiltering: boolean;
  enableTruncation: boolean;
  maxLogLength: number;
  maxErrorDepth: number;
}

// 默认安全配置
const DEFAULT_CONFIG: SecurityConfig = {
  enableFiltering: process.env.NODE_ENV === 'production',
  enableTruncation: true,
  maxLogLength: 1000,
  maxErrorDepth: 3
};

// 需要过滤的敏感字段
const SENSITIVE_FIELDS = [
  'password',
  'pwd',
  'token',
  'secret',
  'key',
  'api_key',
  'auth',
  'authorization',
  'credential',
  'private_key',
  'db_password',
  'jwt',
  'refresh_token',
  'access_token',
  'db_url',
  'connection_string',
  'secret_key',
  'salt',
  'hash',
  'verification_code',
  'otp',
  'session_id',
  'cookie'
];

// 需要脱敏的字段模式
const SENSITIVE_PATTERNS = [
  /password[:=]\s*['"]?[^'"\\s,}]+/i,
  /token[:=]\s*['"]?[^'"\\s,}]+/i,
  /secret[:=]\s*['"]?[^'"\\s,}]+/i,
  /key[:=]\s*['"]?[^'"\\s,}]+/i,
  /jwt[:=]\s*['"]?[^'"\\s,}]+/i,
  /authorization[:=]\s*['"]?[^'"\\s,}]+/i,
  /auth[:=]\s*['"]?[^'"\\s,}]+/i
];

/**
 * 深度过滤对象中的敏感信息
 */
export function filterSensitiveData(obj: unknown, config: SecurityConfig = DEFAULT_CONFIG): unknown {
  if (!config.enableFiltering) return obj;
  
  return filterObject(obj, config);
}

/**
 * 递归过滤对象
 */
function filterObject(obj: unknown, config: SecurityConfig, depth: number = 0): unknown {
  if (depth > config.maxErrorDepth) return '[object]';
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return filterString(obj, config);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => filterObject(item, config, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        result[key] = '[FILTERED]';
      } else {
        result[key] = filterObject(value, config, depth + 1);
      }
    }
    
    return result;
  }
  
  return String(obj);
}

/**
 * 判断是否为敏感键名
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_FIELDS.some(field => lowerKey.includes(field));
}

/**
 * 过滤字符串中的敏感信息
 */
function filterString(str: string, config: SecurityConfig): string {
  let filtered = str;
  
  // 替换敏感字段模式
  for (const pattern of SENSITIVE_PATTERNS) {
    filtered = filtered.replace(pattern, '[FILTERED]');
  }
  
  // 截断过长字符串
  if (config.enableTruncation && filtered.length > config.maxLogLength) {
    return filtered.substring(0, config.maxLogLength) + '...[TRUNCATED]';
  }
  
  return filtered;
}

/**
 * 安全地解析JSON，避免信息泄露
 */
export function safeJsonParse(jsonStr: string, config: SecurityConfig = DEFAULT_CONFIG): unknown {
  try {
    const parsed = JSON.parse(jsonStr);
    return filterSensitiveData(parsed, config);
  } catch {
    // JSON解析失败，返回过滤后的字符串
    return filterString(jsonStr, config);
  }
}

/**
 * 安全的错误处理 - 脱敏错误信息
 */
export function sanitizeError(error: Error, config: SecurityConfig = DEFAULT_CONFIG): Error {
  const sanitized = new Error();
  
  // 过滤错误消息
  sanitized.message = filterString(error.message, config);
  
  // 过滤错误堆栈（生产环境）
  if (config.enableFiltering && process.env.NODE_ENV === 'production') {
    sanitized.stack = '[STACK_HIDDEN]';
  } else {
    // 非生产环境也进行一定程度的脱敏
    sanitized.stack = filterString(error.stack || '', {
      ...config,
      maxLogLength: Math.min(config.maxLogLength, 500)
    });
  }
  
  return sanitized;
}

/**
 * 安全的日志输出
 */
export function safeLog(message: string, ...args: unknown[]): void {
  const config = DEFAULT_CONFIG;
  
  // 过滤消息
  const filteredMessage = filterString(message, config);
  
  // 过滤参数
  const filteredArgs = args.map(arg => filterSensitiveData(arg, config));
  
  console.log(filteredMessage, ...filteredArgs);
}

/**
 * 安全的错误日志
 */
export function safeError(message: string, error: Error, ...args: unknown[]): void {
  const config = DEFAULT_CONFIG;
  
  // 过滤消息
  const filteredMessage = filterString(message, config);
  
  // 脱敏错误
  const sanitizedError = sanitizeError(error, config);
  
  // 过滤其他参数
  const filteredArgs = args.map(arg => filterSensitiveData(arg, config));
  
  console.error(filteredMessage, sanitizedError, ...filteredArgs);
}

/**
 * 限制控制台输出长度
 */
export function truncateOutput(output: string, maxLength: number = 1000): string {
  if (output.length <= maxLength) return output;
  return output.substring(0, maxLength) + `\n\n[OUTPUT_TRUNCATED: ${output.length - maxLength} characters hidden]`;
}

/**
 * 安全的类型检查 - 防止原型污染
 */
export function safeTypeOf(value: unknown): string {
  try {
    return typeof value;
  } catch {
    return 'unknown';
  }
}

/**
 * 安全的对象属性访问
 */
export function safeGet(obj: unknown, path: string, defaultValue: unknown = undefined): unknown {
  try {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue;
      }
      current = (current as Record<string, unknown>)[key];
    }
    
    return current;
  } catch {
    return defaultValue;
  }
}