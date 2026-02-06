/**
 * 异步任务队列
 * 基于 Bull 和 Redis 实现的任务队列系统
 * 用于处理耗时操作（如报告生成、数据导出等）
 */

import Bull, { Job, Queue as BullQueue } from 'bull';
import { secureLogger } from './secureLogger';

/**
 * 任务数据接口
 */
interface JobData {
  [key: string]: unknown;
}

/**
 * 任务处理函数类型
 */
type JobProcessor<T extends JobData> = (job: Job<T>) => Promise<unknown>;

/**
 * 队列配置
 */
interface QueueConfig {
  concurrency?: number;      // 并发数
  attempts?: number;         // 重试次数
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };                         // 重试策略
  removeOnComplete?: boolean | number;  // 完成后是否删除
  removeOnFail?: boolean | number;      // 失败后是否删除
}

/**
 * 任务状态
 */
interface JobStatus {
  id: string;
  name: string;
  state: string;
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  processedOn?: number;
  finishedOn?: number;
}

/**
 * 队列管理器
 */
class QueueManager {
  private queues: Map<string, BullQueue> = new Map();
  private processors: Map<string, JobProcessor<JobData>> = new Map();

  /**
   * 创建队列
   */
  createQueue<T extends JobData>(
    name: string,
    processor: JobProcessor<T>,
    config: QueueConfig = {}
  ): BullQueue<T> {
    const defaultConfig: QueueConfig = {
      concurrency: 3,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    };

    const finalConfig = { ...defaultConfig, ...config };

    // 创建队列
    const queue = new Bull<T>(name, {
      redis: this.getRedisConfig(),
      defaultJobOptions: {
        attempts: finalConfig.attempts,
        backoff: finalConfig.backoff,
        removeOnComplete: finalConfig.removeOnComplete,
        removeOnFail: finalConfig.removeOnFail,
      },
    });

    // 设置处理器
    queue.process(finalConfig.concurrency || 3, async (job: Job<T>) => {
      secureLogger.info(`[Queue] 开始处理任务`, {
        queue: name,
        jobId: job.id,
        data: job.data,
      });

      try {
        const result = await processor(job);

        secureLogger.info(`[Queue] 任务处理完成`, {
          queue: name,
          jobId: job.id,
        });

        return result;
      } catch (error) {
        secureLogger.error(`[Queue] 任务处理失败`, error instanceof Error ? error : new Error(String(error)), {
          queue: name,
          jobId: job.id,
        });
        throw error;
      }
    });

    // 监听事件
    this.attachEventListeners(queue, name);

    // 保存队列和处理器
    this.queues.set(name, queue);
    this.processors.set(name, processor as JobProcessor<JobData>);

    secureLogger.info(`[Queue] 队列创建成功`, { name });

    return queue;
  }

