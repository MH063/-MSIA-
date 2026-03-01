/**
 * 安全审计日志服务
 * 记录关键安全事件，支持持久化存储和查询
 */

import { secureLogger } from './secureLogger';
import { getRedisClient } from './redis-client';
import { serverConfig } from '../config';
import type { Request } from 'express';

/**
 * 审计事件类型
 */
export enum AuditEventType {
  // 认证相关
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // 密钥管理
  JWT_KEY_ROTATION = 'JWT_KEY_ROTATION',
  ENCRYPTION_KEY_CHANGE = 'ENCRYPTION_KEY_CHANGE',
  
  // 权限相关
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  
  // 数据操作
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_DELETE = 'DATA_DELETE',
  BULK_DELETE = 'BULK_DELETE',
  
  // 安全事件
  CSRF_FAILURE = 'CSRF_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  IP_BLOCKED = 'IP_BLOCKED',
  
  // 系统事件
  SYSTEM_START = 'SYSTEM_START',
  SYSTEM_STOP = 'SYSTEM_STOP',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
}

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  operatorId?: number;
  operatorRole?: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  details?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

/**
 * 审计日志配置
 */
const AUDIT_CONFIG = {
  redisKeyPrefix: 'audit:log:',
  maxRedisEntries: 10000,
  maxMemoryEntries: 1000,
  retentionDays: 90,
};

/**
 * 内存审计日志存储（降级方案）
 */
const memoryAuditLogs: AuditLogEntry[] = [];

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 获取客户端信息
 */
function getClientInfo(req?: Request): { ip?: string; userAgent?: string } {
  if (!req) {
    return {};
  }
  
  return {
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  };
}

/**
 * 记录审计日志
 */
export async function auditLog(params: {
  eventType: AuditEventType;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  operatorId?: number;
  operatorRole?: string;
  req?: Request;
  resource?: string;
  action?: string;
  details?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
}): Promise<AuditLogEntry> {
  const {
    eventType,
    severity = 'medium',
    operatorId,
    operatorRole,
    req,
    resource,
    action,
    details,
    success = true,
    errorMessage,
  } = params;

  const clientInfo = getClientInfo(req);

  const entry: AuditLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    eventType,
    severity,
    operatorId,
    operatorRole,
    ...clientInfo,
    resource,
    action,
    details: details ? sanitizeDetails(details) : undefined,
    success,
    errorMessage,
  };

  // 存储到Redis
  const redis = await getRedisClient();
  if (redis) {
    try {
      const key = `${AUDIT_CONFIG.redisKeyPrefix}${new Date().toISOString().split('T')[0]}`;
      await redis.rPush(key, JSON.stringify(entry));
      
      // 设置过期时间
      const ttlSeconds = AUDIT_CONFIG.retentionDays * 24 * 60 * 60;
      await redis.expire(key, ttlSeconds);
      
      // 记录到安全日志
      secureLogger.logSecurity(eventType, {
        severity,
        operatorId,
        resource,
        success,
      });
    } catch (err) {
      secureLogger.warn('[Audit] Redis存储失败，降级到内存存储', { error: err instanceof Error ? err.message : String(err) });
      addToMemoryStore(entry);
    }
  } else {
    addToMemoryStore(entry);
  }

  return entry;
}

/**
 * 添加到内存存储
 */
function addToMemoryStore(entry: AuditLogEntry): void {
  memoryAuditLogs.push(entry);
  
  // 保持大小限制
  if (memoryAuditLogs.length > AUDIT_CONFIG.maxMemoryEntries) {
    memoryAuditLogs.shift();
  }
}

/**
 * 清理敏感详情
 */
