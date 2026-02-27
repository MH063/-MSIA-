/**
 * Redis 自动启动模块
 * 在后端启动时自动检测并启动 Redis 服务
 */
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as net from 'net';
import { secureLogger } from './secureLogger';

let redisProcess: ChildProcess | null = null;
const REDIS_PORT = 6379;
const REDIS_START_TIMEOUT = 10000; // 10秒超时

/**
 * 检查 Redis 端口是否可用
 */
function checkRedisPort(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1000);

    socket.connect(REDIS_PORT, 'localhost', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * 获取 Redis 可执行文件路径
 */
function getRedisServerPath(): string {
  // 当前文件在 server/src/utils/，需要向上两级到 server/，再进入 redis/
  const serverDir = path.join(__dirname, '..', '..', 'redis');

  return path.join(serverDir, 'redis-server.exe');
}

/**
 * 获取 Redis 配置文件路径
 */
function getRedisConfigPath(): string {
  // 当前文件在 server/src/utils/，需要向上两级到 server/，再进入 redis/
  const serverDir = path.join(__dirname, '..', '..', 'redis');

  return path.join(serverDir, 'redis.windows.conf');
}

/**
 * 启动 Redis 服务进程
 */
function startRedisProcess(): Promise<boolean> {
  return new Promise((resolve) => {
    const redisServerPath = getRedisServerPath();
    const redisConfigPath = getRedisConfigPath();

    // 检查 Redis 可执行文件是否存在
    const fs = require('fs');
    if (!fs.existsSync(redisServerPath)) {
      secureLogger.warn('[Redis] Redis 服务程序不存在', { path: redisServerPath });
      resolve(false);
      return;
    }

    secureLogger.info('[Redis] 正在启动 Redis 服务...', { path: redisServerPath });

    // 启动 Redis 进程
    redisProcess = spawn(redisServerPath, [redisConfigPath], {
      windowsHide: true,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    redisProcess.on('error', (err) => {
      secureLogger.error('[Redis] 启动失败', err);
      resolve(false);
    });

    redisProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        secureLogger.warn('[Redis] 进程异常退出', { code });
      }
      redisProcess = null;
    });

    // 等待 Redis 启动
    const startTime = Date.now();
    const checkInterval = setInterval(async () => {
      const isRunning = await checkRedisPort();
      if (isRunning) {
        clearInterval(checkInterval);
        secureLogger.info('[Redis] 服务启动成功', { port: REDIS_PORT });
        resolve(true);
      } else if (Date.now() - startTime > REDIS_START_TIMEOUT) {
        clearInterval(checkInterval);
        secureLogger.warn('[Redis] 启动超时，将继续启动后端');
        resolve(false);
      }
    }, 500);
  });
}

/**
 * 停止 Redis 服务
 */
export async function stopRedis(): Promise<void> {
  if (redisProcess) {
    secureLogger.info('[Redis] 正在停止 Redis 服务...');
    redisProcess.kill();
    redisProcess = null;
  }
}

/**
 * 初始化 Redis 服务
 * 在后端启动时调用，自动检测并启动 Redis
 */
export async function initRedis(): Promise<boolean> {
  const isRunning = await checkRedisPort();

  if (isRunning) {
    secureLogger.info('[Redis] 服务已在运行中', { port: REDIS_PORT });
    return true;
  }

  secureLogger.info('[Redis] 检测到服务未运行，尝试自动启动...');
  const started = await startRedisProcess();

  if (started) {
    // 注册退出时清理
    process.on('beforeExit', stopRedis);
    process.on('SIGINT', stopRedis);
    process.on('SIGTERM', stopRedis);
  }

  return started;
}
