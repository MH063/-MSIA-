import { Router } from 'express';
import * as nlpController from '../controllers/nlp.controller';
import { requirePermission } from '../middleware/auth';

const router = Router();

/**
 * NLP路由 - 权限控制
 * 所有接口需要 nlp:use 权限
 */

router.post('/analyze', requirePermission('nlp:use'), nlpController.analyzeComplaint);
router.post('/chief-complaint/parse', requirePermission('nlp:use'), nlpController.parseChiefComplaint);

export default router;
