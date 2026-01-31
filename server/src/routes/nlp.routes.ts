import { Router } from 'express';
import * as nlpController from '../controllers/nlp.controller';

const router = Router();

router.post('/analyze', nlpController.analyzeComplaint);
router.post('/chief-complaint/parse', nlpController.parseChiefComplaint);

export default router;
