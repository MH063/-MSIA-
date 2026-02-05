import { z } from 'zod';

/**
 * 患者相关验证模式
 */
export const PatientSchemas = {
  // 创建患者
  create: z.object({
    name: z.string().min(1, '姓名不能为空').max(50, '姓名过长'),
    gender: z.string().max(10),
    birthDate: z.string().optional(),
    ethnicity: z.string().max(50).optional(),
    nativePlace: z.string().max(100).optional(),
    occupation: z.string().max(50).optional(),
    address: z.string().max(200).optional(),
    phone: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().max(30).optional()
    ),
    contactInfo: z
      .object({
        phone: z.preprocess(
          (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
          z.string().max(30).optional()
        ),
      })
      .optional(),
  }),

  // 更新患者
  update: z.object({
    name: z.string().min(1).max(50).optional(),
    gender: z.string().max(10).optional(),
    birthDate: z.string().datetime().optional(),
    ethnicity: z.string().max(50).optional(),
    nativePlace: z.string().max(100).optional(),
    occupation: z.string().max(50).optional(),
    address: z.string().max(200).optional(),
    phone: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().max(30).optional()
    ),
    contactInfo: z
      .object({
        phone: z.preprocess(
          (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
          z.string().max(30).optional()
        ),
      })
      .optional(),
  }),

  // 查询参数
  query: z.object({
    page: z.string().regex(/^\d+$/, '页码必须是数字').optional(),
    limit: z.string().regex(/^\d+$/, '每页数量必须是数字').optional(),
    search: z.string().max(100).optional(),
  }),
};

/**
 * 会话相关验证模式
 */
export const SessionSchemas = {
  // 创建会话
  create: z.object({
    patientId: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
      z.number().int().positive('患者ID必须是正整数')
    ),
    historian: z.string().max(50).optional(),
    reliability: z.string().max(50).optional(),
    historianRelationship: z.string().max(50).optional(),
  }),

  // 更新会话
  update: z
    .object({
    // patient fields
    name: z.string().max(50).optional(),
    gender: z.string().max(10).optional(),
    birthDate: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : v),
      z.string().optional()
    ),
    ethnicity: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : v),
      z.string().max(50).optional()
    ),
    nativePlace: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : v),
      z.string().max(100).optional()
    ),
    placeOfBirth: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : v),
      z.string().max(100).optional()
    ),
    address: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.string().max(200).optional()
    ),
    occupation: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : v),
      z.string().max(50).optional()
    ),
    employer: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : v),
      z.string().max(100).optional()
    ),
    phone: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().max(30).optional()
    ),

    // session fields
    historian: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : v),
      z.string().max(50).optional()
    ),
    reliability: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : v),
      z.string().max(50).optional()
    ),
    historianRelationship: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : v),
      z.string().max(50).optional()
    ),
    generalInfo: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    status: z.preprocess(
      (v) => (v === null || v === undefined || v === '' ? undefined : v),
      z.string().max(50).optional()
    ),

    chiefComplaint: z
      .object({
        text: z.string().max(500, '主诉文本过长').optional(),
        symptom: z.string().max(100).optional(),
        durationNum: z.preprocess(
          (v) => {
            if (v === null || v === undefined) return undefined;
            if (typeof v === 'string') {
              const t = v.trim();
              if (!t) return undefined;
              const n = Number(t);
              return Number.isFinite(n) ? n : v;
            }
            return v;
          },
          z.number().min(0).optional()
        ),
        durationNumMax: z.preprocess(
          (v) => {
            if (v === null || v === undefined) return undefined;
            if (typeof v === 'string') {
              const t = v.trim();
              if (!t) return undefined;
              const n = Number(t);
              return Number.isFinite(n) ? n : v;
            }
            return v;
          },
          z.number().min(0).optional()
        ),
        durationUnit: z.preprocess(
          (v) => {
            if (v === null || v === undefined) return undefined;
            if (typeof v === 'string') {
              const t = v.trim();
              return t ? t : undefined;
            }
            return v;
          },
          z.string().max(10).optional()
        ),
        durationRaw: z.preprocess(
          (v) => {
            if (v === null || v === undefined) return undefined;
            if (typeof v === 'string') {
              const t = v.trim();
              return t ? t : undefined;
            }
            return v;
          },
          z.string().max(50).optional()
        ),
      })
      .optional(),
    presentIllness: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    pastHistory: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    personalHistory: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    maritalHistory: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    menstrualHistory: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    fertilityHistory: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    familyHistory: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    reviewOfSystems: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    physicalExam: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    specialistExam: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    auxiliaryExams: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),

    specialist: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
    auxiliaryExam: z.preprocess(
      (v) => (v === null || v === undefined ? undefined : v),
      z.record(z.string(), z.any()).optional()
    ),
  })
    .passthrough(),

  // 路由参数
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID必须是数字'),
  }),
};

export const AuthSchemas = {
  login: z.object({
    token: z.string().max(200).optional(),
    username: z.string().max(50).optional(),
    password: z.string().max(100).optional(),
  }).refine((data) => !!data.token || (!!data.username && !!data.password), {
    message: "请提供Token或用户名密码",
  }),

  register: z.object({
    username: z.string().min(3, '用户名至少3个字符').max(50, '用户名过长'),
    password: z
      .string()
      .min(8, '密码至少8个字符')
      .max(100, '密码过长')
      .refine((v) => /[A-Za-z]/u.test(v) && /\d/u.test(v), '密码需包含字母和数字'),
    name: z.string().max(100).optional(),
    role: z.enum(['admin', 'doctor']).default('doctor'),
  }),
};

/**
 * 诊断相关验证模式
 */
export const DiagnosisSchemas = {
  // 诊断建议请求
  suggest: z.object({
    sessionId: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
      z.number().int().positive('会话ID必须是正整数')
    ),
    symptoms: z.array(z.string()).min(1, '至少需要一个症状'),
    gender: z.string().max(10).optional(),
    age: z.number().int().min(0).max(150).optional(),
  }),

  // 增强诊断建议请求
  enhancedSuggest: z.object({
    sessionId: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
      z.number().int().positive('会话ID必须是正整数')
    ),
    currentSymptom: z.string().min(1, '当前症状不能为空'),
    associatedSymptoms: z.array(z.string()).default([]),
    redFlags: z.array(z.string()).default([]),
    age: z.number().int().min(0).max(150).optional(),
    gender: z.string().max(10).optional(),
  }),
};

/**
 * 知识库相关验证模式
 */
export const KnowledgeSchemas = {
  // 创建/更新知识
  upsert: z.object({
    symptomKey: z.string().min(1, '症状键不能为空').max(50),
    displayName: z.string().min(1, '显示名称不能为空').max(100),
    requiredQuestions: z.array(z.string()).default([]),
    associatedSymptoms: z.array(z.string()).optional(),
    redFlags: z.array(z.string()).optional(),
    physicalSigns: z.array(z.string()).optional(),
    category: z.string().max(50).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
  }),

  // 批量删除
  bulkDelete: z.object({
    keys: z.array(z.string()).min(1, '至少需要一个键'),
  }),

  // 查询参数
  query: z.object({
    category: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    since: z.string().datetime().optional(),
  }),
};

/**
 * 通用ID参数验证
 */
export const IdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID必须是数字'),
});

/**
 * 分页查询验证
 */
export const PaginationSchema = z.object({
  page: z.string().regex(/^\d+$/).default('1'),
  limit: z.string().regex(/^\d+$/).default('20'),
});
