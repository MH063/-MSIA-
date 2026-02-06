/**
 * 数据加密工具
 * 提供敏感数据的加密、解密和脱敏功能
 */

import crypto from 'crypto';
import { secureLogger } from './secureLogger';

// 扩展 crypto 类型以支持 GCM 模式
type CipherGCM = crypto.CipherGCM;
type DecipherGCM = crypto.DecipherGCM;

/**
 * 加密配置
 */
interface EncryptionConfig {
  algorithm: string;
  key: Buffer;
  ivLength: number;
}

/**
 * 加密后的数据结构
 */
interface EncryptedData {
  encrypted: string;
  iv: string;
  tag?: string;
}

/**
 * 敏感字段配置
 */
const SENSITIVE_FIELDS = [
  'phone',
  'mobile',
  'idCard',
  'idNumber',
  'email',
  'address',
  'contactInfo',
  'emergencyContact',
];

/**
 * 获取加密配置
 */
function getEncryptionConfig(): EncryptionConfig {
  const key = process.env.ENCRYPTION_KEY || '';
  if (!key || key.length < 32) {
    // 使用默认密钥（仅开发环境）
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境必须设置 ENCRYPTION_KEY 环境变量');
    }
    return {
      algorithm: 'aes-256-gcm',
      key: crypto.scryptSync('default-key-for-dev-only', 'salt', 32),
      ivLength: 16,
    };
  }

  return {
    algorithm: 'aes-256-gcm',
    key: Buffer.from(key.padEnd(32, '0').slice(0, 32)),
    ivLength: 16,
  };
}

/**
 * 加密文本
 * @param text 要加密的文本
 * @returns 加密后的数据结构
 */
export function encrypt(text: string): EncryptedData {
  try {
    const config = getEncryptionConfig();
    const iv = crypto.randomBytes(config.ivLength);
    const cipher = crypto.createCipheriv(config.algorithm, config.key, iv) as CipherGCM;

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 获取认证标签（GCM模式）
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  } catch (error) {
    secureLogger.error('[Encryption] 加密失败', error instanceof Error ? error : new Error(String(error)));
    throw new Error('加密失败');
  }
}

/**
 * 解密文本
 * @param data 加密后的数据结构
 * @returns 解密后的文本
 */
export function decrypt(data: EncryptedData): string {
  try {
    const config = getEncryptionConfig();
    const decipher = crypto.createDecipheriv(
      config.algorithm,
      config.key,
      Buffer.from(data.iv, 'hex')
    ) as DecipherGCM;

    // 设置认证标签（GCM模式）
    if (data.tag) {
      decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
    }

    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    secureLogger.error('[Encryption] 解密失败', error instanceof Error ? error : new Error(String(error)));
    throw new Error('解密失败');
  }
}

/**
 * 加密对象中的敏感字段
 * @param obj 要加密的对象
 * @param fields 要加密的字段列表
 * @returns 加密后的对象
 */
export function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  fields: string[] = SENSITIVE_FIELDS
): T {
  const result = { ...obj } as Record<string, unknown>;

  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      const encrypted = encrypt(result[field] as string);
      result[field] = JSON.stringify(encrypted);
    }
  }

  return result as T;
}

/**
 * 解密对象中的敏感字段
 * @param obj 要解密的对象
 * @param fields 要解密的字段列表
 * @returns 解密后的对象
 */
export function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  fields: string[] = SENSITIVE_FIELDS
): T {
  const result = { ...obj } as Record<string, unknown>;

  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        const encryptedData = JSON.parse(result[field] as string) as EncryptedData;
        result[field] = decrypt(encryptedData);
      } catch {
        // 如果解密失败，保持原值
        secureLogger.warn('[Encryption] 字段解密失败', { field });
      }
    }
  }

  return result as T;
}

/**
 * 脱敏处理
 * 将敏感信息部分隐藏
 */
export const mask = {
  /**
   * 手机号脱敏
   * 138****8888
   */
  phone(value: string): string {
    if (!value || value.length < 7) return value;
    return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  },

  /**
   * 身份证号脱敏
   * 110101********1234
   */
  idCard(value: string): string {
    if (!value || value.length < 8) return value;
    return value.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
  },

  /**
   * 邮箱脱敏
   * t***@example.com
   */
  email(value: string): string {
    if (!value || !value.includes('@')) return value;
    const [local, domain] = value.split('@');
    if (local.length <= 1) return value;
    return `${local[0]}***@${domain}`;
  },

  /**
   * 姓名脱敏
   * 张**
   */
  name(value: string): string {
    if (!value || value.length < 2) return value;
    if (value.length === 2) return `${value[0]}*`;
    return `${value[0]}${'*'.repeat(value.length - 2)}${value[value.length - 1]}`;
  },

  /**
   * 地址脱敏
   * 北京市********
   */
  address(value: string): string {
    if (!value || value.length < 10) return value;
    return `${value.slice(0, 6)}${'*'.repeat(value.length - 6)}`;
  },

  /**
   * 通用脱敏
   * 保留前3后4，中间用****代替
   */
  general(value: string): string {
    if (!value || value.length < 8) return value;
    return `${value.slice(0, 3)}${'*'.repeat(value.length - 7)}${value.slice(-4)}`;
  },
};

/**
 * 脱敏对象中的敏感字段
 * @param obj 要脱敏的对象
 * @param fields 要脱敏的字段配置
 * @returns 脱敏后的对象
 */
export function maskObject<T extends Record<string, unknown>>(
  obj: T,
  fields: Record<string, keyof typeof mask> = {
    phone: 'phone',
    mobile: 'phone',
    idCard: 'idCard',
    idNumber: 'idCard',
    email: 'email',
    address: 'address',
  }
): T {
  const result = { ...obj } as Record<string, unknown>;

  for (const [field, maskType] of Object.entries(fields)) {
    if (result[field] && typeof result[field] === 'string') {
      const maskFn = mask[maskType];
      if (maskFn) {
        result[field] = maskFn(result[field] as string);
      }
    }
  }

  return result as T;
}

/**
 * 哈希处理（用于密码等不可逆加密）
 */
export const hash = {
  /**
   * SHA256 哈希
   */
  sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  },

  /**
   * HMAC 哈希
   */
  hmac(value: string, secret?: string): string {
    const key = secret || process.env.HMAC_SECRET || 'default-secret';
    return crypto.createHmac('sha256', key).update(value).digest('hex');
  },

  /**
   * 带盐的哈希（推荐用于密码）
   */
  withSalt(value: string, salt?: string): { hash: string; salt: string } {
    const usedSalt = salt || crypto.randomBytes(16).toString('hex');
    const hashValue = crypto
      .pbkdf2Sync(value, usedSalt, 100000, 64, 'sha512')
      .toString('hex');
    return { hash: hashValue, salt: usedSalt };
  },

  /**
   * 验证带盐的哈希
   */
  verifyWithSalt(value: string, hashValue: string, salt: string): boolean {
    const { hash: computedHash } = this.withSalt(value, salt);
    return computedHash === hashValue;
  },
};

/**
 * 生成随机密钥
 */
export function generateKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 生成随机IV
 */
export function generateIV(length: number = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

// 导出类型
export type { EncryptionConfig, EncryptedData };
