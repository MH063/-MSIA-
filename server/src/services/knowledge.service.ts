import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import { cache } from '../utils/cache';
import { secureLogger } from '../utils/secureLogger';

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
 * 获取所有症状知识库列表（带缓存）
 */
export const getAllKnowledge = async (): Promise<Prisma.SymptomKnowledgeGetPayload<object>[]> => {
  // 尝试从缓存获取
  const cached = await cache.get<Prisma.SymptomKnowledgeGetPayload<object>[]>('knowledge:all');
  if (cached) {
    secureLogger.debug('[KnowledgeService] 从缓存获取所有知识库');
    return cached;
  }

  // 从数据库获取
  const knowledge = await prisma.symptomKnowledge.findMany();

  // 存入缓存（10分钟）
  await cache.set('knowledge:all', knowledge, { ttl: 600, tags: ['knowledge'] });

  return knowledge;
};

/**
 * 获取增量知识库（按更新时间）
 */
export const getKnowledgeSince = async (since: Date): Promise<Prisma.SymptomKnowledgeGetPayload<object>[]> => {
  return await prisma.symptomKnowledge.findMany({
    where: { updatedAt: { gt: since } },
  });
};

/**
 * 症状 key 别名映射
 * 用于将拆分后的症状 key 映射到统一的知识库
 */
const SYMPTOM_KEY_ALIASES: Record<string, string> = {
  'oliguria': 'oliguria_anuria_polyuria',
  'anuria': 'oliguria_anuria_polyuria',
  'polyuria': 'oliguria_anuria_polyuria',
};

/**
 * 根据 Key 或 DisplayName 获取症状知识（带缓存）
 * 支持通过 symptomKey、displayName 或模糊匹配查询
 */
export const getKnowledgeByKey = async (key: string): Promise<Prisma.SymptomKnowledgeGetPayload<object> | null> => {
  const cacheKey = `knowledge:key:${key}`;

  // 尝试从缓存获取
  const cached = await cache.get<Prisma.SymptomKnowledgeGetPayload<object>>(cacheKey);
  if (cached) {
    secureLogger.debug('[KnowledgeService] 从缓存获取知识库', { key });
    return cached;
  }

  // 检查是否有别名映射
  const actualKey = SYMPTOM_KEY_ALIASES[key] || key;

  // 首先尝试通过 symptomKey 查询
  let knowledge = await prisma.symptomKnowledge.findUnique({
    where: { symptomKey: actualKey },
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

  // 存入缓存（30分钟）
  if (knowledge) {
    await cache.set(cacheKey, knowledge, { ttl: 1800, tags: ['knowledge'] });
  }

  return knowledge;
};

/**
 * 创建或更新症状知识（清除相关缓存）
 */
export const upsertKnowledge = async (data: SymptomKnowledgeData): Promise<Prisma.SymptomKnowledgeGetPayload<object>> => {
  const result = await prisma.symptomKnowledge.upsert({
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

  // 清除相关缓存（测试环境跳过）
  if (process.env.NODE_ENV !== 'test') {
    await cache.delete(`knowledge:key:${data.symptomKey}`);
    await cache.deleteByTag('knowledge');
    secureLogger.debug('[KnowledgeService] 清除知识库缓存', { key: data.symptomKey });
  }

  return result;
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
export const getRecentKnowledge = async (take: number = 3): Promise<Pick<Prisma.SymptomKnowledgeGetPayload<object>, 'id' | 'displayName' | 'symptomKey'>[]> => {
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

/**
 * 获取症状映射列表（带缓存）
 */
export const getSymptomMappings = async () => {
  const cacheKey = 'knowledge:mappings';

  // 尝试从缓存获取
  const cached = await cache.get<Prisma.SymptomKnowledgeGetPayload<{ select: { symptomKey: true; displayName: true; category: true; description: true; redFlags: true; associatedSymptoms: true; questions: true } }>[]>(cacheKey);
  if (cached) {
    secureLogger.debug('[KnowledgeService] 从缓存获取症状映射');
    return cached;
  }

  const mappings = await prisma.symptomKnowledge.findMany({
    select: {
      symptomKey: true,
      displayName: true,
      category: true,
      description: true,
      redFlags: true,
      associatedSymptoms: true,
      questions: true,
    }
  });

  // 存入缓存（30分钟）
  await cache.set(cacheKey, mappings, { ttl: 1800, tags: ['knowledge'] });

  return mappings;
};

/**
 * 根据症状名称获取映射
 */
export const getSymptomMappingByName = async (name: string): Promise<Prisma.SymptomKnowledgeGetPayload<object> | null> => {
  return await getKnowledgeByKey(name);
};

/**
 * 获取疾病列表
 */
export const getDiseases = async (): Promise<Prisma.SymptomKnowledgeGetPayload<object>[]> => {
  return await prisma.symptomKnowledge.findMany({
    where: { category: 'disease' }
  });
};

/**
 * 根据疾病名称获取详情
 */
export const getDiseaseByName = async (name: string): Promise<Prisma.SymptomKnowledgeGetPayload<object> | null> => {
  return await getKnowledgeByKey(name);
};
