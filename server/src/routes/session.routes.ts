import { Router } from 'express';
import * as sessionController from '../controllers/session.controller';
import { validateBody, validateParams } from '../middleware/validate';
import { requirePermission } from '../middleware/auth';
import { SessionSchemas, IdParamSchema } from '../validators';

const router = Router();

// 仪表盘统计
router.get('/stats', requirePermission('session:stats'), sessionController.getDashboardStats);

// 获取所有会话
router.get('/', requirePermission('session:list'), sessionController.getAllSessions);

// 创建会话 - 验证请求体
router.post('/', requirePermission('session:create'), validateBody(SessionSchemas.create), sessionController.createSession);

// 获取单个会话 - 验证ID参数
router.get('/:id', requirePermission('session:read'), validateParams(IdParamSchema), sessionController.getSession);

// 删除会话 - 验证ID参数
router.delete('/:id', requirePermission('session:delete'), validateParams(IdParamSchema), sessionController.deleteSession);

// 批量删除会话
router.post('/bulk-delete', requirePermission('session:bulkDelete'), sessionController.deleteSessionsBulk);

// 更新会话 - 验证ID参数和请求体
router.patch('/:id', requirePermission('session:update'), validateParams(IdParamSchema), validateBody(SessionSchemas.update), sessionController.updateSession);

// 生成报告 - 验证ID参数
router.post('/:id/report', requirePermission('session:report'), validateParams(IdParamSchema), sessionController.generateReport);

// 导出PDF/Word - 验证ID参数
router.get('/:id/export/pdf', requirePermission('session:export'), validateParams(IdParamSchema), sessionController.exportReportPdf);
router.get('/:id/export/word', requirePermission('session:export'), validateParams(IdParamSchema), sessionController.exportReportDocx);

export default router;
