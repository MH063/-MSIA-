import { Router } from 'express';
import * as nlpController from '../controllers/nlp.controller';

const router = Router();

// 开发环境：开放NLP接口
router.post('/analyze', nlpController.analyzeComplaint);
router.post('/chief-complaint/parse', nlpController.parseChiefComplaint);

export default router;
