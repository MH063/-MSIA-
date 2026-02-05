import { Request, Response } from 'express';
import { createCaptcha, verifyCaptcha } from '../services/captcha.service';

/**
 * 生成验证码并返回SVG与ID
 */
export const newCaptcha = async (_req: Request, res: Response) => {
  const { id, svg, ttlMs } = await createCaptcha();
  res.json({
    success: true,
    data: { id, svg, ttlMs },
  });
};

/**
 * 校验验证码
 */
export const checkCaptcha = async (req: Request, res: Response) => {
  const { id, code } = req.body || {};
  const ok = await verifyCaptcha(String(id || ''), String(code || ''));
  res.json({
    success: true,
    data: { valid: ok },
  });
};
