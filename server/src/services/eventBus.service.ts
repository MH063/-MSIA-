import { Response } from 'express';

type Client = {
  id: string;
  res: Response;
  pingTimer: ReturnType<typeof setInterval>;
};

class EventBusService {
  private clients: Client[] = [];

  addClient(res: Response) {
    const id = Math.random().toString(36).slice(2);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const safeWrite = (chunk: string) => {
      try {
        if ((res as any).writableEnded || (res as any).destroyed) {return false;}
        res.write(chunk);
        return true;
      } catch (e) {
        console.error('[SSE] 写入失败', { id, error: e });
        return false;
      }
    };

    safeWrite('retry: 3000\n');
    safeWrite(`event: connected\n`);
    safeWrite(`data: ${JSON.stringify({ id, at: new Date().toISOString() })}\n\n`);

    const pingTimer = setInterval(() => {
      const ok = safeWrite(`: ping ${Date.now()}\n\n`);
      if (!ok) {
        clearInterval(pingTimer);
        this.clients = this.clients.filter((c) => c.id !== id);
      }
    }, 25000);

    this.clients.push({ id, res, pingTimer });
    console.log('[SSE] 客户端已连接', { id, total: this.clients.length });

    const cleanup = (reason: 'close' | 'error', err?: unknown) => {
      clearInterval(pingTimer);
      this.clients = this.clients.filter((c) => c.id !== id);
      if (reason === 'error') {console.error('[SSE] 客户端连接错误', { id, err });}
      console.log('[SSE] 客户端已断开', { id, reason, total: this.clients.length });
    };

    res.on('close', () => cleanup('close'));
    (res as any).on?.('error', (err: unknown) => cleanup('error', err));
    return id;
  }

  broadcast(event: string, data: any) {
    const payload = JSON.stringify(data);
    const toRemove: string[] = [];
    for (const c of this.clients) {
      try {
        if ((c.res as any).writableEnded || (c.res as any).destroyed) {
          toRemove.push(c.id);
          continue;
        }
        c.res.write(`event: ${event}\n`);
        c.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        console.error('[SSE] 广播写入失败', { id: c.id, event, error: e });
        toRemove.push(c.id);
      }
    }
    if (toRemove.length > 0) {
      for (const id of toRemove) {
        const client = this.clients.find((x) => x.id === id);
        if (client) {clearInterval(client.pingTimer);}
      }
      this.clients = this.clients.filter((c) => !toRemove.includes(c.id));
    }
    if (this.clients.length > 0) {
      console.log('[SSE] 广播完成', { event, clients: this.clients.length });
    }
  }
}

export const eventBus = new EventBusService();
