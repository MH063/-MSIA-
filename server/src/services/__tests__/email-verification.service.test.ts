import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateEmailCode,
  createEmailVerificationCode,
  verifyEmailCode,
  cleanupExpiredCodes,
} from '../email-verification.service';
import prisma from '../../prisma';
import { getRedisClient } from '../../utils/redis-client';

vi.mock('../../prisma', () => ({
  default: {
    emailVerificationCode: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../../utils/redis-client', () => ({
  getRedisClient: vi.fn(),
}));

describe('Email Verification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEmailCode', () => {
    it('should generate a 6-digit code', () => {
      const code = generateEmailCode();
      expect(code).toHaveLength(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    it('should generate different codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateEmailCode());
      }
      expect(codes.size).toBeGreaterThan(90);
    });
  });

  describe('createEmailVerificationCode', () => {
    it('should reject invalid email format', async () => {
      const result = await createEmailVerificationCode('invalid-email', 'register');
      expect(result.success).toBe(false);
      expect(result.error).toBe('邮箱格式无效');
    });

    it('should create verification code for valid email', async () => {
      vi.mocked(prisma.emailVerificationCode.create).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        code: '123456',
        type: 'register',
        operatorId: null,
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
        createdAt: new Date(),
      });

      vi.mocked(getRedisClient).mockResolvedValueOnce(null);

      const result = await createEmailVerificationCode('test@example.com', 'register');

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.code).toHaveLength(6);
    });

    it('should reject empty email', async () => {
      const result = await createEmailVerificationCode('', 'register');
      expect(result.success).toBe(false);
      expect(result.error).toBe('邮箱格式无效');
    });
  });

  describe('verifyEmailCode', () => {
    it('should reject empty email or code', async () => {
      const result1 = await verifyEmailCode('', '123456', 'register');
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('邮箱或验证码不能为空');

      const result2 = await verifyEmailCode('test@example.com', '', 'register');
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('邮箱或验证码不能为空');
    });

    it('should return error for invalid code', async () => {
      vi.mocked(prisma.emailVerificationCode.findFirst).mockResolvedValueOnce(null);

      const result = await verifyEmailCode('test@example.com', '123456', 'register');

      expect(result.success).toBe(false);
      expect(result.error).toBe('验证码无效或已过期');
    });

    it('should verify valid code', async () => {
      vi.mocked(prisma.emailVerificationCode.findFirst).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        code: '123456',
        type: 'register',
        operatorId: null,
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
        createdAt: new Date(),
      });

      vi.mocked(prisma.emailVerificationCode.update).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        code: '123456',
        type: 'register',
        operatorId: null,
        expiresAt: new Date(Date.now() + 600000),
        usedAt: new Date(),
        createdAt: new Date(),
      });

      const result = await verifyEmailCode('test@example.com', '123456', 'register');

      expect(result.success).toBe(true);
    });
  });

  describe('cleanupExpiredCodes', () => {
    it('should delete expired codes', async () => {
      vi.mocked(prisma.emailVerificationCode.deleteMany).mockResolvedValueOnce({ count: 5 });

      const count = await cleanupExpiredCodes();

      expect(count).toBe(5);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(prisma.emailVerificationCode.deleteMany).mockRejectedValueOnce(new Error('DB error'));

      const count = await cleanupExpiredCodes();

      expect(count).toBe(0);
    });
  });
});
