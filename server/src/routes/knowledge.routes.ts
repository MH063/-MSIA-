import { Router } from 'express';
import * as knowledgeController from '../controllers/knowledge.controller';

const router = Router();

router.get('/', knowledgeController.getAllKnowledge);
router.get('/:key', knowledgeController.getKnowledgeByKey);
router.post('/', knowledgeController.upsertKnowledge);
router.delete('/:key', knowledgeController.deleteKnowledge);
router.post('/bulk-delete', knowledgeController.deleteKnowledgeBulk);

export default router;
