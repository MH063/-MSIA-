import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// 导入类型声明文件，确保 Express Request 类型扩展生效
import './types/express';
import patientRoutes from './routes/patient.routes';
import sessionRoutes from './routes/session.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import nlpRoutes from './routes/nlp.routes';
import diagnosisRoutes from './routes/diagnosis.routes';
import mappingRoutes from './routes/mapping.routes';
import authRoutes from './routes/auth.routes';
import emailAuthRoutes from './routes/email-auth.routes';
import captchaRoutes from './routes/captcha.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { securityHeaders, sqlInjectionProtection, xssProtection } from './utils/security';
import { csrfProtection, attachCsrfToken, getCsrfToken } from './middleware/csrf';
import { serverConfig, corsConfig, fileConfig } from './config';
import { validateConfig, preventInformationLeakage, setupSecureConsole, securityConfig } from './config/security';
import { secureLogger } from './utils/secureLogger';
import { cache } from './utils/cache';
import { dbMonitor } from './utils/db-monitor';
import { rateLimitStrategies } from './middleware/rateLimiter';
import { alert } from './utils/alert';
import { initRedis, stopRedis } from './utils/redis-starter';
import { closeRedisClient } from './utils/redis-client';

dotenv.config();

// 安全初始化
try {
  validateConfig();
  preventInformationLeakage();
  setupSecureConsole();
  secureLogger.info('安全配置初始化完成', { 
    environment: securityConfig.isProduction ? 'production' : 'development',
    enableDebugLogs: securityConfig.enableDebugLogs 
  });
} catch (error) {
  secureLogger.error('安全配置验证失败', error instanceof Error ? error : undefined);
  process.exit(1);
}

const app = express();
const port = serverConfig.port;
const host = process.env.HOST || '0.0.0.0';

// 安全响应头
app.use(securityHeaders);

// 配置CORS - 根据环境严格限制来源
app.use(cors({
  origin: (origin, callback) => {
    // 允许无来源的请求（如移动应用、服务端请求）
    if (!origin) {
      if (serverConfig.isProduction) {
        secureLogger.warn('[CORS] 生产环境收到无来源请求');
      }
      return callback(null, origin);
    }

    // 生产环境：严格使用白名单
    if (serverConfig.isProduction) {
      if (corsConfig.allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        secureLogger.warn('[CORS] 生产环境拒绝跨域请求', { origin, allowedOrigins: corsConfig.allowedOrigins });
        callback(new Error('不允许的跨域请求'));
      }
      return;
    }

    // 开发环境：允许特定端口和 IP，但记录日志
    try {
      const u = new URL(origin);
      const h = u.hostname;
      const p = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);

      // 允许的前端开发端口：5173(Vite), 4000(后端API), 8000/8100(前端), 80(HTTP), 443(HTTPS), 5432(PostgreSQL)
      const allowedDevPorts = new Set([5173, 4000, 8000, 8100, 80, 443, 5432]);
      if (!allowedDevPorts.has(p)) {
        secureLogger.warn('[CORS] 开发环境拒绝非允许端口', { origin, port: p });
        callback(new Error('不允许的跨域请求'));
        return;
      }

      // 允许的主机名
      const isLocalhost = h === 'localhost' || h === '127.0.0.1';
      const isPrivateIP = 
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
      
      // 检查 172.16-31.x.x 私有网段
      const is172Private = (() => {
        const m = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(h);
        if (m) {
          const n = Number(m[1]);
          return n >= 16 && n <= 31;
        }
        return false;
      })();

      // 检查白名单
      if (corsConfig.allowedOrigins.includes(origin)) {
        callback(null, origin);
        return;
      }

      if (isLocalhost || isPrivateIP || is172Private) {
        // 记录开发环境的跨域请求
        secureLogger.debug('[CORS] 开发环境允许跨域请求', { origin });
        callback(null, origin);
      } else {
        secureLogger.warn('[CORS] 开发环境拒绝跨域请求', { origin });
        callback(new Error('不允许的跨域请求'));
      }
    } catch (error) {
      secureLogger.warn('[CORS] URL解析失败', { origin, error: String(error) });
      callback(new Error('无效的来源URL'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token', 'X-Session-Id', 'x-csrf-token', 'x-session-id'],
  credentials: true,
  maxAge: corsConfig.maxAge,
}));

// 请求体大小限制
app.use(express.json({ limit: fileConfig.maxFileSize }));
app.use(express.urlencoded({ extended: true, limit: fileConfig.maxFileSize }));

/**
 * 找出对象中疑似乱码文本的路径
 * @param value 任意输入
 * @returns 命中的字段路径列表
 */
const findGarbledTextPaths = (value: unknown) => {
  const paths: string[] = [];
  const walk = (v: unknown, pathKey: string) => {
    if (typeof v === 'string') {
      const hasReplacementChar = v.includes('\uFFFD');
      const hasCjk = /[\u4E00-\u9FFF]/u.test(v);
      const hasLatin = /[A-Za-z]/u.test(v);
      const looksLikeLostCjk = !hasCjk && !hasLatin && /[?？]{2,}/u.test(v);
      if (hasReplacementChar || looksLikeLostCjk) {paths.push(pathKey);}
      return;
    }
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i += 1) {walk(v[i], `${pathKey}[${i}]`);}
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, next] of Object.entries(v as Record<string, unknown>)) {
        walk(next, pathKey ? `${pathKey}.${k}` : k);
      }
    }
  };
  walk(value, '');
  return paths.filter(Boolean);
};

