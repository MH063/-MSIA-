/**
 * Redis 缓存层封装
 * 提供统一的缓存操作接口，支持自动序列化、过期时间、缓存穿透保护等
 */

import { getRedisClient } from './redis-client';
import { secureLogger } from './secureLogger';
import { serverConfig } from '../config';

/**
 * 缓存配置接口
 */
interface CacheConfig {
  ttl?: number;           // 过期时间（秒）
  prefix?: string;        // 键前缀
  tags?: string[];        // 标签，用于批量清除
}

/**
 * 缓存统计信息
 */
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

/**
 * 缓存选项接口
 */
interface CacheOptions extends CacheConfig {
  skipCache?: boolean;    // 是否跳过缓存
  refresh?: boolean;      // 是否强制刷新
}

/**
 * 缓存管理器类
 */
class CacheManager {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  private defaultTTL = 3600; // 默认1小时
  private keyPrefix = 'msia:';

  /**
   * 生成缓存键
   */
  private generateKey(key: string, prefix?: string): string {
    return `${prefix || this.keyPrefix}${key}`;
  }

  /**
   * 序列化值
   */
  private serialize(value: unknown): string {
    return JSON.stringify(value);
  }

  /**
   * 反序列化值
   */
  private deserialize<T>(data: string): T {
    return JSON.parse(data) as T;
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (options?.skipCache || serverConfig.isDevelopment || process.env.NODE_ENV === 'test') {
      return null;
    }

    try {
      const client = await getRedisClient();
      if (!client) {
        return null;
      }

      const fullKey = this.generateKey(key, options?.prefix);
      const data = await client.get(fullKey);

      if (data) {
        this.stats.hits++;
        secureLogger.debug('[Cache] Hit', { key: fullKey });
        return this.deserialize<T>(data);
      }

      this.stats.misses++;
      secureLogger.debug('[Cache] Miss', { key: fullKey });
      return null;
    } catch (error) {
      this.stats.errors++;
      secureLogger.error('[Cache] Get error', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * 设置缓存值
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<boolean> {
    if (options?.skipCache || serverConfig.isDevelopment || process.env.NODE_ENV === 'test') {
      return false;
    }

    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      const fullKey = this.generateKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTTL;
      const serialized = this.serialize(value);

      await client.setEx(fullKey, ttl, serialized);

      // 如果指定了标签，将键添加到标签集合
      if (options?.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await client.sAdd(`tag:${tag}`, fullKey);
        }
      }

      this.stats.sets++;
      secureLogger.debug('[Cache] Set', { key: fullKey, ttl });
      return true;
    } catch (error) {
      this.stats.errors++;
      secureLogger.error('[Cache] Set error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 删除缓存值
   */
  async delete(key: string, prefix?: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      const fullKey = this.generateKey(key, prefix);
      await client.del(fullKey);

      this.stats.deletes++;
      secureLogger.debug('[Cache] Delete', { key: fullKey });
      return true;
    } catch (error) {
      this.stats.errors++;
      secureLogger.error('[Cache] Delete error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 根据标签删除缓存
   */
  async deleteByTag(tag: string): Promise<number> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return 0;
      }

      const keys = await client.sMembers(`tag:${tag}`);
      if (keys.length === 0) {
        return 0;
      }

      await client.del(keys);
      await client.del(`tag:${tag}`);

      this.stats.deletes += keys.length;
      secureLogger.debug('[Cache] Delete by tag', { tag, count: keys.length });
      return keys.length;
    } catch (error) {
      this.stats.errors++;
      secureLogger.error('[Cache] Delete by tag error', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }
  }

  /**
   * 获取或设置缓存（缓存模式）
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // 强制刷新时跳过获取
    if (!options?.refresh) {
      const cached = await this.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }
    }

    // 执行工厂函数获取数据
    const value = await factory();

    // 缓存数据
    await this.set(key, value, options);

    return value;
  }

  /**
   * 批量获取缓存
   */
  async mget<T>(keys: string[], prefix?: string): Promise<(T | null)[]> {
    try {
      const client = await getRedisClient();
      if (!client || keys.length === 0) {
        return keys.map(() => null);
      }

      const fullKeys = keys.map((k) => this.generateKey(k, prefix));
      const results = await client.mGet(fullKeys);

      return results.map((data) => {
        if (data) {
          this.stats.hits++;
          return this.deserialize<T>(data);
        }
        this.stats.misses++;
        return null;
      });
    } catch (error) {
      this.stats.errors++;
      secureLogger.error('[Cache] MGet error', error instanceof Error ? error : new Error(String(error)));
      return keys.map(() => null);
    }
  }

  /**
   * 批量设置缓存
   */
  async mset<T>(
    entries: Array<{ key: string; value: T }>,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client || entries.length === 0) {
        return false;
      }

      const ttl = options?.ttl || this.defaultTTL;
      const multi = client.multi();

      for (const { key, value } of entries) {
        const fullKey = this.generateKey(key, options?.prefix);
        multi.setEx(fullKey, ttl, this.serialize(value));
      }

      await multi.exec();

      this.stats.sets += entries.length;
      secureLogger.debug('[Cache] MSet', { count: entries.length });
      return true;
    } catch (error) {
      this.stats.errors++;
      secureLogger.error('[Cache] MSet error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      const fullKey = this.generateKey(key, prefix);
      const result = await client.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      secureLogger.error('[Cache] Exists error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, ttl: number, prefix?: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      const fullKey = this.generateKey(key, prefix);
      const result = await client.expire(fullKey, ttl);
      return result;
    } catch (error) {
      this.stats.errors++;
      secureLogger.error('[Cache] Expire error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 清空所有缓存（谨慎使用）
   */
  async flushAll(): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }

      await client.flushAll();
      secureLogger.info('[Cache] Flush all');
      return true;
    } catch (error) {
      this.stats.errors++;
      secureLogger.error('[Cache] Flush all error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * 获取缓存命中率
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }
}

// 导出单例
export const cache = new CacheManager();

// 导出类型
export type { CacheConfig, CacheOptions, CacheStats };
