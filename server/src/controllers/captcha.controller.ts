import { Request, Response } from 'express';
import { createCaptcha, verifyCaptcha } from '../services/captcha.service';
import { secureLogger } from '../utils/secureLogger';

/**
 * 生成验证码并返回SVG与ID
 */
export const newCaptcha = async (_req: Request, res: Response) => {
  try {
    const { id, svg, ttlMs } = await createCaptcha();
    res.json({
      success: true,
      data: { id, svg, ttlMs },
    });
  } catch (error) {
    secureLogger.error('[Captcha] 生成验证码失败', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: '生成验证码失败',
    });
  }
};

/**
 * 校验验证码
 */
export const checkCaptcha = async (req: Request, res: Response) => {
  try {
    const { id, code } = req.body || {};
    const ok = await verifyCaptcha(String(id || ''), String(code || ''));
    res.json({
      success: true,
      data: { valid: ok },
    });
  } catch (error) {
    secureLogger.error('[Captcha] 校验验证码失败', error instanceof Error ? error : undefined);
    res.status(500).json({
      success: false,
      message: '校验验证码失败',
    });
  }
};
