import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { databaseConfig } from './config';

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
  // 在 pg Pool 层面也支持 ssl 配置
  ssl: databaseConfig.ssl ? { rejectUnauthorized: false } : undefined
});

pool.on('connect', (client) => {
  client.query("SET client_encoding TO 'UTF8'").catch(() => {});
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
