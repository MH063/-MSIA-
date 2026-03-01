/**
 * 加密问诊会话服务
 * 处理问诊会话敏感数据的加密存储
 */

import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import { 
  validateEncryptedFields, 
  getEncryptionSummary,
  SensitiveField,
  maskEncryptedObject,
} from '../utils/cryptoService';
import { secureLogger } from '../utils/secureLogger';

/**
 * 会话敏感字段配置
 */
const SESSION_SENSITIVE_FIELDS: readonly SensitiveField[] = [
  'chiefComplaint',
  'presentIllness',
  'pastHistory',
  'personalHistory',
  'familyHistory',
  'physicalExamination',
  'diagnosisResult',
  'treatmentPlan',
  'prescription',
  'notes',
] as const;

/**
 * 会话创建数据
 */
export interface SessionCreateData {
  patientId: number;
  doctorId?: number;
  status?: string;
  historian?: string;
  reliability?: string;
  historianRelationship?: string;
  generalInfo?: Prisma.InputJsonValue;
  chiefComplaint?: Prisma.InputJsonValue;
  presentIllness?: Prisma.InputJsonValue;
  pastHistory?: Prisma.InputJsonValue;
  personalHistory?: Prisma.InputJsonValue;
  maritalHistory?: Prisma.InputJsonValue;
  menstrualHistory?: Prisma.InputJsonValue;
  fertilityHistory?: Prisma.InputJsonValue;
  familyHistory?: Prisma.InputJsonValue;
  physicalExam?: Prisma.InputJsonValue;
  specialistExam?: Prisma.InputJsonValue;
  auxiliaryExams?: Prisma.InputJsonValue;
  reviewOfSystems?: Prisma.InputJsonValue;
}

/**
 * 验证JSON字段中的敏感数据是否已加密
 */
function validateJsonEncryption(
  data: Prisma.InputJsonValue | undefined,
  fieldPath: string
): { encrypted: boolean; unencryptedKeys: string[] } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { encrypted: true, unencryptedKeys: [] };
  }

  const unencryptedKeys: string[] = [];
  const obj = data as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.length > 0) {
      if (SESSION_SENSITIVE_FIELDS.includes(key as SensitiveField)) {
        if (!value.startsWith('enc:')) {
          unencryptedKeys.push(`${fieldPath}.${key}`);
        }
      }
    }
  }

  return {
    encrypted: unencryptedKeys.length === 0,
    unencryptedKeys,
  };
}

/**
 * 验证会话数据加密状态
 */
export function validateSessionEncryption(data: SessionCreateData): {
  valid: boolean;
  unencryptedFields: string[];
} {
  const unencryptedFields: string[] = [];

  const jsonFields = [
    'chiefComplaint',
    'presentIllness',
    'pastHistory',
    'personalHistory',
    'familyHistory',
    'physicalExam',
  ] as const;

  for (const field of jsonFields) {
    const value = data[field];
    if (value) {
      const result = validateJsonEncryption(value, field);
      unencryptedFields.push(...result.unencryptedKeys);
    }
  }

  return {
    valid: unencryptedFields.length === 0,
    unencryptedFields,
  };
}

/**
 * 创建问诊会话（加密数据）
 */
export const createSessionWithEncryption = async (
  data: SessionCreateData
): Promise<Prisma.InterviewSessionGetPayload<object>> => {
  const validation = validateSessionEncryption(data);

  if (!validation.valid) {
    secureLogger.warn('[SessionService] 创建会话时存在未加密的敏感字段', {
      patientId: data.patientId,
      unencryptedFields: validation.unencryptedFields,
    });
  }

  const session = await prisma.interviewSession.create({
    data: {
      patientId: data.patientId,
      doctorId: data.doctorId,
      status: data.status || 'draft',
      historian: data.historian,
      reliability: data.reliability,
      historianRelationship: data.historianRelationship,
      generalInfo: data.generalInfo,
      chiefComplaint: data.chiefComplaint,
      presentIllness: data.presentIllness,
      pastHistory: data.pastHistory,
      personalHistory: data.personalHistory,
      maritalHistory: data.maritalHistory,
      menstrualHistory: data.menstrualHistory,
      fertilityHistory: data.fertilityHistory,
      familyHistory: data.familyHistory,
      physicalExam: data.physicalExam,
      specialistExam: data.specialistExam,
      auxiliaryExams: data.auxiliaryExams,
      reviewOfSystems: data.reviewOfSystems,
    },
  });

  secureLogger.info('[SessionService] 会话创建成功', {
    sessionId: session.id,
    patientId: data.patientId,
    hasUnencryptedFields: !validation.valid,
  });

  return session;
};

/**
 * 更新问诊会话（加密数据）
 */
