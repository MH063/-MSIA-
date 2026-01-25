import prisma from '../prisma';

/**
 * 获取所有症状知识库列表
 */
export const getAllKnowledge = async () => {
  return await prisma.symptomKnowledge.findMany();
};

/**
 * 根据 Key 获取症状知识
 */
export const getKnowledgeByKey = async (key: string) => {
  return await prisma.symptomKnowledge.findUnique({
    where: { symptomKey: key },
  });
};

/**
 * 创建或更新症状知识
 */
export const upsertKnowledge = async (data: any) => {
  return await prisma.symptomKnowledge.upsert({
    where: { symptomKey: data.symptomKey },
    update: {
      displayName: data.displayName,
      requiredQuestions: data.requiredQuestions,
      associatedSymptoms: data.associatedSymptoms,
      redFlags: data.redFlags,
      physicalSigns: data.physicalSigns,
      version: { increment: 1 }
    },
    create: {
      symptomKey: data.symptomKey,
      displayName: data.displayName,
      requiredQuestions: data.requiredQuestions,
      associatedSymptoms: data.associatedSymptoms,
      redFlags: data.redFlags,
      physicalSigns: data.physicalSigns
    },
  });
};

/**
 * 统计知识库条目数量
 */
export const countKnowledge = async () => {
  return await prisma.symptomKnowledge.count();
};

/**
 * 获取最近更新的知识库条目
 */
export const getRecentKnowledge = async (take: number = 3) => {
  return await prisma.symptomKnowledge.findMany({
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, displayName: true, symptomKey: true }
  });
};

/**
 * 删除单个症状知识
 */
export const deleteKnowledgeByKey = async (key: string) => {
  try {
    const result = await prisma.symptomKnowledge.delete({
      where: { symptomKey: key }
    });
    return { deleted: 1, key: result.symptomKey };
  } catch (error: any) {
    // Prisma P2025: Record not found
    if (error?.code === 'P2025') {
      return { deleted: 0, key };
    }
    throw error;
  }
};

/**
 * 批量删除症状知识
 */
export const deleteKnowledgeBulk = async (keys: string[]) => {
  const result = await prisma.symptomKnowledge.deleteMany({
    where: { symptomKey: { in: keys } }
  });
  return result.count;
};
