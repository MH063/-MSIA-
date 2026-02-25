/**
 * 数据库连接池监控
 * 提供连接池状态监控、性能指标收集和健康检查
 */

import { Pool } from 'pg';
import { secureLogger } from './secureLogger';
import { alertManager } from './alert';

/**
 * 连接池统计信息
 */
interface PoolStats {
  totalConnections: number;      // 总连接数
  idleConnections: number;       // 空闲连接数
  waitingClients: number;        // 等待连接的客户端数
  activeConnections: number;     // 活跃连接数
  maxConnections: number;        // 最大连接数
  connectionUtilization: number; // 连接利用率
}

/**
 * 查询性能统计
 */
interface QueryStats {
  totalQueries: number;          // 总查询数
  slowQueries: number;           // 慢查询数
  averageQueryTime: number;      // 平均查询时间(ms)
  maxQueryTime: number;          // 最大查询时间(ms)
  errors: number;                // 查询错误数
}

/**
 * 数据库健康状态
 */
interface HealthStatus {
  healthy: boolean;
  responseTime: number;
  lastCheck: Date;
  message?: string;
}

/**
 * 监控配置
 */
interface MonitorConfig {
  slowQueryThreshold: number;    // 慢查询阈值(ms)
  healthCheckInterval: number;   // 健康检查间隔(ms)
  maxQueryHistory: number;       // 最大查询历史记录数
}

/**
 * 数据库监控器类
 */
class DatabaseMonitor {
  private pool: Pool | null = null;
  private queryStats: QueryStats = {
    totalQueries: 0,
    slowQueries: 0,
    averageQueryTime: 0,
    maxQueryTime: 0,
    errors: 0,
  };
  private queryTimes: number[] = [];
  private config: MonitorConfig = {
    slowQueryThreshold: 1000,
    healthCheckInterval: 30000,
    maxQueryHistory: 1000,
  };
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private lastHealthStatus: HealthStatus | null = null;

  /**
   * 初始化监控器
   */
  initialize(pool: Pool, config?: Partial<MonitorConfig>): void {
    this.pool = pool;
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // 设置连接池事件监听
    this.setupPoolListeners();

    // 启动健康检查
    this.startHealthCheck();

    secureLogger.info('[DBMonitor] 监控器已初始化');
  }

  /**
   * 设置连接池事件监听
   */
  private setupPoolListeners(): void {
    if (!this.pool) {return;}

    this.pool.on('connect', () => {
      secureLogger.debug('[DBMonitor] 新连接建立');
    });

    this.pool.on('acquire', () => {
      secureLogger.debug('[DBMonitor] 连接被获取');
    });

    this.pool.on('remove', () => {
      secureLogger.debug('[DBMonitor] 连接被移除');
    });

    this.pool.on('error', (err) => {
      this.queryStats.errors++;
      secureLogger.error('[DBMonitor] 连接池错误', err);
    });
  }

  /**
   * 记录查询执行
   */
  recordQuery(duration: number, error?: Error): void {
    this.queryStats.totalQueries++;

    if (error) {
      this.queryStats.errors++;
    }

    // 记录查询时间
    this.queryTimes.push(duration);
    if (this.queryTimes.length > this.config.maxQueryHistory) {
      this.queryTimes.shift();
    }

    // 检查慢查询
    if (duration > this.config.slowQueryThreshold) {
      this.queryStats.slowQueries++;
      secureLogger.warn('[DBMonitor] 慢查询 detected', {
        duration,
        threshold: this.config.slowQueryThreshold,
      });
    }

    // 更新统计
    this.updateQueryStats();
  }

  /**
   * 更新查询统计
   */
  private updateQueryStats(): void {
    if (this.queryTimes.length === 0) {return;}

    const sum = this.queryTimes.reduce((a, b) => a + b, 0);
    this.queryStats.averageQueryTime = sum / this.queryTimes.length;
    this.queryStats.maxQueryTime = Math.max(...this.queryTimes);
  }

  /**
   * 获取连接池统计
   */
  getPoolStats(): PoolStats | null {
    if (!this.pool) {return null;}

    const pool = this.pool as unknown as {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
      options: { max: number };
    };

    const totalConnections = pool.totalCount || 0;
    const idleConnections = pool.idleCount || 0;
    const waitingClients = pool.waitingCount || 0;
    const maxConnections = pool.options?.max || 10;

    return {
      totalConnections,
      idleConnections,
      waitingClients,
      activeConnections: totalConnections - idleConnections,
      maxConnections,
      connectionUtilization: maxConnections > 0
        ? (totalConnections - idleConnections) / maxConnections
        : 0,
    };
  }

  /**
   * 获取查询统计
   */
  getQueryStats(): QueryStats {
    return { ...this.queryStats };
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): HealthStatus | null {
    return this.lastHealthStatus;
  }

  /**
   * 执行健康检查
   */
  async checkHealth(): Promise<HealthStatus> {
    if (!this.pool) {
      return {
        healthy: false,
        responseTime: 0,
        lastCheck: new Date(),
        message: '连接池未初始化',
      };
    }

    const startTime = Date.now();
    let client;

    try {
      client = await this.pool.connect();
      await client.query('SELECT 1');

      const responseTime = Date.now() - startTime;
      const status: HealthStatus = {
        healthy: true,
        responseTime,
        lastCheck: new Date(),
      };

      this.lastHealthStatus = status;
      return status;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const status: HealthStatus = {
        healthy: false,
        responseTime,
        lastCheck: new Date(),
        message: error instanceof Error ? error.message : '健康检查失败',
      };

      this.lastHealthStatus = status;
      return status;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * 启动健康检查定时器
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      const status = await this.checkHealth();

      if (!status.healthy) {
        // 发送告警
        await alertManager.checkRules({
          type: 'database',
          healthy: false,
          responseTime: status.responseTime,
          message: status.message,
        });

        secureLogger.error('[DBMonitor] 健康检查失败', new Error(status.message || 'Unknown error'));
      }

      // 检查慢查询告警
      if (this.queryStats.slowQueries > 0) {
        await alertManager.checkRules({
          type: 'slow-query',
          count: this.queryStats.slowQueries,
          maxDuration: this.queryStats.maxQueryTime,
        });
      }

      // 检查连接池利用率
      const poolStats = this.getPoolStats();
      if (poolStats && poolStats.connectionUtilization > 0.9) {
        await alertManager.checkRules({
          type: 'connection-pool',
          utilization: poolStats.connectionUtilization,
          activeConnections: poolStats.activeConnections,
          maxConnections: poolStats.maxConnections,
        });
      }
    }, this.config.healthCheckInterval);

    // 确保定时器不会阻止程序退出
    this.healthCheckTimer.unref();
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.queryStats = {
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      maxQueryTime: 0,
      errors: 0,
    };
    this.queryTimes = [];
  }

  /**
   * 获取完整报告
   */
  getReport(): {
    pool: PoolStats | null;
    queries: QueryStats;
    health: HealthStatus | null;
  } {
    return {
      pool: this.getPoolStats(),
      queries: this.getQueryStats(),
      health: this.getHealthStatus(),
    };
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stopHealthCheck();
    this.pool = null;
    secureLogger.info('[DBMonitor] 监控器已销毁');
  }
}

// 导出单例
export const dbMonitor = new DatabaseMonitor();

// 导出类型
export type { PoolStats, QueryStats, HealthStatus, MonitorConfig };
