/**
 * 应用程序配置
 * 集中管理所有配置项，避免硬编码
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * 服务器配置
 */
export const serverConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

/**
 * 数据库配置
 */
export const databaseConfig = {
  url: process.env.DATABASE_URL || '',
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
  queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
};

/**
 * CORS配置
 */
export const corsConfig = {
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:8000',
    'http://localhost:8100',
  ],
  maxAge: 86400, // 24小时
};

/**
 * 文件上传配置
 */
export const fileConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  allowedExtensions: ['.txt', '.json', '.pdf', '.doc', '.docx'],
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  knowledgeBaseDir: process.env.KNOWLEDGE_BASE_DIR || './knowledge_base',
};

/**
 * 分页配置
 */
export const paginationConfig = {
  defaultPage: 1,
  defaultLimit: 20,
  maxLimit: 100,
};

/**
 * 诊断配置
 */
export const diagnosisConfig = {
  minConfidenceThreshold: 0.1,
  maxDiagnosesToReturn: 5,
  symptomWeightBase: 0.1,
  redFlagWeightBase: 0.15,
};

/**
 * NLP配置
 */
export const nlpConfig = {
  defaultModel: process.env.NLP_MODEL || 'gpt-3.5-turbo',
  maxTokens: parseInt(process.env.NLP_MAX_TOKENS || '2000', 10),
  temperature: parseFloat(process.env.NLP_TEMPERATURE || '0.7'),
  timeout: parseInt(process.env.NLP_TIMEOUT || '30000', 10),
};

/**
 * 缓存配置
 */
export const cacheConfig = {
  ttl: parseInt(process.env.CACHE_TTL || '3600', 10), // 1小时
  maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
};

/**
 * 日志配置
 */
export const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '30', 10),
};
