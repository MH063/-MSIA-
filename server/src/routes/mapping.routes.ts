import { Router } from 'express';
import * as mappingController from '../controllers/mapping.controller';
import { requirePermission } from '../middleware/auth';

const router = Router();

/**
 * 映射路由 - 权限控制
 * 需要 mapping:read 权限
 */

router.get('/symptoms', requirePermission('mapping:read'), mappingController.getSymptomMappings);

export default router;
