/**
 * 非对称加密服务
 * 使用 RSA-OAEP 算法实现敏感数据的加密存储
 * 私钥只存在于用户本地，服务器只存储公钥和加密后的数据
 */

import { logger } from './logger';

/**
 * 加密算法配置
 */
const RSA_CONFIG = {
  algorithm: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

/**
 * 加密字段标记前缀
 */
export const ENCRYPTED_PREFIX = 'enc:';

/**
 * 敏感字段列表 - 这些字段需要加密存储
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
 * 密钥对接口
 */
export interface KeyPair {
  publicKey: string;
  privateKey: string;
  publicKeyFingerprint: string;
}

/**
 * 加密数据接口
 */
export interface EncryptedData {
  ciphertext: string;
  algorithm: string;
  timestamp: number;
}

/**
 * 生成RSA密钥对
 */
export async function generateKeyPair(): Promise<KeyPair> {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: RSA_CONFIG.algorithm,
        modulusLength: RSA_CONFIG.modulusLength,
        publicExponent: RSA_CONFIG.publicExponent,
        hash: RSA_CONFIG.hash,
      },
      true,
      ['encrypt', 'decrypt']
    );

    const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const publicKey = arrayBufferToBase64(publicKeyBuffer);
    const privateKey = arrayBufferToBase64(privateKeyBuffer);

    const publicKeyFingerprint = await generateFingerprint(publicKey);

    logger.info('[Crypto] RSA密钥对生成成功');

    return {
      publicKey,
      privateKey,
      publicKeyFingerprint,
    };
  } catch (error) {
    logger.error('[Crypto] 生成密钥对失败', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('生成密钥对失败');
  }
}

/**
 * 导入公钥
 */
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
  
  return window.crypto.subtle.importKey(
    'spki',
    publicKeyBuffer,
    {
      name: RSA_CONFIG.algorithm,
      hash: RSA_CONFIG.hash,
    },
    false,
    ['encrypt']
  );
}

/**
 * 导入私钥
 */
export async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
  
  return window.crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    {
      name: RSA_CONFIG.algorithm,
      hash: RSA_CONFIG.hash,
    },
    false,
    ['decrypt']
  );
}

/**
 * 使用公钥加密数据
 */
export async function encryptWithPublicKey(data: string, publicKeyBase64: string): Promise<string> {
  try {
    const publicKey = await importPublicKey(publicKeyBase64);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: RSA_CONFIG.algorithm,
      },
      publicKey,
      dataBuffer
    );

    const encryptedData: EncryptedData = {
      ciphertext: arrayBufferToBase64(encryptedBuffer),
      algorithm: RSA_CONFIG.algorithm,
      timestamp: Date.now(),
    };

    return ENCRYPTED_PREFIX + btoa(JSON.stringify(encryptedData));
  } catch (error) {
    logger.error('[Crypto] 加密失败', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('数据加密失败');
  }
}

/**
 * 使用私钥解密数据
 */
export async function decryptWithPrivateKey(encryptedString: string, privateKeyBase64: string): Promise<string> {
  try {
    if (!encryptedString.startsWith(ENCRYPTED_PREFIX)) {
      return encryptedString;
    }

    const privateKey = await importPrivateKey(privateKeyBase64);
    const encryptedData: EncryptedData = JSON.parse(atob(encryptedString.slice(ENCRYPTED_PREFIX.length)));
    const encryptedBuffer = base64ToArrayBuffer(encryptedData.ciphertext);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: RSA_CONFIG.algorithm,
      },
      privateKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    logger.error('[Crypto] 解密失败', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('数据解密失败');
  }
}

/**
 * 加密对象中的敏感字段
 */
export async function encryptSensitiveFields<T extends Record<string, unknown>>(
  data: T,
  publicKeyBase64: string,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): Promise<T> {
  const result = { ...data } as T;

  for (const field of fields) {
    const value = result[field];
    if (value !== undefined && value !== null && value !== '') {
      const stringValue = String(value);
      if (stringValue && !stringValue.startsWith(ENCRYPTED_PREFIX)) {
        (result as Record<string, unknown>)[field] = await encryptWithPublicKey(stringValue, publicKeyBase64);
      }
    }
  }

  return result;
}

/**
 * 解密对象中的敏感字段
 */
export async function decryptSensitiveFields<T extends Record<string, unknown>>(
  data: T,
  privateKeyBase64: string,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): Promise<T> {
  const result = { ...data } as T;

  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)) {
      try {
        (result as Record<string, unknown>)[field] = await decryptWithPrivateKey(value, privateKeyBase64);
      } catch {
        (result as Record<string, unknown>)[field] = '***解密失败***';
      }
    }
  }

  return result;
}

/**
 * 使用用户密码加密私钥（用于本地安全存储）
 */
export async function encryptPrivateKey(privateKey: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptionKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const privateKeyBuffer = encoder.encode(privateKey);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    privateKeyBuffer
  );

  const result = {
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(encryptedBuffer),
  };

  return btoa(JSON.stringify(result));
}

/**
 * 使用用户密码解密私钥
 */
export async function decryptPrivateKey(encryptedPrivateKey: string, password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const { salt, iv, ciphertext } = JSON.parse(atob(encryptedPrivateKey));
    
    const passwordBuffer = encoder.encode(password);
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const encryptionKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: base64ToArrayBuffer(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToArrayBuffer(iv) },
      encryptionKey,
      base64ToArrayBuffer(ciphertext)
    );

    return decoder.decode(decryptedBuffer);
  } catch {
    throw new Error('私钥解密失败，请检查密码是否正确');
  }
}

/**
 * 生成公钥指纹（用于验证）
 */
async function generateFingerprint(publicKeyBase64: string): Promise<string> {
  const buffer = new TextEncoder().encode(publicKeyBase64);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join(':').substring(0, 23);
}

/**
 * ArrayBuffer 转 Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 转 ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 检查数据是否已加密
 */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * 批量加密数据
 */
export async function encryptBatch<T extends Record<string, unknown>>(
  dataArray: T[],
  publicKeyBase64: string,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): Promise<T[]> {
  return Promise.all(dataArray.map(data => encryptSensitiveFields(data, publicKeyBase64, fields)));
}

/**
 * 批量解密数据
 */
export async function decryptBatch<T extends Record<string, unknown>>(
  dataArray: T[],
  privateKeyBase64: string,
  fields: readonly SensitiveField[] = SENSITIVE_FIELDS
): Promise<T[]> {
  return Promise.all(dataArray.map(data => decryptSensitiveFields(data, privateKeyBase64, fields)));
}
