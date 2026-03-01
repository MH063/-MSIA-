/**
 * 后端加密数据验证服务
 * 
 * 重要说明：
 * - 后端只存储加密数据，不解密
 * - 私钥只存在于用户本地
 * - 后端验证加密数据格式，确保数据完整性
 */

import { secureLogger } from './secureLogger';

/**
 * 加密数据前缀
 */
export const ENCRYPTED_PREFIX = 'enc:';

/**
 * 敏感字段列表
 */
export const SENSITIVE_FIELDS = [
  'name',
  'idCard',
  'phone',
  'address',
  'chiefComplaint',
  'presentIllness',
  'pastHistory',
  'personalHistory',
  'familyHistory',
  'physicalExamination',
  'diagnosisResult',
  'treatmentPlan',
  'prescription',
  'notes',
] as const;

export type SensitiveField = typeof SENSITIVE_FIELDS[number];

/**
 * 加密数据结构
 */
interface EncryptedData {
  ciphertext: string;
  algorithm: string;
  timestamp: number;
}

/**
 * 验证字符串是否为有效的加密数据
 */
export function isValidEncryptedData(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return false;
  }

  try {
    const jsonStr = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64').toString('utf-8');
    const data: EncryptedData = JSON.parse(jsonStr);

    return (
      typeof data.ciphertext === 'string' &&
      typeof data.algorithm === 'string' &&
      typeof data.timestamp === 'number' &&
      data.timestamp > 0
    );
  } catch {
    return false;
  }
}

/**
 * 验证对象中的敏感字段是否已加密
 */
export function validateEncryptedFields<T extends Record<string, unknown>>(
  data: T,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): { valid: boolean; unencryptedFields: string[] } {
  const unencryptedFields: string[] = [];

  for (const field of fields) {
    const value = data[field];
    if (value !== undefined && value !== null && value !== '') {
      const stringValue = String(value);
      if (stringValue && !stringValue.startsWith(ENCRYPTED_PREFIX)) {
        unencryptedFields.push(field);
      }
    }
  }

  return {
    valid: unencryptedFields.length === 0,
    unencryptedFields,
  };
}

/**
 * 确保敏感字段已加密（中间件使用）
 */
export function requireEncryptedFields<T extends Record<string, unknown>>(
  data: T,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): { success: boolean; error?: string } {
  const { valid, unencryptedFields } = validateEncryptedFields(data, fields);

  if (!valid) {
    secureLogger.warn('[Crypto] 敏感字段未加密', { fields: unencryptedFields });
    return {
      success: false,
      error: `以下敏感字段未加密: ${unencryptedFields.join(', ')}`,
    };
  }

  return { success: true };
}

/**
 * 脱敏显示加密数据（用于日志和调试）
 */
export function maskEncryptedData(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  return `${ENCRYPTED_PREFIX}[ENCRYPTED:${value.length}chars]`;
}

/**
 * 脱敏对象中的加密字段
 */
export function maskEncryptedObject<T extends Record<string, unknown>>(
  data: T,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data };

  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)) {
      result[field] = maskEncryptedData(value);
    }
  }

  return result;
}

/**
 * 验证公钥格式
 */
export function isValidPublicKey(publicKey: string): boolean {
  if (typeof publicKey !== 'string') {
    return false;
  }

  try {
    const buffer = Buffer.from(publicKey, 'base64');
    return buffer.length > 100 && buffer.length < 1000;
  } catch {
    return false;
  }
}

/**
 * 生成数据完整性哈希（用于验证数据未被篡改）
 */
export async function generateDataHash(data: Record<string, unknown>): Promise<string> {
  const crypto = await import('crypto');
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

/**
 * 验证数据完整性
 */
export async function verifyDataHash(
  data: Record<string, unknown>,
  expectedHash: string
): Promise<boolean> {
  const actualHash = await generateDataHash(data);
  return actualHash === expectedHash;
}

/**
 * 统计加密字段数量
 */
export function countEncryptedFields<T extends Record<string, unknown>>(
  data: T,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): { total: number; encrypted: number; unencrypted: number } {
  let encrypted = 0;
  let unencrypted = 0;

  for (const field of fields) {
    const value = data[field];
    if (value !== undefined && value !== null && value !== '') {
      const stringValue = String(value);
      if (stringValue.startsWith(ENCRYPTED_PREFIX)) {
        encrypted++;
      } else {
        unencrypted++;
      }
    }
  }

  return {
    total: encrypted + unencrypted,
    encrypted,
    unencrypted,
  };
}

/**
 * 检查数据是否包含敏感信息（用于审计）
 */
export function containsSensitiveData<T extends Record<string, unknown>>(
  data: T,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): boolean {
  for (const field of fields) {
    const value = data[field];
    if (value !== undefined && value !== null && value !== '') {
      return true;
    }
  }
  return false;
}

/**
 * 获取加密状态摘要
 */
export function getEncryptionSummary<T extends Record<string, unknown>>(
  data: T,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): {
  hasSensitiveData: boolean;
  allEncrypted: boolean;
  stats: { total: number; encrypted: number; unencrypted: number };
} {
  const stats = countEncryptedFields(data, fields);

  return {
    hasSensitiveData: stats.total > 0,
    allEncrypted: stats.total > 0 && stats.unencrypted === 0,
    stats,
  };
}
