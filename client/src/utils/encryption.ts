/**
 * 数据加密服务
 * 提供问诊记录等敏感数据的加密和解密功能
 */

import { keyManager } from './keyManager';
import {
  encryptWithPublicKey,
  decryptWithPrivateKey,
  ENCRYPTED_PREFIX,
  SENSITIVE_FIELDS,
  SensitiveField,
} from './crypto';
import { logger } from './logger';

/**
 * 问诊记录敏感字段
 */
export const INTERVIEW_SENSITIVE_FIELDS: readonly SensitiveField[] = [
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

/**
 * 患者信息敏感字段
 */
export const PATIENT_SENSITIVE_FIELDS: readonly SensitiveField[] = [
  'name',
  'idCard',
  'phone',
  'address',
] as const;

/**
 * 加密状态
 */
export interface EncryptionStatus {
  canEncrypt: boolean;
  canDecrypt: boolean;
  hasKeyPair: boolean;
  isLocked: boolean;
  reason?: string;
}

/**
 * 检查加密能力
 */
export function checkEncryptionCapability(): EncryptionStatus {
  const status = keyManager.getStatus();

  if (!status.hasKeyPair) {
    return {
      canEncrypt: false,
      canDecrypt: false,
      hasKeyPair: false,
      isLocked: true,
      reason: '未创建加密密钥，请先在密钥管理中创建密钥',
    };
  }

  if (status.isLocked) {
    return {
      canEncrypt: true, // 可以加密（使用公钥）
      canDecrypt: false,
      hasKeyPair: true,
      isLocked: true,
      reason: '密钥已锁定，请解锁后才能解密数据',
    };
  }

  return {
    canEncrypt: true,
    canDecrypt: true,
    hasKeyPair: true,
    isLocked: false,
  };
}

/**
 * 加密字符串数据
 */
export async function encryptData(data: string): Promise<string> {
  const publicKey = keyManager.getPublicKey();
  
  if (!publicKey) {
    throw new Error('未找到公钥，请先创建密钥');
  }

  // 如果已经加密，直接返回
  if (data.startsWith(ENCRYPTED_PREFIX)) {
    return data;
  }

  return encryptWithPublicKey(data, publicKey);
}

/**
 * 解密字符串数据
 */
export async function decryptData(encryptedData: string): Promise<string> {
  const privateKey = keyManager.getPrivateKey();
  
  if (!privateKey) {
    throw new Error('未找到私钥，请先解锁密钥');
  }

  // 如果不是加密数据，直接返回
  if (!encryptedData.startsWith(ENCRYPTED_PREFIX)) {
    return encryptedData;
  }

  return decryptWithPrivateKey(encryptedData, privateKey);
}

/**
 * 加密问诊记录数据
 */
export async function encryptInterviewData<T extends Record<string, unknown>>(
  data: T,
  fields: readonly SensitiveField[] = INTERVIEW_SENSITIVE_FIELDS
): Promise<T> {
  const publicKey = keyManager.getPublicKey();
  
  if (!publicKey) {
    logger.warn('[Encryption] 未找到公钥，数据将不加密');
    return data;
  }

  const result = { ...data } as T;

  for (const field of fields) {
    const value = result[field];
    if (value !== undefined && value !== null) {
      if (typeof value === 'string' && value && !value.startsWith(ENCRYPTED_PREFIX)) {
        (result as Record<string, unknown>)[field] = await encryptWithPublicKey(value, publicKey);
      } else if (typeof value === 'object') {
        // 加密 JSON 对象
        const jsonValue = JSON.stringify(value);
        (result as Record<string, unknown>)[field] = await encryptWithPublicKey(jsonValue, publicKey);
      }
    }
  }

  // 添加加密元数据
  (result as Record<string, unknown>)['encryptionVersion'] = '1.0';
  (result as Record<string, unknown>)['encryptedAt'] = new Date().toISOString();

  return result;
}

/**
 * 解密问诊记录数据
 */
export async function decryptInterviewData<T extends Record<string, unknown>>(
  data: T,
  fields: readonly SensitiveField[] = INTERVIEW_SENSITIVE_FIELDS
): Promise<T> {
  const privateKey = keyManager.getPrivateKey();
  
  if (!privateKey) {
    logger.warn('[Encryption] 未找到私钥，返回原始数据');
    return data;
  }

  const result = { ...data } as T;

  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)) {
      try {
        const decrypted = await decryptWithPrivateKey(value, privateKey);
        // 尝试解析为 JSON
        try {
          (result as Record<string, unknown>)[field] = JSON.parse(decrypted);
        } catch {
          (result as Record<string, unknown>)[field] = decrypted;
        }
      } catch (error) {
        logger.warn(`[Encryption] 解密字段 ${field} 失败`, { error });
        (result as Record<string, unknown>)[field] = '***解密失败***';
      }
    }
  }

  return result;
}

/**
 * 检查数据是否已加密
 */
export function isEncrypted(data: string): boolean {
  return data.startsWith(ENCRYPTED_PREFIX);
}

/**
 * 检查对象是否包含加密数据
 */
export function hasEncryptedFields<T extends Record<string, unknown>>(
  data: T,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): boolean {
  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)) {
      return true;
    }
  }
  return false;
}

/**
 * 批量解密问诊记录列表
 */
export async function decryptInterviewList<T extends Record<string, unknown>[]>(
  list: T,
  fields: readonly SensitiveField[] = INTERVIEW_SENSITIVE_FIELDS
): Promise<T> {
  const status = keyManager.getStatus();
  
  if (status.isLocked || !status.hasKeyPair) {
    // 密钥未解锁，返回原始数据
    return list;
  }

  return Promise.all(
    list.map(item => decryptInterviewData(item, fields))
  ) as Promise<T>;
}

export default {
  checkEncryptionCapability,
  encryptData,
  decryptData,
  encryptInterviewData,
  decryptInterviewData,
  isEncrypted,
  hasEncryptedFields,
  decryptInterviewList,
  INTERVIEW_SENSITIVE_FIELDS,
  PATIENT_SENSITIVE_FIELDS,
};
