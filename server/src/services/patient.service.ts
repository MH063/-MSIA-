/**
 * 加密患者服务
 * 处理患者敏感数据的加密存储
 */

import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import { 
  validateEncryptedFields, 
  getEncryptionSummary,
  SENSITIVE_FIELDS as _SENSITIVE_FIELDS,
  SensitiveField 
} from '../utils/cryptoService';
import { secureLogger } from '../utils/secureLogger';

/**
 * 患者数据类型（支持加密字段）
 */
export interface PatientData {
  name: string;
  gender?: string;
  birthDate?: string | Date;
  nativePlace?: string;
  placeOfBirth?: string;
  ethnicity?: string;
  address?: string;
  occupation?: string;
  employer?: string;
  contactInfo?: Prisma.InputJsonValue;
}

/**
 * 患者数据类型（包含公钥）
 */
export interface PatientDataWithKey extends PatientData {
  publicKey?: string;
  keyFingerprint?: string;
}

/**
 * 患者敏感字段
 */
const PATIENT_SENSITIVE_FIELDS: readonly SensitiveField[] = [
  'name',
  'address',
] as const;

/**
 * 验证患者数据加密状态
 */
export function validatePatientEncryption(data: PatientData): {
  valid: boolean;
  summary: ReturnType<typeof getEncryptionSummary>;
  unencryptedFields: string[];
} {
  const recordData = data as unknown as Record<string, unknown>;
  const { valid, unencryptedFields } = validateEncryptedFields(recordData, PATIENT_SENSITIVE_FIELDS);
  const summary = getEncryptionSummary(recordData, PATIENT_SENSITIVE_FIELDS);

  return {
    valid,
    summary,
    unencryptedFields,
  };
}

/**
 * 创建新患者（加密数据）
 * @param data 患者数据（敏感字段应已加密）
 * @param publicKey 用户公钥
 */
export const createPatientWithEncryption = async (
  data: PatientDataWithKey
): Promise<Prisma.PatientGetPayload<object>> => {
  const { publicKey: _publicKey, keyFingerprint: _keyFingerprint, ...patientData } = data;

  const validation = validatePatientEncryption(patientData);
  
  if (!validation.valid && validation.summary.hasSensitiveData) {
    secureLogger.warn('[PatientService] 创建患者时存在未加密的敏感字段', {
      unencryptedFields: validation.unencryptedFields,
    });
  }

  const patient = await prisma.patient.create({
    data: {
      name: patientData.name,
      gender: patientData.gender,
      birthDate: patientData.birthDate ? new Date(patientData.birthDate) : undefined,
      nativePlace: patientData.nativePlace,
      placeOfBirth: patientData.placeOfBirth,
      ethnicity: patientData.ethnicity,
      address: patientData.address,
      occupation: patientData.occupation,
      employer: patientData.employer,
      contactInfo: patientData.contactInfo,
    },
  });

  secureLogger.info('[PatientService] 患者创建成功', {
    patientId: patient.id,
    encryptionStatus: validation.summary,
  });

  return patient;
};

/**
 * 更新患者信息（加密数据）
 */
export const updatePatientWithEncryption = async (
  id: number,
  data: Partial<PatientData>
): Promise<Prisma.PatientGetPayload<object>> => {
  const validation = validatePatientEncryption(data as PatientData);

  if (!validation.valid && validation.summary.hasSensitiveData) {
    secureLogger.warn('[PatientService] 更新患者时存在未加密的敏感字段', {
      patientId: id,
      unencryptedFields: validation.unencryptedFields,
    });
  }

  const updateData: Prisma.PatientUpdateInput = {};

  if (data.name !== undefined) {updateData.name = data.name;}
  if (data.gender !== undefined) {updateData.gender = data.gender;}
  if (data.birthDate !== undefined) {updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null;}
  if (data.nativePlace !== undefined) {updateData.nativePlace = data.nativePlace;}
  if (data.placeOfBirth !== undefined) {updateData.placeOfBirth = data.placeOfBirth;}
  if (data.ethnicity !== undefined) {updateData.ethnicity = data.ethnicity;}
  if (data.address !== undefined) {updateData.address = data.address;}
  if (data.occupation !== undefined) {updateData.occupation = data.occupation;}
  if (data.employer !== undefined) {updateData.employer = data.employer;}
  if (data.contactInfo !== undefined) {updateData.contactInfo = data.contactInfo;}

  const patient = await prisma.patient.update({
    where: { id },
    data: updateData,
  });

  secureLogger.info('[PatientService] 患者更新成功', {
    patientId: id,
    encryptionStatus: validation.summary,
  });

  return patient;
};

/**
 * 获取所有患者
 */
export const getAllPatients = async (): Promise<Prisma.PatientGetPayload<object>[]> => {
  return await prisma.patient.findMany({
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * 创建患者（兼容旧接口）
 */
export const createPatient = async (data: PatientData): Promise<Prisma.PatientGetPayload<object>> => {
  return createPatientWithEncryption(data);
};

/**
 * 根据ID获取患者
 */
export const getPatientById = async (id: number): Promise<Prisma.PatientGetPayload<object> | null> => {
  return await prisma.patient.findUnique({
    where: { id },
  });
};

/**
 * 删除患者
 */
export const deletePatient = async (id: number): Promise<Prisma.PatientGetPayload<object>> => {
  return await prisma.patient.delete({
    where: { id },
  });
};

/**
 * 搜索患者（注意：加密字段无法搜索）
 */
export const searchPatients = async (query: {
  gender?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<Prisma.PatientGetPayload<object>[]> => {
  const where: Prisma.PatientWhereInput = {};

  if (query.gender) {
    where.gender = query.gender;
  }

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) {where.createdAt.gte = query.startDate;}
    if (query.endDate) {where.createdAt.lte = query.endDate;}
  }

  return await prisma.patient.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
};
