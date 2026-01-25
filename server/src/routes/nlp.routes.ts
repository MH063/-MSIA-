import { Router } from 'express';
import * as nlpController from '../controllers/nlp.controller';

const router = Router();

router.post('/analyze', nlpController.analyzeComplaint);

export default router;
