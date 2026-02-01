import { Router } from 'express';
import * as knowledgeController from '../controllers/knowledge.controller';

const router = Router();

router.get('/', knowledgeController.getAllKnowledge);
router.get('/stream', knowledgeController.streamKnowledgeUpdates);
router.get('/symptom-mappings', knowledgeController.getSymptomMappings);
router.get('/symptom-mapping/:symptomName', knowledgeController.getSymptomMappingByName);
router.get('/diseases', knowledgeController.getDiseases);
router.get('/disease/:diseaseName', knowledgeController.getDiseaseByName);
router.get('/:key', knowledgeController.getKnowledgeByKey);
router.post('/', knowledgeController.upsertKnowledge);
router.delete('/:key', knowledgeController.deleteKnowledge);
router.post('/bulk-delete', knowledgeController.deleteKnowledgeBulk);

export default router;