  /**
   * 获取 Redis 配置
   */
  private getRedisConfig(): { host: string; port: number; password?: string } {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // 解析 Redis URL
    const url = new URL(redisUrl);

    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
    };
  }

  /**
   * 附加事件监听器
   */
  private attachEventListeners(queue: BullQueue, name: string): void {
    // 任务完成
    queue.on('completed', (job: Job) => {
      secureLogger.info(`[Queue] 任务完成`, {
        queue: name,
        jobId: job.id,
        duration: Date.now() - (job.processedOn || Date.now()),
      });
    });

    // 任务失败
    queue.on('failed', (job: Job, err: Error) => {
      secureLogger.error(`[Queue] 任务失败`, err instanceof Error ? err : new Error(String(err)), {
        queue: name,
        jobId: job.id,
        attempts: job.attemptsMade,
      });
    });

    // 任务进度
    queue.on('progress', (job: Job, progress: number) => {
      secureLogger.debug(`[Queue] 任务进度`, {
        queue: name,
        jobId: job.id,
        progress,
      });
    });

    // 任务暂停
    queue.on('paused', () => {
      secureLogger.info(`[Queue] 队列已暂停`, { queue: name });
    });

    // 任务恢复
    queue.on('resumed', () => {
      secureLogger.info(`[Queue] 队列已恢复`, { queue: name });
    });

    // 任务清空
    queue.on('cleaned', (jobs: Job[], type: string) => {
      secureLogger.info(`[Queue] 任务已清理`, {
        queue: name,
        count: jobs.length,
        type,
      });
    });

    // 错误
    queue.on('error', (error: Error) => {
      secureLogger.error(`[Queue] 队列错误`, error instanceof Error ? error : new Error(String(error)), {
        queue: name,
      });
    });
  }

  /**
   * 添加任务到队列
   */
  async addJob<T extends JobData>(
    queueName: string,
    data: T,
    options?: Bull.JobOptions
  ): Promise<Job<T> | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      secureLogger.error(`[Queue] 队列不存在`, new Error(`Queue ${queueName} not found`));
      return null;
    }

    try {
      const job = await queue.add(data, options);
      secureLogger.info(`[Queue] 任务已添加`, {
        queue: queueName,
        jobId: job.id,
      });
      return job;
    } catch (error) {
      secureLogger.error(`[Queue] 添加任务失败`, error instanceof Error ? error : new Error(String(error)), {
        queue: queueName,
      });
      return null;
    }
  }

  /**
   * 获取任务状态
   */
  async getJobStatus(queueName: string, jobId: string): Promise<JobStatus | null> {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    try {
      const job = await queue.getJob(jobId);
      if (!job) return null;

      const state = await job.getState();

      return {
        id: job.id?.toString() || '',
        name: job.name,
        state,
        progress: job.progress(),
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      };
    } catch (error) {
      secureLogger.error(`[Queue] 获取任务状态失败`, error instanceof Error ? error : new Error(String(error)), {
        queue: queueName,
        jobId,
      });
      return null;
    }
  }

  /**
   * 获取队列统计
   */
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  } | null> {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    try {
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.getPausedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
      };
    } catch (error) {
      secureLogger.error(`[Queue] 获取队列统计失败`, error instanceof Error ? error : new Error(String(error)), {
        queue: queueName,
      });
      return null;
    }
  }

  /**
   * 暂停队列
   */
  async pauseQueue(queueName: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    try {
      await queue.pause();
      return true;
    } catch (error) {
      secureLogger.error(`[Queue] 暂停队列失败`, error instanceof Error ? error : new Error(String(error)), {
        queue: queueName,
      });
      return false;
    }
  }

  /**
   * 恢复队列
   */
  async resumeQueue(queueName: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    try {
      await queue.resume();
      return true;
    } catch (error) {
      secureLogger.error(`[Queue] 恢复队列失败`, error instanceof Error ? error : new Error(String(error)), {
        queue: queueName,
      });
      return false;
    }
  }

  /**
   * 清空队列
   */
  async cleanQueue(queueName: string, status: 'completed' | 'wait' | 'active' | 'delayed' | 'failed', limit?: number): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    try {
      await queue.clean(0, status, limit);
      return true;
    } catch (error) {
      secureLogger.error(`[Queue] 清空队列失败`, error instanceof Error ? error : new Error(String(error)), {
        queue: queueName,
      });
      return false;
    }
  }

  /**
   * 关闭所有队列
   */
  async closeAll(): Promise<void> {
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        secureLogger.info(`[Queue] 队列已关闭`, { name });
      } catch (error) {
        secureLogger.error(`[Queue] 关闭队列失败`, error instanceof Error ? error : new Error(String(error)), {
          name,
        });
      }
    }
    this.queues.clear();
    this.processors.clear();
  }

  /**
   * 获取所有队列名称
   */
  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }
}

// 导出单例
export const queueManager = new QueueManager();

// 导出类型
export type { JobData, JobProcessor, QueueConfig, JobStatus };
