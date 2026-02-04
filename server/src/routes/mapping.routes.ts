import { Router } from 'express';
import * as mappingController from '../controllers/mapping.controller';
import { requirePermission } from '../middleware/auth';

const router = Router();

router.get('/symptoms', requirePermission('mapping:read'), mappingController.getSymptomMappings);

export default router;