function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential', 'authorization'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    const isSensitive = sensitiveKeys.some(sk => key.toLowerCase().includes(sk));
    if (isSensitive) {
      result[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * 查询审计日志
 */
export async function queryAuditLogs(params: {
  startDate?: Date;
  endDate?: Date;
  eventType?: AuditEventType;
  operatorId?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  limit?: number;
}): Promise<AuditLogEntry[]> {
  const { startDate, endDate, eventType, operatorId, severity, limit = 100 } = params;
  
  const results: AuditLogEntry[] = [];
  
  // 从Redis查询
  const redis = await getRedisClient();
  if (redis) {
    try {
      // 获取日期范围内的key
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 默认7天
      const end = endDate || new Date();
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = `${AUDIT_CONFIG.redisKeyPrefix}${d.toISOString().split('T')[0]}`;
        const logs = await redis.lRange(key, 0, -1);
        
        for (const logStr of logs) {
          try {
            const entry = JSON.parse(logStr) as AuditLogEntry;
            
            // 应用过滤条件
            if (eventType && entry.eventType !== eventType) continue;
            if (operatorId && entry.operatorId !== operatorId) continue;
            if (severity && entry.severity !== severity) continue;
            
            results.push(entry);
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (err) {
      secureLogger.warn('[Audit] Redis查询失败', { error: err instanceof Error ? err.message : String(err) });
    }
  }
  
  // 合并内存存储
  for (const entry of memoryAuditLogs) {
    if (eventType && entry.eventType !== eventType) continue;
    if (operatorId && entry.operatorId !== operatorId) continue;
    if (severity && entry.severity !== severity) continue;
    if (startDate && new Date(entry.timestamp) < startDate) continue;
    if (endDate && new Date(entry.timestamp) > endDate) continue;
    
    results.push(entry);
  }
  
  // 按时间排序并限制数量
  results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return results.slice(0, limit);
}

/**
 * 获取安全统计
 */
export async function getSecurityStats(days: number = 7): Promise<{
  totalEvents: number;
  failedLogins: number;
  permissionDenied: number;
  suspiciousActivity: number;
  bySeverity: Record<string, number>;
  byEventType: Record<string, number>;
}> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const logs = await queryAuditLogs({ startDate, limit: 10000 });
  
  const stats = {
    totalEvents: logs.length,
    failedLogins: logs.filter(l => l.eventType === AuditEventType.LOGIN_FAILURE).length,
    permissionDenied: logs.filter(l => l.eventType === AuditEventType.PERMISSION_DENIED).length,
    suspiciousActivity: logs.filter(l => l.eventType === AuditEventType.SUSPICIOUS_ACTIVITY).length,
    bySeverity: {} as Record<string, number>,
    byEventType: {} as Record<string, number>,
  };
  
  for (const log of logs) {
    stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
    stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1;
  }
  
  return stats;
}

/**
 * 便捷方法：记录登录成功
 */
export function auditLoginSuccess(operatorId: number, role: string, req: Request): Promise<AuditLogEntry> {
  return auditLog({
    eventType: AuditEventType.LOGIN_SUCCESS,
    severity: 'low',
    operatorId,
    operatorRole: role,
    req,
    action: 'login',
    success: true,
  });
}

/**
 * 便捷方法：记录登录失败
 */
export function auditLoginFailure(username: string, reason: string, req: Request): Promise<AuditLogEntry> {
  return auditLog({
    eventType: AuditEventType.LOGIN_FAILURE,
    severity: 'medium',
    req,
    action: 'login',
    success: false,
    errorMessage: reason,
    details: { username },
  });
}

/**
 * 便捷方法：记录权限拒绝
 */
export function auditPermissionDenied(
  operatorId: number | undefined,
  permission: string,
  resource: string,
  req: Request
): Promise<AuditLogEntry> {
  return auditLog({
    eventType: AuditEventType.PERMISSION_DENIED,
    severity: 'high',
    operatorId,
    resource,
    req,
    action: 'access',
    success: false,
    details: { permission },
  });
}

/**
 * 便捷方法：记录数据导出
 */
export function auditDataExport(
  operatorId: number,
  resource: string,
  format: string,
  req: Request
): Promise<AuditLogEntry> {
  return auditLog({
    eventType: AuditEventType.DATA_EXPORT,
    severity: 'medium',
    operatorId,
    resource,
    req,
    action: 'export',
    success: true,
    details: { format },
  });
}

/**
 * 便捷方法：记录数据删除
 */
export function auditDataDelete(
  operatorId: number,
  resource: string,
  resourceId: string,
  req: Request
): Promise<AuditLogEntry> {
  return auditLog({
    eventType: AuditEventType.DATA_DELETE,
    severity: 'high',
    operatorId,
    resource,
    req,
    action: 'delete',
    success: true,
    details: { resourceId },
  });
}

/**
 * 导出审计日志（用于合规）
 */
export async function exportAuditLogs(params: {
  startDate: Date;
  endDate: Date;
  format: 'json' | 'csv';
}): Promise<string> {
  const logs = await queryAuditLogs({
    startDate: params.startDate,
    endDate: params.endDate,
    limit: 100000,
  });

  if (params.format === 'json') {
    return JSON.stringify(logs, null, 2);
  }

  // CSV格式
  const headers = ['timestamp', 'eventType', 'severity', 'operatorId', 'ip', 'resource', 'action', 'success', 'errorMessage'];
  const rows = logs.map(log => [
    log.timestamp,
    log.eventType,
    log.severity,
    log.operatorId || '',
    log.ip || '',
    log.resource || '',
    log.action || '',
    log.success,
    log.errorMessage || '',
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
}
