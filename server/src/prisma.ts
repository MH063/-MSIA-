import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;

const pool = new Pool({ connectionString });
// 强制设置客户端编码为 UTF8，避免中文字段出现乱码
// 该设置不修改数据库结构，仅影响会话编码
pool.query("SET client_encoding TO 'UTF8'").catch(() => {});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
