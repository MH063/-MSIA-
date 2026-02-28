import { z } from 'zod';

/**
 * 邮箱认证相关验证模式
 */
export const EmailAuthSchemas = {
  sendCode: z.object({
    email: z.string().email('邮箱格式无效').max(100, '邮箱过长'),
    type: z.enum(['register', 'reset_password', 'change_email']).default('register'),
  }),

  register: z.object({
    email: z.string().email('邮箱格式无效').max(100, '邮箱过长'),
    password: z
      .string()
      .min(8, '密码至少8个字符')
      .max(100, '密码过长')
      .refine((v) => /[A-Za-z]/u.test(v) && /\d/u.test(v), '密码需包含字母和数字'),
    name: z.string().max(100, '姓名过长').optional(),
    code: z.string().length(6, '验证码必须是6位数字').regex(/^\d{6}$/, '验证码必须是6位数字'),
    role: z.enum(['admin', 'doctor']).default('doctor'),
  }),

  login: z.object({
    email: z.string().email('邮箱格式无效').max(100, '邮箱过长'),
    password: z.string().min(1, '请输入密码').max(100, '密码过长'),
  }),

  resetPassword: z.object({
    email: z.string().email('邮箱格式无效').max(100, '邮箱过长'),
    code: z.string().length(6, '验证码必须是6位数字').regex(/^\d{6}$/, '验证码必须是6位数字'),
    newPassword: z
      .string()
      .min(8, '密码至少8个字符')
      .max(100, '密码过长')
      .refine((v) => /[A-Za-z]/u.test(v) && /\d/u.test(v), '密码需包含字母和数字'),
  }),

  changePassword: z.object({
    oldPassword: z.string().min(1, '请输入当前密码').max(100, '密码过长'),
    newPassword: z
      .string()
      .min(8, '密码至少8个字符')
      .max(100, '密码过长')
      .refine((v) => /[A-Za-z]/u.test(v) && /\d/u.test(v), '密码需包含字母和数字'),
  }),

  changeEmail: z.object({
    newEmail: z.string().email('邮箱格式无效').max(100, '邮箱过长'),
    code: z.string().length(6, '验证码必须是6位数字').regex(/^\d{6}$/, '验证码必须是6位数字'),
  }),
};
