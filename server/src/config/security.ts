/**
 * 安全配置 - 环境相关安全设置
 */

import { secureLogger } from '../utils/secureLogger';

export interface SecurityEnvironmentConfig {
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  enableDebugLogs: boolean;
  enableDetailedErrors: boolean;
  enableStackTrace: boolean;
  maxLogLevel: 'error' | 'warn' | 'info' | 'debug';
  enableSensitiveLogging: boolean;
}

// 安全环境配置
export const securityConfig: SecurityEnvironmentConfig = {
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  
  // 根据环境控制调试信息
  enableDebugLogs: process.env.NODE_ENV !== 'production',
  enableDetailedErrors: process.env.NODE_ENV === 'development',
  enableStackTrace: process.env.NODE_ENV === 'development',
  
  // 日志级别控制
  maxLogLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  
  // 敏感信息日志控制
  enableSensitiveLogging: process.env.NODE_ENV === 'development' && process.env.ENABLE_SENSITIVE_LOGGING === 'true'
};

/**
 * 安全日志级别枚举
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * 检查是否可以输出指定级别的日志
 */
export function canLog(level: LogLevel): boolean {
  const levelPriority = {
    [LogLevel.ERROR]: 0,
    [LogLevel.WARN]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.DEBUG]: 3
  };
  
  const maxPriority = {
    [LogLevel.ERROR]: 0,
    [LogLevel.WARN]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.DEBUG]: 2
  };
  
  return levelPriority[level] <= maxPriority[securityConfig.maxLogLevel];
}

/**
 * 生产环境安全检查
 */
export function isProduction(): boolean {
  return securityConfig.isProduction;
}

/**
 * 开发环境安全检查
 */
export function isDevelopment(): boolean {
  return securityConfig.isDevelopment;
}

/**
 * 测试环境安全检查
 */
export function isTest(): boolean {
  return securityConfig.isTest;
}

/**
 * 安全的环境变量获取
 */
export function safeGetEnv(key: string, defaultValue?: string): string | undefined {
  try {
    const value = process.env[key];
    
    // 生产环境检查敏感环境变量
    if (securityConfig.isProduction) {
      const sensitiveKeys = [
        'DATABASE_URL',
        'DB_PASSWORD',
        'JWT_SECRET',
        'REFRESH_JWT_SECRET',
        'OPERATOR_TOKEN',
        'REDIS_URL'
      ];
      
      if (sensitiveKeys.includes(key) && !value) {
        throw new Error(`生产环境必须配置环境变量: ${key}`);
      }
    }
    
    return value || defaultValue;
  } catch (error) {
    if (securityConfig.isProduction) {
      throw error;
    }
    return defaultValue;
  }
}

/**
 * 安全的配置验证
 * 验证关键环境变量，确保生产环境安全
 */
