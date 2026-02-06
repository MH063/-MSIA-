import prisma from '../prisma';

/**
 * 获取所有症状知识库列表
 */
export const getAllKnowledge = async () => {
  return await prisma.symptomKnowledge.findMany();
};

/**
 * 获取增量知识库（按更新时间）
 */
export const getKnowledgeSince = async (since: Date) => {
  return await prisma.symptomKnowledge.findMany({
    where: { updatedAt: { gt: since } },
  });
};

/**
 * 根据 Key 或 DisplayName 获取症状知识
 * 支持通过 symptomKey、displayName 或模糊匹配查询
 */
export const getKnowledgeByKey = async (key: string) => {
  // 首先尝试通过 symptomKey 查询
  let knowledge = await prisma.symptomKnowledge.findUnique({
    where: { symptomKey: key },
  });

  // 如果没找到，尝试通过 displayName 精确查询
  if (!knowledge) {
    knowledge = await prisma.symptomKnowledge.findFirst({
      where: { displayName: key },
    });
  }

  // 如果还没找到，尝试通过 displayName 模糊查询（包含该症状名）
  if (!knowledge) {
    knowledge = await prisma.symptomKnowledge.findFirst({
      where: {
        displayName: {
          contains: key,
        },
      },
    });
  }

  return knowledge;
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
      // 基础扩展字段
      category: data.category,
      priority: data.priority,
      questions: data.questions,
      physicalExamination: data.physicalExamination,
      differentialPoints: data.differentialPoints,
      // 扩展字段
      description: data.description,
      commonCauses: data.commonCauses,
      onsetPatterns: data.onsetPatterns,
      severityScale: data.severityScale,
      relatedExams: data.relatedExams,
      imageUrl: data.imageUrl,
      bodySystems: data.bodySystems,
      ageGroups: data.ageGroups,
      prevalence: data.prevalence,
      version: { increment: 1 }
    },
    create: {
      symptomKey: data.symptomKey,
      displayName: data.displayName,
      requiredQuestions: data.requiredQuestions,
      associatedSymptoms: data.associatedSymptoms,
      redFlags: data.redFlags,
      physicalSigns: data.physicalSigns,
      // 基础扩展字段
      category: data.category,
      priority: data.priority,
      questions: data.questions,
      physicalExamination: data.physicalExamination,
      differentialPoints: data.differentialPoints,
      // 扩展字段
      description: data.description,
      commonCauses: data.commonCauses,
      onsetPatterns: data.onsetPatterns,
      severityScale: data.severityScale,
      relatedExams: data.relatedExams,
      imageUrl: data.imageUrl,
      bodySystems: data.bodySystems,
      ageGroups: data.ageGroups,
      prevalence: data.prevalence,
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
