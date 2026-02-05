import { Router } from 'express';
import * as knowledgeController from '../controllers/knowledge.controller';

const router = Router();

// 开发环境：开放读取接口
router.get('/', knowledgeController.getAllKnowledge);
router.get('/stream', knowledgeController.streamKnowledgeUpdates);
router.get('/symptom-mappings', knowledgeController.getSymptomMappings);
router.get('/symptom-mapping/:symptomName', knowledgeController.getSymptomMappingByName);
router.get('/diseases', knowledgeController.getDiseases);
router.get('/disease/:diseaseName', knowledgeController.getDiseaseByName);
router.get('/:key', knowledgeController.getKnowledgeByKey);

// 生产环境：写接口需要认证
router.post('/', knowledgeController.upsertKnowledge);
router.delete('/:key', knowledgeController.deleteKnowledge);
router.post('/bulk-delete', knowledgeController.deleteKnowledgeBulk);

export default router;
