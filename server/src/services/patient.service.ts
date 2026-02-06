import prisma from '../prisma';
import { Prisma } from '@prisma/client';

// 患者数据类型
export interface PatientData {
  name: string;
  gender: string;
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
 * 获取所有患者
 */
export const getAllPatients = async (): Promise<Prisma.PatientGetPayload<{}>[]> => {
  return await prisma.patient.findMany();
};

/**
 * 创建新患者
 * @param data 患者数据
 */
export const createPatient = async (data: PatientData): Promise<Prisma.PatientGetPayload<{}>> => {
  return await prisma.patient.create({
    data: {
        name: data.name,
        gender: data.gender,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        nativePlace: data.nativePlace,
        placeOfBirth: data.placeOfBirth,
        ethnicity: data.ethnicity,
        address: data.address,
        occupation: data.occupation,
        employer: data.employer,
        contactInfo: data.contactInfo
    },
  });
};
