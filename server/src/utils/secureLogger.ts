/**
 * 安全日志管理器 - 防止信息泄露的日志系统
 */

import { securityConfig, LogLevel, canLog } from '../config/security';
import type { Request, Response } from 'express';
import { filterSensitiveData, truncateOutput, sanitizeError } from './security';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  stack?: string;
  truncated?: boolean;
}

class SecureLogger {
  private logs: LogEntry[] = [];
  private maxLogSize = 1000;
  private currentLogLevel = securityConfig.maxLogLevel;

  /**
   * 安全的日志记录
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, stack?: string): void {
    // 检查日志级别
    if (!canLog(level)) {
      return;
    }

    // 过滤敏感信息
    const filteredMetadata = metadata ? filterSensitiveData(metadata) as Record<string, unknown> : undefined;
    const filteredStack = stack ? filterSensitiveData(stack) as string : undefined;

    // 创建日志条目
    const entry: LogEntry = {
      level,
      message: this.truncateMessage(message),
      timestamp: new Date().toISOString(),
      metadata: filteredMetadata,
      stack: filteredStack,
      truncated: message.length > 500
    };

    // 添加到日志数组
    this.logs.push(entry);

    // 保持日志数组大小限制
    if (this.logs.length > this.maxLogSize) {
      this.logs.shift();
    }

    // 输出到控制台（已过滤）
    this.outputToConsole(entry);
  }

  /**
   * 截断过长消息
   */
  private truncateMessage(message: string): string {
    if (securityConfig.isProduction && message.length > 500) {
      return truncateOutput(message, 500);
    }
    return message;
  }

  /**
   * 安全输出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const message = `${prefix} ${entry.message}`;

    // 根据级别选择输出方法
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message);
        if (entry.stack) {
          console.error(entry.stack);
        }
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.DEBUG:
        console.debug(message);
        break;
    }

    // 输出元数据（已过滤）
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log(prefix, 'Metadata:', entry.metadata);
    }
  }

  /**
   * 错误日志 - 自动脱敏错误信息
   */
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const sanitizedError = error ? sanitizeError(error) : undefined;
    const stack = sanitizedError?.stack;
    
    this.log(LogLevel.ERROR, message, metadata, stack);
  }

  /**
   * 警告日志
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * 信息日志
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * 调试日志
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (securityConfig.enableDebugLogs) {
      this.log(LogLevel.DEBUG, message, metadata);
    }
  }

  /**
   * HTTP请求日志 - 自动过滤敏感信息
   */
  logRequest(req: Request, res: Response, responseTime?: number): void {
    if (!canLog(LogLevel.INFO)) {return;}

    const metadata: Record<string, unknown> = {
      method: req.method,
      url: req.url,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      responseTime: responseTime ? `${responseTime}ms` : undefined,
      statusCode: res.statusCode
    };

    // 过滤请求体中的敏感信息
    if (req.body && typeof req.body === 'object' && Object.keys(req.body as Record<string, unknown>).length > 0) {
      metadata.requestBody = filterSensitiveData(req.body);
    }

    this.info('HTTP Request', metadata);
  }

  /**
   * 数据库操作日志
   */
  logDatabase(operation: string, table: string, duration?: number, metadata?: Record<string, unknown>): void {
    const dbMetadata = {
      operation,
      table,
      duration: duration ? `${duration}ms` : undefined,
      ...metadata
    };

    this.debug(`Database ${operation}`, dbMetadata);
  }

  /**
   * API调用日志
   */
  logApiCall(endpoint: string, method: string, statusCode?: number, duration?: number): void {
    const metadata = {
      endpoint,
      method,
      statusCode,
      duration: duration ? `${duration}ms` : undefined
    };

    if (statusCode && statusCode >= 400) {
      this.warn(`API Call Failed: ${method} ${endpoint}`, metadata);
    } else {
      this.debug(`API Call: ${method} ${endpoint}`, metadata);
    }
  }

  /**
   * 安全事件日志
   */
  logSecurity(event: string, details: Record<string, unknown>): void {
    const filteredDetails = filterSensitiveData(details) as Record<string, unknown>;
    const metadata: Record<string, unknown> = {
      event,
      ...filteredDetails,
      timestamp: new Date().toISOString()
    };

    this.warn(`Security Event: ${event}`, metadata);
  }

  /**
   * 性能日志
   */
  logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
    const perfMetadata = {
      operation,
      duration: `${duration}ms`,
      ...metadata
    };

    if (duration > 5000) { // 超过5秒的操作
      this.warn(`Slow Operation: ${operation}`, perfMetadata);
    } else {
      this.debug(`Performance: ${operation}`, perfMetadata);
    }
  }

  /**
   * 获取最近的日志（用于调试）
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * 清理日志
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * 导出日志（带安全过滤）
   */
  exportLogs(): LogEntry[] {
    return this.logs.map(log => ({
      ...log,
      message: this.truncateMessage(log.message),
      stack: log.stack ? this.truncateMessage(log.stack) : undefined
    }));
  }
}

// 单例实例
export const secureLogger = new SecureLogger();

// 导出便捷方法
export const logError = (message: string, error?: Error, metadata?: Record<string, unknown>) => 
  secureLogger.error(message, error, metadata);

export const logWarn = (message: string, metadata?: Record<string, unknown>) => 
  secureLogger.warn(message, metadata);

export const logInfo = (message: string, metadata?: Record<string, unknown>) => 
  secureLogger.info(message, metadata);

export const logDebug = (message: string, metadata?: Record<string, unknown>) => 
  secureLogger.debug(message, metadata);

export const logRequest = (req: Request, res: Response, responseTime?: number) => 
  secureLogger.logRequest(req, res, responseTime);

export const logDatabase = (operation: string, table: string, duration?: number, metadata?: Record<string, unknown>) => 
  secureLogger.logDatabase(operation, table, duration, metadata);

export const logApiCall = (endpoint: string, method: string, statusCode?: number, duration?: number) => 
  secureLogger.logApiCall(endpoint, method, statusCode, duration);

export const logSecurity = (event: string, details: Record<string, unknown>) => 
  secureLogger.logSecurity(event, details);

export const logPerformance = (operation: string, duration: number, metadata?: Record<string, unknown>) => 
  secureLogger.logPerformance(operation, duration, metadata);
