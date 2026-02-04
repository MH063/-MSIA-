import { Router } from 'express';
import * as nlpController from '../controllers/nlp.controller';
import { requirePermission } from '../middleware/auth';

const router = Router();

router.post('/analyze', requirePermission('nlp:use'), nlpController.analyzeComplaint);
router.post('/chief-complaint/parse', requirePermission('nlp:use'), nlpController.parseChiefComplaint);

export default router;
