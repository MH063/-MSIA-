/**
 * 用户密钥服务
 * 处理用户密钥的服务器端存储和同步
 */

import prisma from '../prisma';
import { secureLogger } from '../utils/secureLogger';

/**
 * 密钥数据接口
 */
export interface KeyData {
  publicKey: string;
  encryptedPrivateKey: string;
  keyFingerprint: string;
}

/**
 * 存储用户密钥到服务器
 */
export async function storeUserKey(
  operatorId: number,
  keyData: KeyData
): Promise<void> {
  await prisma.operator.update({
    where: { id: operatorId },
    data: {
      publicKey: keyData.publicKey,
      encryptedPrivateKey: keyData.encryptedPrivateKey,
      keyFingerprint: keyData.keyFingerprint,
      keyCreatedAt: new Date(),
    },
  });

  secureLogger.info('[KeyService] 用户密钥已存储到服务器', { operatorId });
}

/**
 * 从服务器获取用户密钥
 */
export async function getUserKey(
  operatorId: number
): Promise<KeyData | null> {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: {
      publicKey: true,
      encryptedPrivateKey: true,
      keyFingerprint: true,
    },
  });

  if (!operator || !operator.publicKey || !operator.encryptedPrivateKey) {
    return null;
  }

  return {
    publicKey: operator.publicKey,
    encryptedPrivateKey: operator.encryptedPrivateKey,
    keyFingerprint: operator.keyFingerprint || '',
  };
}

/**
 * 检查用户是否有服务器密钥
 */
export async function hasServerKey(operatorId: number): Promise<boolean> {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: {
      publicKey: true,
      encryptedPrivateKey: true,
    },
  });

  return !!(operator?.publicKey && operator?.encryptedPrivateKey);
}

/**
 * 删除用户密钥
 */
export async function deleteUserKey(operatorId: number): Promise<void> {
  await prisma.operator.update({
    where: { id: operatorId },
    data: {
      publicKey: null,
      encryptedPrivateKey: null,
      keyFingerprint: null,
      keyCreatedAt: null,
    },
  });

  secureLogger.info('[KeyService] 用户密钥已从服务器删除', { operatorId });
}
