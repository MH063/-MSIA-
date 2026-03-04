import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { databaseConfig } from './config';
import { dbMonitor } from './utils/db-monitor';
import { secureLogger } from './utils/secureLogger';

dotenv.config();

const getConnectionString = () => {
  const base = databaseConfig.url;
  if (!base) {return '';}

  // 本地连接不需要 SSL，只有远程连接才需要
  const isLocalhost = base.includes('localhost') || base.includes('127.0.0.1');
  
  // 如果已强制要求 SSL 且连接字符串中没有 sslmode 参数，则追加
  if (databaseConfig.ssl && !isLocalhost && !base.includes('sslmode=')) {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}sslmode=require`;
  }

  return base;
};

const connectionString = getConnectionString();
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

// 简化连接池配置，使用更保守的设置
const pool = new Pool({
  connectionString,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // 本地连接不使用 SSL
  ssl: (!isLocalhost && databaseConfig.ssl) ? { rejectUnauthorized: false } : undefined
});

pool.on('connect', (client) => {
  client.query("SET client_encoding TO 'UTF8'").catch(() => {});
});

// 禁用 DBMonitor 健康检查，因为它与 Prisma 的连接池管理可能冲突
// 只保留查询统计功能
// dbMonitor.initialize(pool, {
//   slowQueryThreshold: 2000,
//   healthCheckInterval: 60000,
//   maxQueryHistory: 500,
// });

// 扩展 PrismaClient 以支持查询监控
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// 监听查询事件
prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
  dbMonitor.recordQuery(e.duration);
  secureLogger.debug('[Prisma] Query', {
    query: e.query.substring(0, 100),
    duration: e.duration,
  });
});

prisma.$on('error', (e: { message: string }) => {
  secureLogger.error('[Prisma] Error', new Error(e.message));
});

prisma.$on('warn', (e: { message: string }) => {
  secureLogger.warn('[Prisma] Warning', { message: e.message });
});

export default prisma;
