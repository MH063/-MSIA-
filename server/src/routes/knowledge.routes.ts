import { Router } from 'express';
import * as knowledgeController from '../controllers/knowledge.controller';
import { requirePermission } from '../middleware/auth';

const router = Router();

/**
 * 知识库路由 - 权限控制
 * 读取接口：需要 knowledge:read 权限
 * 写入接口：需要 knowledge:write 权限（仅管理员）
 */

// 读取接口 - 需要 knowledge:read 权限
router.get('/', requirePermission('knowledge:read'), knowledgeController.getAllKnowledge);
router.get('/stream', requirePermission('knowledge:read'), knowledgeController.streamKnowledgeUpdates);
router.get('/symptom-mappings', requirePermission('knowledge:read'), knowledgeController.getSymptomMappings);
router.get('/symptom-mapping/:symptomName', requirePermission('knowledge:read'), knowledgeController.getSymptomMappingByName);
router.get('/diseases', requirePermission('knowledge:read'), knowledgeController.getDiseases);
router.get('/disease/:diseaseName', requirePermission('knowledge:read'), knowledgeController.getDiseaseByName);
router.get('/:key', requirePermission('knowledge:read'), knowledgeController.getKnowledgeByKey);

// 写入接口 - 需要 knowledge:write 权限（仅管理员）
router.post('/', requirePermission('knowledge:write'), knowledgeController.upsertKnowledge);
router.delete('/:key', requirePermission('knowledge:write'), knowledgeController.deleteKnowledge);
router.post('/bulk-delete', requirePermission('knowledge:write'), knowledgeController.deleteKnowledgeBulk);

export default router;
