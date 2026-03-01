/**
 * 密钥管理路由
 * 处理用户密钥的服务器端存储和同步
 */

import { Router, Response, Request } from 'express';
import { requireOperator, OperatorIdentity } from '../middleware/auth';
import * as keyService from '../services/key.service';
import { secureLogger } from '../utils/secureLogger';

interface KeyRequest extends Request {
  operator?: OperatorIdentity;
}

const router = Router();

/**
 * 存储用户密钥到服务器
 * POST /api/keys/store
 */
router.post(
  '/store',
  requireOperator,
  async (req: KeyRequest, res: Response): Promise<void> => {
    try {
      const operatorId = req.operator?.operatorId;
      if (!operatorId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未授权' },
        });
        return;
      }

      const { publicKey, encryptedPrivateKey, keyFingerprint } = req.body;

      if (!publicKey || !encryptedPrivateKey) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: '缺少必要参数' },
        });
        return;
      }

      await keyService.storeUserKey(operatorId, {
        publicKey,
        encryptedPrivateKey,
        keyFingerprint: keyFingerprint || '',
      });

      res.json({
        success: true,
        data: { message: '密钥已同步到服务器' },
      });
    } catch (err) {
      secureLogger.error('[KeyRoutes] 存储密钥失败', err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '存储密钥失败' },
      });
    }
  }
);

/**
 * 从服务器获取用户密钥
 * GET /api/keys/retrieve
 */
router.get(
  '/retrieve',
  requireOperator,
  async (req: KeyRequest, res: Response): Promise<void> => {
    try {
      const operatorId = req.operator?.operatorId;
      if (!operatorId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未授权' },
        });
        return;
      }

      const keyData = await keyService.getUserKey(operatorId);

      if (!keyData) {
        res.status(404).json({
          success: false,
          error: { code: 'KEY_NOT_FOUND', message: '未找到服务器密钥' },
        });
        return;
      }

      res.json({
        success: true,
        data: keyData,
      });
    } catch (err) {
      secureLogger.error('[KeyRoutes] 获取密钥失败', err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取密钥失败' },
      });
    }
  }
);

/**
 * 检查用户是否有服务器密钥
 * GET /api/keys/status
 */
router.get(
  '/status',
  requireOperator,
  async (req: KeyRequest, res: Response): Promise<void> => {
    try {
      const operatorId = req.operator?.operatorId;
      if (!operatorId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未授权' },
        });
        return;
      }

      const hasKey = await keyService.hasServerKey(operatorId);

      res.json({
        success: true,
        data: { hasServerKey: hasKey },
      });
    } catch (err) {
      secureLogger.error('[KeyRoutes] 检查密钥状态失败', err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '检查密钥状态失败' },
      });
    }
  }
);

/**
 * 删除服务器密钥
 * DELETE /api/keys
 */
router.delete(
  '/',
  requireOperator,
  async (req: KeyRequest, res: Response): Promise<void> => {
    try {
      const operatorId = req.operator?.operatorId;
      if (!operatorId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未授权' },
        });
        return;
      }

      await keyService.deleteUserKey(operatorId);

      res.json({
        success: true,
        data: { message: '密钥已从服务器删除' },
      });
    } catch (err) {
      secureLogger.error('[KeyRoutes] 删除密钥失败', err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '删除密钥失败' },
      });
    }
  }
);

export default router;
