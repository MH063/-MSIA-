import prisma from '../prisma';

/**
 * 获取所有患者
 */
export const getAllPatients = async () => {
  return await prisma.patient.findMany();
};

/**
 * 创建新患者
 * @param data 患者数据
 */
export const createPatient = async (data: any) => {
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
