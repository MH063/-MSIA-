import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate';
import { AuthSchemas } from '../validators';
import { requirePermission } from '../middleware/auth';

const router = Router();

router.post('/login', validateBody(AuthSchemas.login), authController.login);
router.get('/me', requirePermission('auth:me'), authController.me);

export default router;
