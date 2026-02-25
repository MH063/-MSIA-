import { Request, Response } from 'express';
import { secureLogger } from '../utils/secureLogger';
import prisma from '../prisma';

/**
 * 简化症状名称映射表
 * 用于将组合症状名称拆分为简化形式，便于前端系统回顾组件使用
 * 注意：仅用于现有数据库症状的简化映射，不添加新症状
 */
const simplifiedSymptomMapping: Record<string, { key: string; names: string[] }> = {
  'cough_and_expectoration': { key: 'cough_and_expectoration', names: ['咳嗽', '咳痰'] },
  'nausea_vomiting': { key: 'nausea_vomiting', names: ['恶心', '呕吐'] },
  'urinary_frequency_urgency_dysuria': { key: 'urinary_frequency_urgency_dysuria', names: ['尿频', '尿急', '尿痛'] },
  'dysuria_urinary_retention': { key: 'dysuria_urinary_retention', names: ['排尿困难'] },
  'tic_convulsion': { key: 'tic_convulsion', names: ['抽搐'] },
  'vertigo': { key: 'vertigo', names: ['头晕', '眩晕'] },
  'oliguria_anuria_polyuria': { key: 'oliguria_anuria_polyuria', names: ['多尿', '少尿', '无尿'] },
  'cutaneous_mucosal_hemorrhage': { key: 'cutaneous_mucosal_hemorrhage', names: ['皮肤出血点', '瘀斑', '牙龈出血', '鼻出血'] },
  'emaciation': { key: 'emaciation', names: ['消瘦'] },
  'lumbodorsalgia': { key: 'lumbodorsalgia', names: ['腰痛', '腰背痛'] },
};

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

      // 添加简化症状名称映射
      const simplified = simplifiedSymptomMapping[symptom.symptomKey];
      if (simplified) {
        for (const simpleName of simplified.names) {
          nameToKey[simpleName] = symptom.symptomKey;
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
