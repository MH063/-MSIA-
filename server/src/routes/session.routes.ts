import { Router } from 'express';
import * as sessionController from '../controllers/session.controller';
import { validateBody, validateParams } from '../middleware/validate';
import { requireOperator } from '../middleware/auth';
import { SessionSchemas, IdParamSchema } from '../validators';

const router = Router();

// 仪表盘统计
router.get('/stats', sessionController.getDashboardStats);

// 获取所有会话
router.get('/', sessionController.getAllSessions);

// 创建会话 - 验证请求体
router.post('/', validateBody(SessionSchemas.create), sessionController.createSession);

// 获取单个会话 - 验证ID参数
router.get('/:id', validateParams(IdParamSchema), sessionController.getSession);

// 删除会话 - 验证ID参数
router.delete('/:id', validateParams(IdParamSchema), requireOperator, sessionController.deleteSession);

// 批量删除会话
router.post('/bulk-delete', requireOperator, sessionController.deleteSessionsBulk);

// 更新会话 - 验证ID参数和请求体
router.patch('/:id', validateParams(IdParamSchema), validateBody(SessionSchemas.update), sessionController.updateSession);

// 生成报告 - 验证ID参数
router.post('/:id/report', validateParams(IdParamSchema), sessionController.generateReport);

export default router;
