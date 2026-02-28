import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { newCaptcha, checkCaptcha } from '../controllers/captcha.controller';
import * as captchaService from '../services/captcha.service';
import type { Response } from 'express';

interface MockRequest {
  body: Record<string, unknown>;
}

function createMockRes(): unknown {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn();
  return res;
}

vi.mock('../services/captcha.service', () => ({
  createCaptcha: vi.fn(),
  verifyCaptcha: vi.fn(),
}));

describe('CaptchaController', () => {
  let mockReq: MockRequest;
  let mockRes: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { body: {} };
    mockRes = createMockRes();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('newCaptcha', () => {
    it('应该成功生成验证码', async () => {
      const mockCaptcha = {
        id: 'captcha-123',
        svg: '<svg>test</svg>',
        ttlMs: 300000,
      };
      vi.mocked(captchaService.createCaptcha).mockResolvedValue(mockCaptcha);

      await newCaptcha(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: mockCaptcha.id,
          svg: mockCaptcha.svg,
          ttlMs: mockCaptcha.ttlMs,
        },
      });
    });

    it('应该在生成验证码失败时返回500', async () => {
      vi.mocked(captchaService.createCaptcha).mockRejectedValue(new Error('生成失败'));

      await newCaptcha(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(500);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith({
        success: false,
        message: '生成验证码失败',
      });
    });
  });

  describe('checkCaptcha', () => {
    it('应该在验证码正确时返回valid=true', async () => {
      mockReq.body = { id: 'captcha-123', code: 'ABCD' };
      vi.mocked(captchaService.verifyCaptcha).mockResolvedValue(true);

      await checkCaptcha(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith({
        success: true,
        data: { valid: true },
      });
    });

    it('应该在验证码错误时返回valid=false', async () => {
      mockReq.body = { id: 'captcha-123', code: 'WRONG' };
      vi.mocked(captchaService.verifyCaptcha).mockResolvedValue(false);

      await checkCaptcha(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith({
        success: true,
        data: { valid: false },
      });
    });

    it('应该处理空id和code', async () => {
      mockReq.body = {};
      vi.mocked(captchaService.verifyCaptcha).mockResolvedValue(false);

      await checkCaptcha(mockReq as never, mockRes as Response);

      expect(captchaService.verifyCaptcha).toHaveBeenCalledWith('', '');
    });

    it('应该在验证失败时返回500', async () => {
      mockReq.body = { id: 'captcha-123', code: 'ABCD' };
      vi.mocked(captchaService.verifyCaptcha).mockRejectedValue(new Error('验证失败'));

      await checkCaptcha(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(500);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith({
        success: false,
        message: '校验验证码失败',
      });
    });
  });
});