export const updateSessionWithEncryption = async (
  id: number,
  data: Partial<SessionCreateData>
): Promise<Prisma.InterviewSessionGetPayload<object>> => {
  const validation = validateSessionEncryption(data as SessionCreateData);

  if (!validation.valid) {
    secureLogger.warn('[SessionService] 更新会话时存在未加密的敏感字段', {
      sessionId: id,
      unencryptedFields: validation.unencryptedFields,
    });
  }

  const updateData: Prisma.InterviewSessionUpdateInput = {};

  if (data.patientId !== undefined) updateData.patient = { connect: { id: data.patientId } };
  if (data.doctorId !== undefined) updateData.doctorId = data.doctorId;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.historian !== undefined) updateData.historian = data.historian;
  if (data.reliability !== undefined) updateData.reliability = data.reliability;
  if (data.historianRelationship !== undefined) updateData.historianRelationship = data.historianRelationship;
  if (data.generalInfo !== undefined) updateData.generalInfo = data.generalInfo;
  if (data.chiefComplaint !== undefined) updateData.chiefComplaint = data.chiefComplaint;
  if (data.presentIllness !== undefined) updateData.presentIllness = data.presentIllness;
  if (data.pastHistory !== undefined) updateData.pastHistory = data.pastHistory;
  if (data.personalHistory !== undefined) updateData.personalHistory = data.personalHistory;
  if (data.maritalHistory !== undefined) updateData.maritalHistory = data.maritalHistory;
  if (data.menstrualHistory !== undefined) updateData.menstrualHistory = data.menstrualHistory;
  if (data.fertilityHistory !== undefined) updateData.fertilityHistory = data.fertilityHistory;
  if (data.familyHistory !== undefined) updateData.familyHistory = data.familyHistory;
  if (data.physicalExam !== undefined) updateData.physicalExam = data.physicalExam;
  if (data.specialistExam !== undefined) updateData.specialistExam = data.specialistExam;
  if (data.auxiliaryExams !== undefined) updateData.auxiliaryExams = data.auxiliaryExams;
  if (data.reviewOfSystems !== undefined) updateData.reviewOfSystems = data.reviewOfSystems;

  const session = await prisma.interviewSession.update({
    where: { id },
    data: updateData,
  });

  secureLogger.info('[SessionService] 会话更新成功', {
    sessionId: id,
    hasUnencryptedFields: !validation.valid,
  });

  return session;
};

/**
 * 获取所有会话
 */
export const getAllSessions = async (filters?: {
  patientId?: number;
  doctorId?: number;
  status?: string;
}): Promise<Prisma.InterviewSessionGetPayload<object>[]> => {
  const where: Prisma.InterviewSessionWhereInput = {};

  if (filters?.patientId) where.patientId = filters.patientId;
  if (filters?.doctorId) where.doctorId = filters.doctorId;
  if (filters?.status) where.status = filters.status;

  return await prisma.interviewSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      patient: true,
    },
  });
};

/**
 * 根据ID获取会话
 */
export const getSessionById = async (id: number): Promise<Prisma.InterviewSessionGetPayload<{
  include: { patient: true };
}> | null> => {
  return await prisma.interviewSession.findUnique({
    where: { id },
    include: {
      patient: true,
    },
  });
};

/**
 * 删除会话
 */
export const deleteSession = async (id: number): Promise<Prisma.InterviewSessionGetPayload<object>> => {
  return await prisma.interviewSession.delete({
    where: { id },
  });
};

/**
 * 批量删除会话
 */
export const deleteSessionsBulk = async (ids: number[]): Promise<Prisma.BatchPayload> => {
  return await prisma.interviewSession.deleteMany({
    where: {
      id: { in: ids },
    },
  });
};

/**
 * 获取会话统计
 */
export const getSessionStats = async (doctorId?: number): Promise<{
  total: number;
  byStatus: Record<string, number>;
}> => {
  const where: Prisma.InterviewSessionWhereInput = {};
  if (doctorId) where.doctorId = doctorId;

  const sessions = await prisma.interviewSession.findMany({
    where,
    select: { status: true },
  });

  const byStatus: Record<string, number> = {};
  for (const session of sessions) {
    byStatus[session.status] = (byStatus[session.status] || 0) + 1;
  }

  return {
    total: sessions.length,
    byStatus,
  };
};

/**
 * 脱敏会话数据（用于日志和调试）
 */
export function maskSessionData<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  return maskEncryptedObject(data, SESSION_SENSITIVE_FIELDS);
}

/**
 * 创建会话（兼容旧接口）
 */
export const createSession = async (
  patientId: number,
  data: Record<string, unknown>
): Promise<Prisma.InterviewSessionGetPayload<object>> => {
  return createSessionWithEncryption({
    patientId,
    ...data,
  } as SessionCreateData);
};

/**
 * 更新会话（兼容旧接口）
 */
export const updateSession = async (
  id: number,
  data: Record<string, unknown>
): Promise<Prisma.InterviewSessionGetPayload<object>> => {
  return updateSessionWithEncryption(id, data as Partial<SessionCreateData>);
};

/**
 * 获取会话列表（兼容旧接口）
 */
export const getSessions = async (options?: {
  patientId?: number;
  doctorId?: number;
  status?: string;
  take?: number;
  skip?: number;
  orderBy?: { createdAt: 'desc' | 'asc' };
  where?: Prisma.InterviewSessionWhereInput;
}): Promise<Prisma.InterviewSessionGetPayload<object>[]> => {
  const whereClause = options?.where || {};
  
  if (options?.patientId) whereClause.patientId = options.patientId;
  if (options?.doctorId) whereClause.doctorId = options.doctorId;
  if (options?.status) whereClause.status = options.status;

  return await prisma.interviewSession.findMany({
    where: whereClause,
    take: options?.take,
    skip: options?.skip,
    orderBy: options?.orderBy || { createdAt: 'desc' },
    include: {
      patient: true,
    },
  });
};

/**
 * 统计会话数量（兼容旧接口）
 */
export const countSessions = async (where?: Prisma.InterviewSessionWhereInput): Promise<number> => {
  return await prisma.interviewSession.count({ where });
};

/**
 * 永久删除会话（兼容旧接口）
 */
export const deleteSessionPermanently = async (params: {
  sessionId: number;
  operator?: { operatorId?: number; id?: number; role: string };
}): Promise<{ deletedId: number }> => {
  await prisma.interviewSession.delete({
    where: { id: params.sessionId },
  });
  return { deletedId: params.sessionId };
};

/**
 * 永久删除会话（Prisma版本，用于测试）
 */
export const deleteSessionPermanentlyWithPrisma = async (id: number): Promise<{ deletedId: number }> => {
  await prisma.interviewSession.delete({
    where: { id },
  });
  return { deletedId: id };
};
