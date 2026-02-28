import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import {
  sendEmailCode,
  emailRegister,
  emailLogin,
  resetPassword,
  changePassword,
  changeEmail,
  emailMe,
} from '../email-auth.controller';
import prisma from '../../prisma';
import { getRedisClient } from '../../utils/redis-client';
import { createEmailVerificationCode, verifyEmailCode } from '../../email-verification.service';
import { sendVerificationEmail, sendPasswordChangedNotification, sendEmailChangedNotification } from '../../email.service';
import { hashPassword, comparePassword, signAccessToken, signRefreshToken } from '../../utils/auth-helpers';

vi.mock('../../prisma', () => ({
  default: {
    operator: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    emailVerificationCode: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../utils/redis-client', () => ({
  getRedisClient: vi.fn(),
}));

vi.mock('../../email-verification.service', () => ({
  createEmailVerificationCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}));

vi.mock('../../email.service', () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordChangedNotification: vi.fn(),
  sendEmailChangedNotification: vi.fn(),
}));

vi.mock('../../utils/auth-helpers', () => ({
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
}));

const mockRequest = (body: any = {}, user?: any) => ({
  body,
  user,
  headers: {},
  ip: '127.0.0.1',
} as unknown as Request);

const mockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

describe('Email Auth Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRedisClient).mockResolvedValue(null);
  });

  describe('sendEmailCode', () => {
    it('should reject invalid email format', async () => {
      const req = mockRequest({ email: 'invalid-email', type: 'register' });
      const res = mockResponse();

      await sendEmailCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: '邮箱格式无效',
        })
      );
    });

    it('should reject invalid verification type', async () => {
      const req = mockRequest({ email: 'test@example.com', type: 'invalid' });
      const res = mockResponse();

      await sendEmailCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: '验证码类型无效',
        })
      );
    });

    it('should reject already registered email for register type', async () => {
      vi.mocked(prisma.operator.findUnique).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password: 'hashed',
        role: 'doctor',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const req = mockRequest({ email: 'test@example.com', type: 'register' });
      const res = mockResponse();

      await sendEmailCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: '该邮箱已被注册',
        })
      );
    });

    it('should send verification code successfully', async () => {
      vi.mocked(prisma.operator.findUnique).mockResolvedValueOnce(null);
      vi.mocked(createEmailVerificationCode).mockResolvedValueOnce({
        success: true,
        code: '123456',
      });
      vi.mocked(sendVerificationEmail).mockResolvedValueOnce({ success: true });

      const req = mockRequest({ email: 'test@example.com', type: 'register' });
      const res = mockResponse();

      await sendEmailCode(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '验证码已发送到您的邮箱',
        })
      );
    });
  });

  describe('emailRegister', () => {
    it('should reject invalid email format', async () => {
      const req = mockRequest({ email: 'invalid', password: 'Password123', code: '123456' });
      const res = mockResponse();

      await emailRegister(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject short password', async () => {
      const req = mockRequest({ email: 'test@example.com', password: 'short', code: '123456' });
      const res = mockResponse();

      await emailRegister(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject invalid code format', async () => {
      const req = mockRequest({ email: 'test@example.com', password: 'Password123', code: '123' });
      const res = mockResponse();

      await emailRegister(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject invalid verification code', async () => {
      vi.mocked(verifyEmailCode).mockResolvedValueOnce({
        success: false,
        error: '验证码无效或已过期',
      });

      const req = mockRequest({ email: 'test@example.com', password: 'Password123', code: '123456' });
      const res = mockResponse();

      await emailRegister(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should register user successfully', async () => {
      vi.mocked(verifyEmailCode).mockResolvedValueOnce({ success: true });
      vi.mocked(prisma.operator.findUnique).mockResolvedValueOnce(null);
      vi.mocked(hashPassword).mockResolvedValueOnce('hashedpassword');
      vi.mocked(prisma.operator.create).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password: 'hashedpassword',
        name: 'test',
        role: 'doctor',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(signAccessToken).mockReturnValue('access_token');
      vi.mocked(signRefreshToken).mockReturnValue('refresh_token');

      const req = mockRequest({
        email: 'test@example.com',
        password: 'Password123',
        code: '123456',
        name: 'test',
      });
      const res = mockResponse();

      await emailRegister(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            operatorId: 1,
            email: 'test@example.com',
          }),
        })
      );
    });
  });

  describe('emailLogin', () => {
    it('should reject invalid email format', async () => {
      const req = mockRequest({ email: 'invalid', password: 'Password123' });
      const res = mockResponse();

      await emailLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject missing password', async () => {
      const req = mockRequest({ email: 'test@example.com', password: '' });
      const res = mockResponse();

      await emailLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject wrong credentials', async () => {
      vi.mocked(prisma.operator.findUnique).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'doctor',
      } as any);
      vi.mocked(comparePassword).mockResolvedValueOnce(false);

      const req = mockRequest({ email: 'test@example.com', password: 'wrongpassword' });
      const res = mockResponse();

      await emailLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should login successfully', async () => {
      vi.mocked(prisma.operator.findUnique).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password: 'hashedpassword',
        name: 'test',
        role: 'doctor',
      } as any);
      vi.mocked(comparePassword).mockResolvedValueOnce(true);
      vi.mocked(signAccessToken).mockReturnValue('access_token');
      vi.mocked(signRefreshToken).mockReturnValue('refresh_token');

      const req = mockRequest({ email: 'test@example.com', password: 'Password123' });
      const res = mockResponse();

      await emailLogin(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            operatorId: 1,
            email: 'test@example.com',
          }),
        })
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      vi.mocked(verifyEmailCode).mockResolvedValueOnce({ success: true });
      vi.mocked(prisma.operator.findUnique).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password: 'oldhashed',
      } as any);
      vi.mocked(hashPassword).mockResolvedValueOnce('newhashed');
      vi.mocked(prisma.operator.update).mockResolvedValueOnce({} as any);
      vi.mocked(sendPasswordChangedNotification).mockResolvedValueOnce({ success: true });

      const req = mockRequest({
        email: 'test@example.com',
        code: '123456',
        newPassword: 'NewPassword123',
      });
      const res = mockResponse();

      await resetPassword(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '密码重置成功，请使用新密码登录',
        })
      );
    });
  });

  describe('changePassword', () => {
    it('should reject unauthenticated user', async () => {
      const req = mockRequest({ oldPassword: 'old', newPassword: 'NewPassword123' });
      const res = mockResponse();

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should change password successfully', async () => {
      vi.mocked(prisma.operator.findUnique).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password: 'oldhashed',
      } as any);
      vi.mocked(comparePassword).mockResolvedValueOnce(true);
      vi.mocked(hashPassword).mockResolvedValueOnce('newhashed');
      vi.mocked(prisma.operator.update).mockResolvedValueOnce({} as any);
      vi.mocked(sendPasswordChangedNotification).mockResolvedValueOnce({ success: true });

      const req = mockRequest(
        { oldPassword: 'OldPassword123', newPassword: 'NewPassword123' },
        { operatorId: 1 }
      );
      const res = mockResponse();

      await changePassword(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '密码修改成功',
        })
      );
    });
  });

  describe('emailMe', () => {
    it('should reject unauthenticated user', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await emailMe(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return user info', async () => {
      vi.mocked(prisma.operator.findUnique).mockResolvedValueOnce({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        role: 'doctor',
        emailVerified: true,
        createdAt: new Date(),
      } as any);

      const req = mockRequest({}, { operatorId: 1 });
      const res = mockResponse();

      await emailMe(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            operatorId: 1,
            email: 'test@example.com',
          }),
        })
      );
    });
  });
});
