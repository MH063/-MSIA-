import { Response } from 'express';

type Client = {
  id: string;
  res: Response;
};

class EventBusService {
  private clients: Client[] = [];

  addClient(res: Response) {
    const id = Math.random().toString(36).slice(2);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write('\n');
    this.clients.push({ id, res });
    res.on('close', () => {
      this.clients = this.clients.filter(c => c.id !== id);
    });
    return id;
  }

  broadcast(event: string, data: any) {
    const payload = JSON.stringify(data);
    for (const c of this.clients) {
      c.res.write(`event: ${event}\n`);
      c.res.write(`data: ${payload}\n\n`);
    }
  }
}

export const eventBus = new EventBusService();