app.use((req: Request, res: Response, next) => {
  const bodyPaths = findGarbledTextPaths(req.body);
  const queryPaths = findGarbledTextPaths(req.query);
  if (bodyPaths.length === 0 && queryPaths.length === 0) {return next();}

  const strictBodyPaths: string[] = [];
  const strictQueryPaths: string[] = [];
  const suspiciousBodyPaths: string[] = [];
  const suspiciousQueryPaths: string[] = [];

  const splitPaths = (source: 'body' | 'query', value: unknown, paths: string[]) => {
    for (const p of paths) {
      const parts = p.split('.').filter(Boolean);
      let cur: unknown = value;
      for (const part of parts) {
        const m = /^(.+)\[(\d+)\]$/u.exec(part);
        if (m && cur && typeof cur === 'object') {
          const arr = (cur as Record<string, unknown>)[m[1]];
          cur = Array.isArray(arr) ? arr[Number(m[2])] : undefined;
        } else if (cur && typeof cur === 'object') {
          cur = (cur as Record<string, unknown>)[part];
        }
      }
      if (typeof cur !== 'string') {continue;}
      const hasReplacementChar = cur.includes('\uFFFD');
      const hasCjk = /[\u4E00-\u9FFF]/u.test(cur);
      const hasLatin = /[A-Za-z]/u.test(cur);
      const looksLikeLostCjk = !hasCjk && !hasLatin && /[?？]{2,}/u.test(cur);

      if (hasReplacementChar) {
        if (source === 'body') {strictBodyPaths.push(p);}
        else {strictQueryPaths.push(p);}
      } else if (looksLikeLostCjk) {
        if (source === 'body') {suspiciousBodyPaths.push(p);}
        else {suspiciousQueryPaths.push(p);}
      }
    }
  };

  splitPaths('body', req.body, bodyPaths);
  splitPaths('query', req.query, queryPaths);

  if (strictBodyPaths.length === 0 && strictQueryPaths.length === 0) {
    secureLogger.warn('[Encoding] 检测到疑似中文丢失为问号的文本，已放行', {
      method: req.method,
      path: req.path,
      suspiciousBodyPaths,
      suspiciousQueryPaths,
      contentType: req.headers['content-type'],
    });
    return next();
  }

  secureLogger.warn('[Encoding] 检测到疑似非UTF-8解码字符', {
    method: req.method,
    path: req.path,
    strictBodyPaths,
    strictQueryPaths,
    suspiciousBodyPaths,
    suspiciousQueryPaths,
    contentType: req.headers['content-type'],
  });
  return res.status(400).json({
    success: false,
    error: {
      code: 'INVALID_ENCODING',
      message: '请求包含疑似乱码字符，请确保使用UTF-8编码并避免中文丢失为问号',
      details: [
        ...strictBodyPaths.map((p) => ({ field: `body.${p}`, message: '包含不可解析字符' })),
        ...strictQueryPaths.map((p) => ({ field: `query.${p}`, message: '包含不可解析字符' })),
      ],
    },
  });
});

// SQL注入防护
app.use(sqlInjectionProtection);

// XSS防护
app.use(xssProtection);

// CSRF令牌附加
app.use(attachCsrfToken);

// CSRF保护（对修改操作）
app.use(csrfProtection);

// CSRF令牌获取端点
app.get('/api/csrf-token', getCsrfToken);

// API限流 - 全局标准限流
app.use(rateLimitStrategies.standard);

// 特定路由限流
app.use('/api/auth/login', rateLimitStrategies.strict);
app.use('/api/auth/register', rateLimitStrategies.strict);
app.use('/api/auth/email/login', rateLimitStrategies.strict);
app.use('/api/auth/email/register', rateLimitStrategies.strict);
app.use('/api/auth/email/send-code', rateLimitStrategies.strict);
app.use('/api/captcha', rateLimitStrategies.relaxed);
app.use('/api/knowledge', rateLimitStrategies.knowledge);
app.use('/api/diagnosis/suggest', rateLimitStrategies.diagnosis);

