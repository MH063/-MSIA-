/**
 * 密钥管理服务
 * 管理用户的RSA密钥对，包括生成、存储、导入、导出等功能
 * 支持服务器同步，实现跨设备访问
 */

import {
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
} from './crypto';
import { logger } from './logger';
import api from './api';

/**
 * 存储键名
 */
const STORAGE_KEYS = {
  PUBLIC_KEY: 'msia_public_key',
  ENCRYPTED_PRIVATE_KEY: 'msia_encrypted_private_key',
  KEY_FINGERPRINT: 'msia_key_fingerprint',
  KEY_CREATED_AT: 'msia_key_created_at',
};

/**
 * 密钥状态
 */
export interface KeyStatus {
  hasKeyPair: boolean;
  hasServerKey: boolean;
  publicKeyFingerprint: string | null;
  createdAt: string | null;
  isLocked: boolean;
}

/**
 * 密钥管理器类
 */
class KeyManager {
  private cachedPrivateKey: string | null = null;
  private cachedPublicKey: string | null = null;
  private unlockPassword: string | null = null;

  /**
   * 初始化密钥对
   * 优先从本地加载，如果没有则从服务器同步
   */
  async initialize(password?: string): Promise<KeyStatus> {
    const hasLocalKey = this.hasStoredKeyPair();

    if (hasLocalKey) {
      if (password) {
        await this.unlock(password);
      }
      return this.getStatus();
    }

    // 本地没有密钥，尝试从服务器同步
    if (password) {
      const synced = await this.syncFromServer(password);
      if (synced) {
        return this.getStatus();
      }
    }

    return this.getStatus();
  }