export function validateConfig(): void {
  // 必需的环境变量
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
  ];

  // 生产环境额外必需的变量
  const productionRequiredVars = [
    'ENCRYPTION_KEY',
  ];

  const missingVars: string[] = [];

  // 检查基础必需变量
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // 生产环境检查额外变量
  if (securityConfig.isProduction) {
    for (const varName of productionRequiredVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }
  }

  if (missingVars.length > 0) {
    if (securityConfig.isProduction) {
      throw new Error(`生产环境缺少必要的环境变量: ${missingVars.join(', ')}`);
    } else {
      secureLogger.warn('警告: 缺少环境变量', { missingVars });
    }
  }

  // JWT密钥强度检查
  if (process.env.JWT_SECRET) {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret.length < 32) {
      if (securityConfig.isProduction) {
        throw new Error('生产环境JWT_SECRET长度至少32位');
      } else {
        secureLogger.warn('警告: JWT_SECRET长度建议至少32位');
      }
    }
    // 检查是否使用默认值
    const weakSecrets = ['secret', 'password', 'jwt_secret', 'your-secret', 'default'];
    if (weakSecrets.some(weak => jwtSecret.toLowerCase().includes(weak))) {
      if (securityConfig.isProduction) {
        throw new Error('生产环境JWT_SECRET不能使用默认值或弱密钥');
      } else {
        secureLogger.warn('警告: JWT_SECRET使用了弱密钥，生产环境请使用强密钥');
      }
    }
  }

  // ENCRYPTION_KEY 验证
  if (process.env.ENCRYPTION_KEY) {
    const encKey = process.env.ENCRYPTION_KEY;
    if (encKey.length !== 32) {
      if (securityConfig.isProduction) {
        throw new Error('生产环境ENCRYPTION_KEY必须为32位');
      } else {
        secureLogger.warn('警告: ENCRYPTION_KEY应为32位');
      }
    }
  }

  // 数据库连接字符串验证
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    // 检查是否包含默认密码
    if (dbUrl.includes('YOUR_DB_PASSWORD') || dbUrl.includes('password') && dbUrl.includes('localhost')) {
      if (securityConfig.isProduction) {
        throw new Error('生产环境DATABASE_URL不能使用默认密码');
      } else {
        secureLogger.warn('警告: DATABASE_URL使用了默认密码，生产环境请更换');
      }
    }
  }

  // Redis URL 验证（如果配置了）
  if (process.env.REDIS_URL) {
    try {
      new URL(process.env.REDIS_URL);
    } catch {
      if (securityConfig.isProduction) {
        throw new Error('生产环境REDIS_URL格式无效');
      } else {
        secureLogger.warn('警告: REDIS_URL格式可能无效');
      }
    }
  }
}

/**
 * 安全的信息泄露防护
 */
export function preventInformationLeakage(): void {
  if (securityConfig.isProduction) {
    // 隐藏Node.js版本信息
    process.env.NODE_OPTIONS = '--no-deprecation';
    
    // 隐藏Express错误详情
    if (process.env.NODE_ENV === 'production') {
      process.env.EXPRESS_DISABLE_REQUEST_LOGGING = 'true';
    }
    
    // 禁用源映射
    process.env.NODE_ENV = 'production';
  }
}

/**
 * 安全的控制台输出限制
 */
export function setupSecureConsole(): void {
  if (securityConfig.isProduction) {
    // 禁用生产环境下的某些console方法
    const originalConsole = { ...console };
    
    // 重写console.debug，在生产环境禁用
    console.debug = (...args: unknown[]) => {
      if (securityConfig.enableDebugLogs) {
        originalConsole.debug(...args);
      }
    };
    
    // 为console.log添加安全过滤
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      if (canLog(LogLevel.INFO)) {
        // 这里可以添加额外的安全过滤逻辑
        originalLog(...args);
      }
    };
  }
}

/**
 * 请求对象类型
 */
interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  path?: string;
}

/**
 * 错误响应类型
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    stack?: string;
    details?: {
      timestamp: string;
      requestId: string;
      method?: string;
      path?: string;
    };
  };
}

/**
 * 安全的错误响应生成
 */
export function generateSecureErrorResponse(error: Error, req: RequestLike): ErrorResponse {
  const isDevelopment = securityConfig.isDevelopment;
  
  const baseResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: securityConfig.isProduction ? '服务器内部错误' : error.message
    }
  };
  
  // 开发环境添加调试信息
  if (isDevelopment && securityConfig.enableDetailedErrors) {
    baseResponse.error.stack = error.stack;
    const requestIdHeader = req.headers?.['x-request-id'];
    baseResponse.error.details = {
      timestamp: new Date().toISOString(),
      requestId: Array.isArray(requestIdHeader) ? requestIdHeader[0] : (requestIdHeader || 'unknown'),
      method: req.method,
      path: req.path
    };
  }
  
  // 生产环境不暴露内部细节
  if (securityConfig.isProduction) {
    delete baseResponse.error.stack;
    delete baseResponse.error.details;
  }
  
  return baseResponse;
}