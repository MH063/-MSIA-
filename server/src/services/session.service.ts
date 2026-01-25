import prisma from '../prisma';

/**
 * 创建问诊会话
 */
export const createSession = async (patientId: number, additionalData: any = {}) => {
  return await prisma.interviewSession.create({
    data: {
      patientId,
      status: 'draft',
      generalInfo: {},
      chiefComplaint: {},
      presentIllness: {},
      ...additionalData
    },
  });
};

/**
 * 获取会话详情
 */
export const getSessionById = async (id: number) => {
  return await prisma.interviewSession.findUnique({
    where: { id },
    include: { patient: true },
  });
};

/**
 * 更新会话数据 (通用)
 */
export const updateSession = async (id: number, data: any) => {
  return await prisma.interviewSession.update({
    where: { id },
    data,
  });
};

/**
 * 获取会话列表
 */
export const getSessions = async (params: {
  take?: number;
  skip?: number;
  where?: any;
  orderBy?: any;
}) => {
  return await prisma.interviewSession.findMany({
    take: params.take,
    skip: params.skip,
    where: params.where,
    orderBy: params.orderBy || { createdAt: 'desc' },
    include: { patient: true },
  });
};

/**
 * 统计会话数量
 */
export const countSessions = async (where?: any) => {
  return await prisma.interviewSession.count({ where });
};

/**
 * 删除会话
 */
export const deleteSession = async (id: number) => {
  return await prisma.interviewSession.delete({
    where: { id },
  });
};

/**
 * 批量删除会话
 */
export const deleteSessionsBulk = async (ids: number[]) => {
  return await prisma.interviewSession.deleteMany({
    where: { id: { in: ids } },
  });
};