// 请求日志中间件
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    secureLogger.info('[Request]', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// 路由
app.use('/api/patients', patientRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/nlp', nlpRoutes);
app.use('/api/diagnosis', diagnosisRoutes);
app.use('/api/mapping', mappingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth/email', emailAuthRoutes);
app.use('/api/captcha', captchaRoutes);

/**
 * 健康检查接口
 * @route GET /
 * @returns {object} { message: string }
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'MSIA Backend API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * API状态检查接口
 * @route GET /health
 * @returns {object} 系统健康状态
 */
app.get('/health', async (req: Request, res: Response) => {
  // 检查数据库健康
  const dbHealth = await dbMonitor.checkHealth();

  const health = {
    success: true,
    status: dbHealth.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: serverConfig.nodeEnv,
    database: {
      status: dbHealth.healthy ? 'connected' : 'disconnected',
      responseTime: dbHealth.responseTime,
      message: dbHealth.message,
    },
  };

  res.status(dbHealth.healthy ? 200 : 503).json(health);
});

/**
 * 详细健康检查接口（包含缓存和连接池状态）
 * @route GET /health/detailed
 * @returns {object} 详细系统健康状态
 */
app.get('/health/detailed', async (req: Request, res: Response) => {
  // 检查数据库健康
  const dbHealth = await dbMonitor.checkHealth();
  const dbStats = dbMonitor.getPoolStats();
  const queryStats = dbMonitor.getQueryStats();
  const cacheStats = cache.getStats();

  const health = {
    success: true,
    status: dbHealth.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: serverConfig.nodeEnv,
    database: {
      status: dbHealth.healthy ? 'connected' : 'disconnected',
      responseTime: dbHealth.responseTime,
      message: dbHealth.message,
      pool: dbStats,
      queries: queryStats,
    },
    cache: {
      ...cacheStats,
      hitRate: `${(cache.getHitRate() * 100).toFixed(2)}%`,
    },
  };

  res.status(dbHealth.healthy ? 200 : 503).json(health);
});

// 404处理 - 必须放在所有路由之后
app.use(notFoundHandler);

// 全局错误处理 - 必须放在最后
app.use(errorHandler);

/**
 * 启动服务器
 */
async function startServer() {
  // 初始化 Redis 服务
  await initRedis();

  const tip = '请使用本机网卡IP访问，如 http://<本机IP>:' + port;

  app.listen(port, host, () => {
    secureLogger.info('服务器启动成功', {
      port,
      host,
      environment: serverConfig.nodeEnv,
      corsOrigins: corsConfig.allowedOrigins
    });

    // 开发环境显示详细提示
    if (!securityConfig.isProduction) {
      secureLogger.info('开发环境提示', { message: tip });
    }
  });
}

// 启动服务器
startServer().catch((err) => {
  secureLogger.error('服务器启动失败', err);
  process.exit(1);
});

// 未捕获的异常处理 - 安全版本
process.on('uncaughtException', (error) => {
  secureLogger.error('未捕获的致命异常', error, {
    type: 'uncaughtException',
    timestamp: new Date().toISOString()
  });

  // 发送告警
  void alert.critical(
    '系统未捕获异常',
    '系统发生未捕获的致命异常，请立即检查！',
    {
      error: error.message,
      stack: error.stack,
      type: 'uncaughtException',
    }
  );

  // 停止 Redis 服务和关闭连接
  void closeRedisClient();
  void stopRedis();

  // 生产环境优雅关闭
  if (securityConfig.isProduction) {
    secureLogger.error('生产环境发生未捕获异常，开始优雅关闭...');
    process.exit(1);
  } else {
    // 开发环境显示详细信息
    secureLogger.error('[Development] 未捕获异常详情:', error instanceof Error ? error : undefined);
  }
});

// 优雅关闭处理
async function gracefulShutdown(signal: string) {
  secureLogger.info(`收到 ${signal} 信号，开始优雅关闭...`);
  
  // 关闭 Redis 客户端连接
  await closeRedisClient();
  
  // 停止 Redis 服务
  await stopRedis();
  
  secureLogger.info('优雅关闭完成');
  process.exit(0);
}

// 注册优雅关闭事件
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, _promise) => {
  secureLogger.error('未处理的Promise拒绝', reason as Error, {
    type: 'unhandledRejection',
    timestamp: new Date().toISOString()
  });

  // 发送告警
  void alert.error(
    '未处理的Promise拒绝',
    '系统发生未处理的Promise拒绝',
    {
      reason: reason instanceof Error ? reason.message : String(reason),
      type: 'unhandledRejection',
    }
  );

  // 生产环境记录但不退出
  if (securityConfig.isProduction) {
    secureLogger.error('生产环境发生未处理的Promise拒绝');
  } else {
    // 开发环境显示详细信息
    secureLogger.error('[Development] Promise拒绝详情:', reason instanceof Error ? reason : undefined);
  }
});

// 内存使用监控
setInterval(() => {
  const usage = process.memoryUsage();
  const usagePercent = usage.heapUsed / usage.heapTotal;

  // 内存使用超过90%时告警
  if (usagePercent > 0.9) {
    void alert.warning(
      '内存使用过高',
      `系统内存使用超过90%，当前使用率: ${(usagePercent * 100).toFixed(2)}%`,
      {
        heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
      }
    );
  }
}, 60000); // 每分钟检查一次
