import { Router } from 'express';
import * as captchaController from '../controllers/captcha.controller';
import { validateBody } from '../middleware/validate';
import { CaptchaSchemas } from '../validators';

const router = Router();

router.get('/new', captchaController.newCaptcha);
router.post('/verify', validateBody(CaptchaSchemas.verify), captchaController.checkCaptcha);

export default router;
