import { Request, Response } from 'express';
import { secureLogger } from '../utils/secureLogger';
import prisma from '../prisma';

/**
 * 获取症状映射
 */
export const getSymptomMappings = async (_req: Request, res: Response) => {
  try {
    // 从症状知识库获取所有症状映射
    const symptoms = await prisma.symptomKnowledge.findMany({
      select: {
        symptomKey: true,
        displayName: true,
        category: true,
        description: true,
        associatedSymptoms: true,
        redFlags: true,
        requiredQuestions: true,
      }
    });

    // 构建症状名称到键值的映射
    const nameToKey: Record<string, string> = {};
    const synonyms: Record<string, string> = {};

    for (const symptom of symptoms) {
      // 主名称映射
      nameToKey[symptom.displayName] = symptom.symptomKey;
      
      // 如果有同义词，也加入映射
      const associated = symptom.associatedSymptoms as string[] | null;
      if (associated && Array.isArray(associated)) {
        for (const alias of associated) {
          synonyms[alias] = symptom.symptomKey;
        }
      }
    }

    res.json({
      success: true,
      data: {
        symptoms,
        nameToKey,
        synonyms,
        count: symptoms.length
      }
    });
  } catch (error) {
    secureLogger.error('[MappingController] 获取症状映射失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: '获取症状映射失败' });
  }
};
