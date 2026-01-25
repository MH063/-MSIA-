import { Router } from 'express';
import * as diagnosisController from '../controllers/diagnosis.controller';

const router = Router();

router.post('/suggest', diagnosisController.suggestDiagnosis);

export default router;
