/**
 * 安全工具 - 防止信息泄露
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { secureLogger } from './secureLogger';

/**
 * 生成 CSP nonce
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * 扩展 Express Request 类型
 */
declare global {
  namespace Express {
    interface Request {
      cspNonce?: string;
    }
  }
}

/**
 * 安全响应头中间件
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // 生成 CSP nonce
  const nonce = generateNonce();
  req.cspNonce = nonce;

  // 防止XSS攻击
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // 防止MIME类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  
  // 内容安全策略 - 使用 nonce 替代 unsafe-inline
  // 开发环境允许 unsafe-inline 以便热更新
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    // 开发环境：允许 unsafe-inline 以支持热更新
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "font-src 'self' data:; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' ws: wss: http: https:;"
    );
  } else {
    // 生产环境：使用 nonce，移除 unsafe-inline
    res.setHeader('Content-Security-Policy',
      `default-src 'self'; ` +
      `script-src 'self' 'nonce-${nonce}'; ` +
      `style-src 'self' 'nonce-${nonce}'; ` +
      `font-src 'self' data:; ` +
      `img-src 'self' data: https: blob:; ` +
      `connect-src 'self'; ` +
      `object-src 'none'; ` +
      `base-uri 'self'; ` +
      `form-action 'self'; ` +
      `frame-ancestors 'none';`
    );
  }
  
  // 引用者策略
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 隐藏服务器信息
  res.setHeader('X-Powered-By', '');
  
  // 权限策略
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()');
  
  next();
};

/**
 * SQL注入防护中间件
 * 采用更精确的检测模式，避免误判正常输入
 * 
 * 检测策略：
 * 1. SQL注释符号
 * 2. 单引号闭合攻击
 * 3. UNION注入
 * 4. 堆叠查询
 * 5. 危险函数调用
 * 6. 布尔表达式注入
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  /**
   * 精确的 SQL 注入检测模式
   * 按危险等级排序，优先检测高危模式
   */
  const sqlInjectionPatterns = [
    // SQL 注释符号
    /--\s*$|--\s+/,
    /\/\*[\s\S]*?\*\//,
    
    // 单引号闭合攻击
    /'\s*(OR|AND|XOR)\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i,
    /'\s*(OR|AND|XOR)\s+['"][^'"]+['"]?\s*=\s*['"]/i,
    /'\s*;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)/i,
    
    // UNION 注入
    /\bUNION\s+(ALL\s+)?SELECT\b/i,
    /\bUNION\s+(ALL\s+)?\(/i,
    
    // 堆叠查询
    /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC)\b/i,
    
    // 危险存储过程和函数
    /\b(EXEC|EXECUTE)\s+\w+/i,
    /\b(xp_|sp_)\w+/i,
    
    // 布尔盲注特征
    /'\s*=\s*'/,
    /'\s*>\s*'/,
    /'\s*<\s*'/,
    
    // 时间盲注特征
    /\b(SLEEP|WAITFOR|BENCHMARK|PG_SLEEP)\s*\(/i,
    
    // 信息获取函数
    /\b(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS)\b/i,
    
    // 十六进制编码绕过
    /0x[0-9a-fA-F]+\s*\(/,
    
    // 字符串连接绕过
    /'\s*\|\|\s*'/,
    /'\s*\+\s*'/,
    
    // INTO OUTFILE/INTO DUMPFILE
    /\bINTO\s+(OUT|DUMP)FILE\b/i,
  ];

  /**
   * 检查值是否包含 SQL 注入特征
   * @param value 要检查的值
   * @returns 是否检测到注入特征
   */
  const checkValue = (value: unknown): boolean => {
    if (typeof value !== 'string' || value.length === 0) {
      return false;
    }
    
    // 检查所有 SQL 注入模式
    return sqlInjectionPatterns.some(pattern => pattern.test(value));
  };

  /**
   * 递归检查对象中的所有值
   * @param obj 要检查的对象
   * @returns 是否检测到注入特征
   */
  const checkObject = (obj: unknown): boolean => {
    if (typeof obj === 'string') {
      return checkValue(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.some(item => checkObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(value => checkObject(value));
    }
    
    return false;
  };

  // 检查查询参数
  if (checkObject(req.query)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请求参数包含潜在的SQL注入特征' }
    });
    return;
  }

  // 检查请求体
  if (req.body && checkObject(req.body)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '请求体包含潜在的SQL注入特征' }
    });
    return;
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
  if (!config.enableFiltering) {return obj;}
  
  return filterObject(obj, config);
}

/**
 * 递归过滤对象
 */
function filterObject(obj: unknown, config: SecurityConfig, depth: number = 0): unknown {
  if (depth > config.maxErrorDepth) {return '[object]';}
  
  if (obj === null || obj === undefined) {return obj;}
  
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

  // 过滤错误消息（确保是字符串）
  const message = error?.message || String(error) || 'Unknown error';
  sanitized.message = filterString(message, config);

  // 过滤错误堆栈（生产环境）
  if (config.enableFiltering && process.env.NODE_ENV === 'production') {
    sanitized.stack = '[STACK_HIDDEN]';
  } else {
    // 非生产环境也进行一定程度的脱敏
    sanitized.stack = filterString(error?.stack || '', {
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
  
  // 过滤参数并转换为metadata对象
  const filteredArgs = args.map(arg => filterSensitiveData(arg, config));
  const metadata: Record<string, unknown> = filteredArgs.length > 0 
    ? { args: filteredArgs } 
    : {};
  
  secureLogger.info(filteredMessage, metadata);
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
  
  // 过滤其他参数并转换为metadata对象
  const filteredArgs = args.map(arg => filterSensitiveData(arg, config));
  const metadata: Record<string, unknown> = filteredArgs.length > 0 
    ? { args: filteredArgs } 
    : {};
  
  secureLogger.error(filteredMessage, sanitizedError, metadata);
}

/**
 * 限制控制台输出长度
 * 防止日志过大导致的性能问题和信息泄露
 * @param output - 原始输出字符串
 * @param maxLength - 最大允许长度，默认1000字符
 * @returns 截断后的字符串，超出部分显示隐藏提示
 */
export function truncateOutput(output: string, maxLength: number = 1000): string {
  if (output.length <= maxLength) {return output;}
  return output.substring(0, maxLength) + `\n\n[OUTPUT_TRUNCATED: ${output.length - maxLength} characters hidden]`;
}

/**
 * 安全的类型检查 - 防止原型污染
 * 在异常情况下返回'unknown'而不是抛出错误
 * @param value - 需要检查类型的值
 * @returns 类型字符串或'unknown'
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
 * 支持嵌套路径访问，避免中间属性不存在导致的错误
 * @param obj - 目标对象
 * @param path - 属性路径，使用点号分隔（如 'user.profile.name'）
 * @param defaultValue - 路径不存在时返回的默认值
 * @returns 属性值或默认值
 * @example
 * safeGet({ user: { name: '张三' } }, 'user.name') // '张三'
 * safeGet({ user: {} }, 'user.age', 0) // 0
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
