import { Response } from 'express';
import { secureLogger } from '../utils/secureLogger';

/**
 * SSE客户端接口
 */
interface Client {
  id: string;
  res: Response;
  pingTimer: ReturnType<typeof setInterval>;
}

/**
 * 广播数据类型
 */
interface BroadcastData {
  [key: string]: unknown;
}

/**
 * Express响应对象扩展类型
 */
type ExtendedResponse = Response & {
  writableEnded?: boolean;
  destroyed?: boolean;
  on?: (event: string, callback: (err?: unknown) => void) => void;
};

class EventBusService {
  private clients: Client[] = [];

  /**
   * 添加SSE客户端
   * @param res Express响应对象
   * @returns 客户端ID
   */
  addClient(res: Response): string {
    const id = Math.random().toString(36).slice(2);
    const extRes = res as ExtendedResponse;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const safeWrite = (chunk: string): boolean => {
      try {
        if (extRes.writableEnded || extRes.destroyed) {
          return false;
        }
        res.write(chunk);
        return true;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        secureLogger.error('[SSE] 写入失败', new Error(errorMessage));
        return false;
      }
    };

    safeWrite('retry: 3000\n');
    safeWrite('event: connected\n');
    safeWrite(`data: ${JSON.stringify({ id, at: new Date().toISOString() })}\n\n`);

    const pingTimer = setInterval(() => {
      const ok = safeWrite(`: ping ${Date.now()}\n\n`);
      if (!ok) {
        clearInterval(pingTimer);
        this.clients = this.clients.filter((c) => c.id !== id);
      }
    }, 25000);

    this.clients.push({ id, res, pingTimer });
    secureLogger.info('[SSE] 客户端已连接', { id, total: this.clients.length });

    const cleanup = (reason: 'close' | 'error', err?: unknown): void => {
      clearInterval(pingTimer);
      this.clients = this.clients.filter((c) => c.id !== id);
      if (reason === 'error') {
        const errorMessage = err instanceof Error ? err.message : String(err);
        secureLogger.error('[SSE] 客户端连接错误', new Error(errorMessage));
      }
      secureLogger.info('[SSE] 客户端已断开', { id, reason, total: this.clients.length });
    };

    res.on('close', () => cleanup('close'));
    extRes.on?.('error', (err: unknown) => cleanup('error', err));
    return id;
  }

  /**
   * 广播事件到所有客户端
   * @param event 事件名称
   * @param data 事件数据
   */
  broadcast(event: string, data: BroadcastData): void {
    const payload = JSON.stringify(data);
    const toRemove: string[] = [];

    for (const c of this.clients) {
      const extRes = c.res as ExtendedResponse;
      try {
        if (extRes.writableEnded || extRes.destroyed) {
          toRemove.push(c.id);
          continue;
        }
        c.res.write(`event: ${event}\n`);
        c.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        secureLogger.error('[SSE] 广播写入失败', new Error(errorMessage), { event });
        toRemove.push(c.id);
      }
    }

    if (toRemove.length > 0) {
      for (const id of toRemove) {
        const client = this.clients.find((x) => x.id === id);
        if (client) {
          clearInterval(client.pingTimer);
        }
      }
      this.clients = this.clients.filter((c) => !toRemove.includes(c.id));
    }

    if (this.clients.length > 0) {
      secureLogger.info('[SSE] 广播完成', { event, clients: this.clients.length });
    }
  }
}

export const eventBus = new EventBusService();
