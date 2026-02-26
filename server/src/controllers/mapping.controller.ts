import { Request, Response } from 'express';
import { secureLogger } from '../utils/secureLogger';
import prisma from '../prisma';

/**
 * 简化症状名称映射表
 * 用于将组合症状名称拆分为简化形式，便于前端系统回顾组件使用
 * 注意：仅用于现有数据库症状的简化映射，不添加新症状
 * 结构：{ [数据库symptomKey]: { key: 前端显示的独立key, names: [显示名称] } }
 */
const simplifiedSymptomMapping: Record<string, { key: string; names: string[] }> = {
  'cough_and_expectoration': { key: 'cough_and_expectoration', names: ['咳嗽', '咳痰'] },
  'nausea_vomiting': { key: 'nausea_vomiting', names: ['恶心', '呕吐'] },
  'urinary_frequency_urgency_dysuria': { key: 'urinary_frequency_urgency_dysuria', names: ['尿频', '尿急', '尿痛'] },
  'dysuria_urinary_retention': { key: 'dysuria_urinary_retention', names: ['排尿困难'] },
  'tic_convulsion': { key: 'tic_convulsion', names: ['抽搐'] },
  'vertigo': { key: 'vertigo', names: ['头晕', '眩晕'] },
  'cutaneous_mucosal_hemorrhage': { key: 'cutaneous_mucosal_hemorrhage', names: ['皮肤出血点', '瘀斑', '牙龈出血', '鼻出血'] },
  'emaciation': { key: 'emaciation', names: ['消瘦'] },
  'lumbodorsalgia': { key: 'lumbodorsalgia', names: ['腰痛', '腰背痛'] },
};

/**
 * 独立症状映射表
 * 用于将数据库中的组合症状拆分为多个独立症状
 * key: 独立症状的 key, value: 对应的数据库 symptomKey
 */
const independentSymptomMapping: Record<string, { dbKey: string; displayName: string }> = {
  'oliguria': { dbKey: 'oliguria_anuria_polyuria', displayName: '少尿' },
  'anuria': { dbKey: 'oliguria_anuria_polyuria', displayName: '无尿' },
  'polyuria': { dbKey: 'oliguria_anuria_polyuria', displayName: '多尿' },
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

    // 需要拆分的症状 key 集合
    const splitKeys = new Set(['oliguria_anuria_polyuria']);

    for (const symptom of symptoms) {
      // 检查是否需要拆分为独立症状
      if (splitKeys.has(symptom.symptomKey)) {
        // 对于 oliguria_anuria_polyuria，添加三个独立症状
        for (const [independentKey, mapping] of Object.entries(independentSymptomMapping)) {
          if (mapping.dbKey === symptom.symptomKey) {
            nameToKey[mapping.displayName] = independentKey;
          }
        }
      } else {
        // 主名称映射
        nameToKey[symptom.displayName] = symptom.symptomKey;
      }
      
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