  /**
   * 检查是否已有存储的密钥对
   */
  hasStoredKeyPair(): boolean {
    const publicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
    const encryptedPrivateKey = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY);
    return !!(publicKey && encryptedPrivateKey);
  }

  /**
   * 获取密钥状态
   */
  getStatus(): KeyStatus {
    const publicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
    const encryptedPrivateKey = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY);
    const fingerprint = localStorage.getItem(STORAGE_KEYS.KEY_FINGERPRINT);
    const createdAt = localStorage.getItem(STORAGE_KEYS.KEY_CREATED_AT);

    return {
      hasKeyPair: !!(publicKey && encryptedPrivateKey),
      hasServerKey: false, // 需要异步检查
      publicKeyFingerprint: fingerprint,
      createdAt: createdAt,
      isLocked: !this.cachedPrivateKey,
    };
  }

  /**
   * 检查服务器是否有密钥
   * 使用 fetch API 绕过 axios 拦截器
   */
  async checkServerKey(): Promise<boolean | 'unauthorized'> {
    try {
      const baseUrl = import.meta.env.PROD 
        ? '' 
        : `http://${window.location.hostname}:4000`;
      
      const response = await fetch(`${baseUrl}/api/keys/status`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.status === 401) {
        return 'unauthorized';
      }
      
      const data = await response.json();
      return data?.data?.hasServerKey || false;
    } catch {
      return false;
    }
  }

  /**
   * 生成新的密钥对并存储（同时同步到服务器）
   */
  async generateAndStore(password: string): Promise<void> {
    logger.info('[KeyManager] 开始生成新的密钥对');

    const keyPair = await generateKeyPair();
    const encryptedPrivateKeyStr = await encryptPrivateKey(keyPair.privateKey, password);

    // 存储到本地
    localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, keyPair.publicKey);
    localStorage.setItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY, encryptedPrivateKeyStr);
    localStorage.setItem(STORAGE_KEYS.KEY_FINGERPRINT, keyPair.publicKeyFingerprint);
    localStorage.setItem(STORAGE_KEYS.KEY_CREATED_AT, new Date().toISOString());

    this.cachedPublicKey = keyPair.publicKey;
    this.cachedPrivateKey = keyPair.privateKey;
    this.unlockPassword = password;

    // 同步到服务器
    try {
      await api.post('/api/keys/store', {
        publicKey: keyPair.publicKey,
        encryptedPrivateKey: encryptedPrivateKeyStr,
        keyFingerprint: keyPair.publicKeyFingerprint,
      });
      logger.info('[KeyManager] 密钥已同步到服务器');
    } catch (error) {
      logger.warn('[KeyManager] 密钥同步到服务器失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    logger.info('[KeyManager] 密钥对生成并存储成功', { 
      fingerprint: keyPair.publicKeyFingerprint 
    });
  }

  /**
   * 解锁密钥（使用密码解密私钥）
   */
  async unlock(password: string): Promise<boolean> {
    try {
      const encryptedPrivateKeyStr = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY);
      if (!encryptedPrivateKeyStr) {
        throw new Error('未找到加密的私钥');
      }

      const privateKey = await decryptPrivateKey(encryptedPrivateKeyStr, password);
      this.cachedPrivateKey = privateKey;
      this.cachedPublicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
      this.unlockPassword = password;

      logger.info('[KeyManager] 密钥解锁成功');
      return true;
    } catch (error) {
      logger.warn('[KeyManager] 密钥解锁失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * 从服务器同步密钥到本地
   */
  async syncFromServer(password: string): Promise<boolean> {
    try {
      const response = await api.get('/api/keys/retrieve');
      const keyData = response.data?.data;

      if (!keyData || !keyData.publicKey || !keyData.encryptedPrivateKey) {
        logger.info('[KeyManager] 服务器没有存储密钥');
        return false;
      }

      // 验证密码是否正确（尝试解密）
      const privateKey = await decryptPrivateKey(keyData.encryptedPrivateKey, password);

      // 存储到本地
      localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, keyData.publicKey);
      localStorage.setItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY, keyData.encryptedPrivateKey);
      localStorage.setItem(STORAGE_KEYS.KEY_FINGERPRINT, keyData.keyFingerprint || '');
      localStorage.setItem(STORAGE_KEYS.KEY_CREATED_AT, new Date().toISOString());

      this.cachedPublicKey = keyData.publicKey;
      this.cachedPrivateKey = privateKey;
      this.unlockPassword = password;

      logger.info('[KeyManager] 从服务器同步密钥成功');
      return true;
    } catch (error) {
      logger.warn('[KeyManager] 从服务器同步密钥失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * 同步本地密钥到服务器
   */
  async syncToServer(): Promise<boolean> {
    try {
      const publicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
      const encryptedPrivateKey = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY);
      const fingerprint = localStorage.getItem(STORAGE_KEYS.KEY_FINGERPRINT);

      if (!publicKey || !encryptedPrivateKey) {
        logger.warn('[KeyManager] 本地没有密钥可同步');
        return false;
      }

      await api.post('/api/keys/store', {
        publicKey,
        encryptedPrivateKey,
        keyFingerprint: fingerprint || '',
      });

      logger.info('[KeyManager] 密钥已同步到服务器');
      return true;
    } catch (error) {
      logger.warn('[KeyManager] 同步密钥到服务器失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * 锁定密钥（清除内存中的私钥）
   */
  lock(): void {
    this.cachedPrivateKey = null;
    this.unlockPassword = null;
    logger.info('[KeyManager] 密钥已锁定');
  }

  /**
   * 获取公钥
   */
  getPublicKey(): string | null {
    if (this.cachedPublicKey) {
      return this.cachedPublicKey;
    }
    return localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
  }

  /**
   * 获取私钥（需要先解锁）
   */
  getPrivateKey(): string | null {
    return this.cachedPrivateKey;
  }

  /**
   * 检查是否已解锁
   */
  isUnlocked(): boolean {
    return this.cachedPrivateKey !== null;
  }

  /**
   * 更改密码
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      const encryptedPrivateKeyStr = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY);
      if (!encryptedPrivateKeyStr) {
        throw new Error('未找到加密的私钥');
      }

      const privateKey = await decryptPrivateKey(encryptedPrivateKeyStr, oldPassword);
      const newEncryptedPrivateKey = await encryptPrivateKey(privateKey, newPassword);

      localStorage.setItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY, newEncryptedPrivateKey);

      this.unlockPassword = newPassword;

      // 同步到服务器
      await this.syncToServer();

      logger.info('[KeyManager] 密码更改成功');
      return true;
    } catch (error) {
      logger.warn('[KeyManager] 密码更改失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * 导出密钥对（用于备份）
   */
  async exportKeyPair(password: string): Promise<string> {
    const publicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
    const encryptedPrivateKey = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY);
    const fingerprint = localStorage.getItem(STORAGE_KEYS.KEY_FINGERPRINT);
    const createdAt = localStorage.getItem(STORAGE_KEYS.KEY_CREATED_AT);

    if (!publicKey || !encryptedPrivateKey) {
      throw new Error('未找到密钥对');
    }

    const exportData = {
      version: '1.0',
      publicKey,
      encryptedPrivateKey,
      fingerprint,
      createdAt,
      exportedAt: new Date().toISOString(),
    };

    const exportString = JSON.stringify(exportData);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(exportString);

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

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      dataBuffer
    );

    const result = {
      type: 'MSIA_KEY_BACKUP',
      version: '1.0',
      salt: arrayBufferToBase64(salt),
      iv: arrayBufferToBase64(iv),
      data: arrayBufferToBase64(encryptedBuffer),
    };

    return btoa(JSON.stringify(result));
  }

  /**
   * 导入密钥对（从备份恢复）
   */
  async importKeyPair(backupString: string, password: string): Promise<boolean> {
    try {
      const backupData = JSON.parse(atob(backupString));

      if (backupData.type !== 'MSIA_KEY_BACKUP') {
        throw new Error('无效的备份文件格式');
      }

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
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
          salt: base64ToArrayBuffer(backupData.salt),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const encryptedBuffer = base64ToArrayBuffer(backupData.data);
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToArrayBuffer(backupData.iv) },
        encryptionKey,
        encryptedBuffer
      );

      const keyData = JSON.parse(decoder.decode(decryptedBuffer));

      localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, keyData.publicKey);
      localStorage.setItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY, keyData.encryptedPrivateKey);
      localStorage.setItem(STORAGE_KEYS.KEY_FINGERPRINT, keyData.fingerprint || '');
      localStorage.setItem(STORAGE_KEYS.KEY_CREATED_AT, keyData.createdAt || '');

      this.cachedPublicKey = keyData.publicKey;
      // 注意：导入后密钥处于锁定状态，需要用户调用 unlock() 解密私钥
      this.cachedPrivateKey = null;

      // 同步到服务器
      await this.syncToServer();

      logger.info('[KeyManager] 密钥对导入成功');
      return true;
    } catch (error) {
      logger.warn('[KeyManager] 密钥对导入失败', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * 删除密钥对（危险操作！）
   */
  async deleteKeyPair(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.PUBLIC_KEY);
    localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY);
    localStorage.removeItem(STORAGE_KEYS.KEY_FINGERPRINT);
    localStorage.removeItem(STORAGE_KEYS.KEY_CREATED_AT);
    this.cachedPrivateKey = null;
    this.cachedPublicKey = null;
    this.unlockPassword = null;

    // 从服务器删除
    try {
      await api.delete('/api/keys');
    } catch (error) {
      logger.warn('[KeyManager] 从服务器删除密钥失败', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.warn('[KeyManager] 密钥对已删除');
  }

  /**
   * 获取公钥指纹
   */
  getFingerprint(): string | null {
    return localStorage.getItem(STORAGE_KEYS.KEY_FINGERPRINT);
  }
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
 * 导出单例实例
 */
export const keyManager = new KeyManager();

/**
 * 获取用于服务器存储的公钥数据
 */
export function getPublicKeyForServer(): { publicKey: string; fingerprint: string } | null {
  const publicKey = keyManager.getPublicKey();
  const fingerprint = keyManager.getFingerprint();

  if (!publicKey) {
    return null;
  }

  return {
    publicKey,
    fingerprint: fingerprint || '',
  };
}
