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

  // 如果已强制要求 SSL 且连接字符串中没有 sslmode 参数，则追加
  if (databaseConfig.ssl && !base.includes('sslmode=')) {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}sslmode=require`;
  }

  return base;
};

const pool = new Pool({
  connectionString: getConnectionString(),
  // 连接池配置优化
  max: 20,                      // 最大连接数
  min: 5,                       // 最小连接数
  idleTimeoutMillis: 30000,     // 连接空闲超时时间
  connectionTimeoutMillis: 10000, // 连接超时时间
  // 在 pg Pool 层面也支持 ssl 配置
  ssl: databaseConfig.ssl ? { rejectUnauthorized: false } : undefined
});

pool.on('connect', (client) => {
  client.query("SET client_encoding TO 'UTF8'").catch(() => {});
});

// 初始化数据库监控
dbMonitor.initialize(pool, {
  slowQueryThreshold: 1000,      // 慢查询阈值 1秒
  healthCheckInterval: 30000,    // 健康检查间隔 30秒
  maxQueryHistory: 1000,         // 最大查询历史记录数
});

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
