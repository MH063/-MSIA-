import { Router } from 'express';
import * as emailAuthController from '../controllers/email-auth.controller';
import { validateBody } from '../middleware/validate';
import { EmailAuthSchemas } from '../validators/email-auth.validators';
import { requirePermission } from '../middleware/auth';

const router = Router();

router.post(
  '/send-code',
  validateBody(EmailAuthSchemas.sendCode),
  emailAuthController.sendEmailCode
);

router.post(
  '/register',
  validateBody(EmailAuthSchemas.register),
  emailAuthController.emailRegister
);

router.post(
  '/login',
  validateBody(EmailAuthSchemas.login),
  emailAuthController.emailLogin
);

router.post(
  '/reset-password',
  validateBody(EmailAuthSchemas.resetPassword),
  emailAuthController.resetPassword
);

router.post(
  '/change-password',
  requirePermission('auth:me'),
  validateBody(EmailAuthSchemas.changePassword),
  emailAuthController.changePassword
);

router.post(
  '/change-email',
  requirePermission('auth:me'),
  validateBody(EmailAuthSchemas.changeEmail),
  emailAuthController.changeEmail
);

router.get(
  '/me',
  requirePermission('auth:me'),
  emailAuthController.emailMe
);

export default router;
