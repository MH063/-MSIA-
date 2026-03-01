/**
 * 安全问题路由
 * 处理用户安全问题的设置和验证
 */

import { Router, Response, Request } from 'express';
import { requireOperator, OperatorIdentity } from '../middleware/auth';
import * as securityQuestionService from '../services/securityQuestion.service';
import { secureLogger } from '../utils/secureLogger';

interface SecurityQuestionRequest extends Request {
  operator?: OperatorIdentity;
}

const router = Router();

/**
 * 获取用户的安全问题列表
 * GET /api/security-questions
 */
router.get(
  '/',
  requireOperator,
  async (req: SecurityQuestionRequest, res: Response): Promise<void> => {
    try {
      const operatorId = req.operator?.operatorId;
      if (!operatorId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未授权' },
        });
        return;
      }

      const questions = await securityQuestionService.getSecurityQuestionsByOperatorId(operatorId);
      
      const safeQuestions = questions.map(q => ({
        id: q.id,
        question: q.question,
      }));

      res.json({
        success: true,
        data: safeQuestions,
      });
    } catch (err) {
      secureLogger.error('[SecurityQuestions] 获取安全问题失败', err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取安全问题失败' },
      });
    }
  }
);

/**
 * 创建安全问题
 * POST /api/security-questions
 */
router.post(
  '/',
  requireOperator,
  async (req: SecurityQuestionRequest, res: Response): Promise<void> => {
    try {
      const operatorId = req.operator?.operatorId;
      if (!operatorId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未授权' },
        });
        return;
      }

      const { question, answer } = req.body;

      if (!question || !answer) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: '缺少必要参数' },
        });
        return;
      }

      await securityQuestionService.createSecurityQuestion(operatorId, question, answer);

      res.json({
        success: true,
        data: { message: '安全问题创建成功' },
      });
    } catch (err) {
      secureLogger.error('[SecurityQuestions] 创建安全问题失败', err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '创建安全问题失败' },
      });
    }
  }
);

/**
 * 验证安全问题答案
 * POST /api/security-questions/verify
 */
router.post(
  '/verify',
  requireOperator,
  async (req: SecurityQuestionRequest, res: Response): Promise<void> => {
    try {
      const operatorId = req.operator?.operatorId;
      if (!operatorId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未授权' },
        });
        return;
      }

      const { questionId, answer } = req.body;

      if (!questionId || !answer) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: '缺少必要参数' },
        });
        return;
      }

      const isValid = await securityQuestionService.verifySecurityQuestion(
        operatorId,
        questionId,
        answer
      );

      res.json({
        success: isValid,
        data: { verified: isValid },
      });
    } catch (err) {
      secureLogger.error('[SecurityQuestions] 验证安全问题失败', err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '验证安全问题失败' },
      });
    }
  }
);

/**
 * 删除安全问题
 * DELETE /api/security-questions/:id
 */
router.delete(
  '/:id',
  requireOperator,
  async (req: SecurityQuestionRequest, res: Response): Promise<void> => {
    try {
      const idParam = req.params.id;
      const questionId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);
      
      if (isNaN(questionId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: '无效的问题ID' },
        });
        return;
      }

      await securityQuestionService.deleteSecurityQuestion(questionId);

      res.json({
        success: true,
        data: { message: '安全问题删除成功' },
      });
    } catch (err) {
      secureLogger.error('[SecurityQuestions] 删除安全问题失败', err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '删除安全问题失败' },
      });
    }
  }
);

export default router;
