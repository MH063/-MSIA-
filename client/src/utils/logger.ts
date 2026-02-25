/**
 * 前端日志工具
 * 提供统一的日志记录方式，支持不同日志级别
 */

const LOG_LEVEL = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 } as const;
type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

const isProduction = import.meta.env.PROD;

// 根据环境设置最低日志级别
// 可以通过 import.meta.env.VITE_LOG_LEVEL 环境变量覆盖
const envLogLevel = import.meta.env.VITE_LOG_LEVEL?.toUpperCase();
const currentLevel = envLogLevel === 'ERROR' ? LOG_LEVEL.ERROR :
                     envLogLevel === 'WARN' ? LOG_LEVEL.WARN :
                     envLogLevel === 'INFO' ? LOG_LEVEL.INFO :
                     envLogLevel === 'DEBUG' ? LOG_LEVEL.DEBUG :
                     isProduction ? LOG_LEVEL.WARN : LOG_LEVEL.DEBUG;

/**
 * 检查是否应该记录该级别的日志
 */
function shouldLog(level: LogLevel): boolean {
  return level >= currentLevel;
}

/**
 * 格式化日志消息
 */
function formatMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

/**
 * 安全的日志记录 - 防止敏感信息泄露
 */
function sanitizeData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isSensitive = sensitiveKeys.some(sk => key.toLowerCase().includes(sk));
    if (isSensitive) {
      result[key] = '***';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeData(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * 前端日志管理器
 */
export const logger = {
  /**
   * 调试日志 - 仅在开发环境显示
   */
  debug(message: string, data?: unknown): void {
    if (!shouldLog(LOG_LEVEL.DEBUG)) return;
    console.debug(formatMessage('DEBUG', message), data ? sanitizeData(data) : '');
  },

  /**
   * 信息日志
   */
  info(message: string, data?: unknown): void {
    if (!shouldLog(LOG_LEVEL.INFO)) return;
    console.info(formatMessage('INFO', message), data ? sanitizeData(data) : '');
  },

  /**
   * 警告日志
   */
  warn(message: string, data?: unknown): void {
    if (!shouldLog(LOG_LEVEL.WARN)) return;
    console.warn(formatMessage('WARN', message), data ? sanitizeData(data) : '');
  },

  /**
   * 错误日志
   */
  error(messageOrError: string | Error | unknown, errorOrData?: Error | unknown, data?: unknown): void {
    if (!shouldLog(LOG_LEVEL.ERROR)) return;
    const isMessageString = typeof messageOrError === 'string';
    const message = isMessageString ? messageOrError : 'Unhandled error';
    const error = isMessageString ? errorOrData : messageOrError;
    const errorInfo = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    console.error(formatMessage('ERROR', message), errorInfo, data ? sanitizeData(data) : '');
  },

  /**
   * API请求日志
   */
  logApi(method: string, url: string, status?: number, duration?: number): void {
    if (!shouldLog(LOG_LEVEL.INFO)) return;
    const metadata = { method, url, status, duration: duration ? `${duration}ms` : undefined };
    console.info(formatMessage('API', `${method} ${url}`), sanitizeData(metadata));
  },

  /**
   * 性能日志
   */
  logPerformance(operation: string, duration: number): void {
    if (!shouldLog(LOG_LEVEL.DEBUG)) return;
    console.debug(formatMessage('PERF', `${operation} took ${duration}ms`));
  }
};

export default logger;
