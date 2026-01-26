import { Router } from 'express';
import * as mappingController from '../controllers/mapping.controller';

const router = Router();

router.get('/symptoms', mappingController.getSymptomMappings);

export default router;
