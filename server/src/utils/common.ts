/**
 * 通用工具函数
 * 提取重复代码，提高代码复用性
 */

import { paginationConfig } from '../config';

/**
 * 分页参数处理
 * @param page 页码
 * @param limit 每页数量
 * @returns 规范化的分页参数
 */
export function normalizePagination(
  page: number | string | undefined,
  limit: number | string | undefined
): { page: number; limit: number; skip: number } {
  const normalizedPage = Math.max(1, parseInt(String(page || paginationConfig.defaultPage), 10));
  const normalizedLimit = Math.min(
    paginationConfig.maxLimit,
    Math.max(1, parseInt(String(limit || paginationConfig.defaultLimit), 10))
  );

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
  };
}

/**
 * 构建分页响应
 * @param data 数据列表
 * @param total 总数量
 * @param page 当前页
 * @param limit 每页数量
 * @returns 分页响应对象
 */
export function buildPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * 安全地解析JSON
 * @param jsonString JSON字符串
 * @param defaultValue 默认值
 * @returns 解析后的对象或默认值
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 安全地字符串化JSON
 * @param value 要序列化的值
 * @param defaultValue 默认值
 * @returns JSON字符串或默认值
 */
export function safeJsonStringify(value: unknown, defaultValue: string = '{}'): string {
  try {
    return JSON.stringify(value);
  } catch {
    return defaultValue;
  }
}

/**
 * 清理字符串中的特殊字符（防止XSS）
 * @param str 输入字符串
 * @returns 清理后的字符串
 */
export function sanitizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/[<>]/g, '') // 移除尖括号
    .trim();
}

/**
 * 清理HTML内容（防止XSS）
 * @param html HTML字符串
 * @returns 清理后的纯文本
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // 移除HTML标签
    .replace(/&nbsp;/g, ' ') // 转换空格
    .replace(/&[a-z]+;/gi, '') // 移除HTML实体
    .trim();
}

/**
 * 生成唯一ID
 * @returns 唯一ID字符串
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 延迟执行
 * @param ms 毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试函数
 * @param fn 要执行的函数
 * @param maxRetries 最大重试次数
 * @param delayMs 重试间隔
 * @returns 函数执行结果
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await delay(delayMs * (i + 1)); // 指数退避
      }
    }
  }

  throw lastError;
}

/**
 * 深度克隆对象
 * @param obj 要克隆的对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T;

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * 检查对象是否为空
 * @param obj 要检查的对象
 * @returns 是否为空
 */
export function isEmptyObject(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * 从对象中选择指定字段
 * @param obj 源对象
 * @param keys 要选择的字段
 * @returns 新对象
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * 从对象中排除指定字段
 * @param obj 源对象
 * @param keys 要排除的字段
 * @returns 新对象
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
}
