import prisma from '../prisma';
import { Prisma } from '@prisma/client';

// 症状知识库数据类型
export interface SymptomKnowledgeData {
  symptomKey: string;
  displayName: string;
  requiredQuestions?: Prisma.InputJsonValue;
  associatedSymptoms?: Prisma.InputJsonValue;
  redFlags?: Prisma.InputJsonValue;
  physicalSigns?: Prisma.InputJsonValue;
  category?: string;
  priority?: number;
  questions?: Prisma.InputJsonValue;
  physicalExamination?: Prisma.InputJsonValue;
  differentialPoints?: Prisma.InputJsonValue;
  description?: string;
  commonCauses?: Prisma.InputJsonValue;
  onsetPatterns?: Prisma.InputJsonValue;
  severityScale?: Prisma.InputJsonValue;
  relatedExams?: Prisma.InputJsonValue;
  imageUrl?: string;
  bodySystems?: Prisma.InputJsonValue;
  ageGroups?: Prisma.InputJsonValue;
  prevalence?: string;
}

// 删除结果类型
export interface DeleteResult {
  deleted: number;
  key: string;
}

/**
 * 获取所有症状知识库列表
 */
export const getAllKnowledge = async (): Promise<Prisma.SymptomKnowledgeGetPayload<{}>[]> => {
  return await prisma.symptomKnowledge.findMany();
};

/**
 * 获取增量知识库（按更新时间）
 */
export const getKnowledgeSince = async (since: Date): Promise<Prisma.SymptomKnowledgeGetPayload<{}>[]> => {
  return await prisma.symptomKnowledge.findMany({
    where: { updatedAt: { gt: since } },
  });
};

/**
 * 根据 Key 或 DisplayName 获取症状知识
 * 支持通过 symptomKey、displayName 或模糊匹配查询
 */
export const getKnowledgeByKey = async (key: string): Promise<Prisma.SymptomKnowledgeGetPayload<{}> | null> => {
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
export const upsertKnowledge = async (data: SymptomKnowledgeData): Promise<Prisma.SymptomKnowledgeGetPayload<{}>> => {
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
      priority: data.priority as string | undefined,
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
      requiredQuestions: data.requiredQuestions || [],
      associatedSymptoms: data.associatedSymptoms,
      redFlags: data.redFlags,
      physicalSigns: data.physicalSigns,
      // 基础扩展字段
      category: data.category,
      priority: data.priority as string | undefined,
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
export const countKnowledge = async (): Promise<number> => {
  return await prisma.symptomKnowledge.count();
};

/**
 * 获取最近更新的知识库条目
 */
export const getRecentKnowledge = async (take: number = 3): Promise<Pick<Prisma.SymptomKnowledgeGetPayload<{}>, 'id' | 'displayName' | 'symptomKey'>[]> => {
  return await prisma.symptomKnowledge.findMany({
    take,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, displayName: true, symptomKey: true }
  });
};

/**
 * 删除单个症状知识
 */
export const deleteKnowledgeByKey = async (key: string): Promise<DeleteResult> => {
  try {
    const result = await prisma.symptomKnowledge.delete({
      where: { symptomKey: key }
    });
    return { deleted: 1, key: result.symptomKey };
  } catch (error: unknown) {
    // Prisma P2025: Record not found
    const prismaError = error as { code?: string };
    if (prismaError?.code === 'P2025') {
      return { deleted: 0, key };
    }
    throw error;
  }
};

/**
 * 批量删除症状知识
 */
export const deleteKnowledgeBulk = async (keys: string[]): Promise<number> => {
  const result = await prisma.symptomKnowledge.deleteMany({
    where: { symptomKey: { in: keys } }
  });
  return result.count;
};
