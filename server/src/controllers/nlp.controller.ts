import { Request, Response } from 'express';
import prisma from '../prisma';

// 症状同义词映射表
const SYMPTOM_SYNONYMS: Record<string, string> = {
  "恶心与呕吐": "恶心呕吐",
  "呕吐伴恶心": "恶心呕吐",
  "恶心后呕吐": "恶心呕吐",
  "发烧": "发热",
  "体温升高": "发热",
  "高热": "发热",
  "眩晕": "眩晕",
  "头晕": "眩晕",
  "天旋地转": "眩晕",
  "痰中带血": "咯血",
  "吐血": "上消化道出血",
  "呕血": "上消化道出血",
  "黑色大便": "上消化道出血",
  "黑便": "上消化道出血",
  "柏油样便": "上消化道出血",
  "偏头痛": "头痛",
  "神经性头痛": "头痛"
};

/**
 * 解析主诉 (Mock NLP)
 * 根据关键词简单匹配症状
 */
export const analyzeComplaint = async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      res.status(400).json({ success: false, message: 'Text is required' });
      return;
    }

    let matchedSymptomKey = null;

    // 1. 优先匹配同义词
    for (const [synonym, standard] of Object.entries(SYMPTOM_SYNONYMS)) {
        if (text.includes(synonym)) {
             const nameToKey: Record<string, string> = {
                 "恶心呕吐": "nausea_vomiting", // 假设数据库中已有或将有此key，或者映射到 existing keys
                 "发热": "fever",
                 "眩晕": "vertigo",
                 "咯血": "hemoptysis",
                 "上消化道出血": "hematemesis",
                 "头痛": "headache"
             };
             
             if (nameToKey[standard]) {
                 matchedSymptomKey = nameToKey[standard];
                 break;
             }
        }
    }

    if (!matchedSymptomKey) {
        // 2. 原有的关键词匹配逻辑 (作为后备)
        // 简单的关键词匹配逻辑
        // 优先匹配明确症状词，避免“腹”类词优先导致误判
        if (text.includes('泻') || text.includes('腹泻') || text.includes('水样') || text.includes('稀便') || text.includes('里急后重')) {
      // 腹泻相关关键词匹配
      matchedSymptomKey = 'diarrhea';
    } else if (text.includes('腹') || text.includes('肚子') || text.includes('胃')) {
      matchedSymptomKey = 'abdominal_pain';
    } else if (text.includes('胸') || text.includes('心')) {
       // 胸痛和心悸的关键词重叠，需要更细致
       if (text.includes('悸') || text.includes('慌') || text.includes('跳')) {
           matchedSymptomKey = 'palpitations';
       } else {
           matchedSymptomKey = 'chest_pain';
       }
    } else if (text.includes('头痛') || text.includes('偏头痛')) {
      matchedSymptomKey = 'headache';
    } else if (text.includes('头晕') || text.includes('晕') || text.includes('天旋地转')) {
      matchedSymptomKey = 'dizziness';
    } else if (text.includes('热') || text.includes('烧') || text.includes('烫')) {
      matchedSymptomKey = 'fever';
    } else if (text.includes('咳') || text.includes('痰')) {
      matchedSymptomKey = 'cough';
    } else if (text.includes('喘') || text.includes('呼吸困难') || text.includes('气促') || text.includes('憋')) {
      matchedSymptomKey = 'dyspnea';
    } else if (text.includes('累') || text.includes('乏') || text.includes('疲') || text.includes('力')) {
      matchedSymptomKey = 'fatigue';
    } else if (text.includes('睡') || text.includes('眠') || text.includes('醒')) {
      matchedSymptomKey = 'insomnia';
    } else if (text.includes('吐') || text.includes('恶心') || text.includes('呕吐') || text.includes('恶心呕吐')) {
       // 如果同时包含腹痛，优先腹痛，这里简单处理，如果没匹配到其他的才匹配呕吐
       // 实际逻辑应该更复杂，这里仅作演示
       if (!matchedSymptomKey) matchedSymptomKey = 'vomiting';
    }
    }

    if (matchedSymptomKey) {
      // 获取症状详情
      const symptom = await prisma.symptomKnowledge.findUnique({
        where: { symptomKey: matchedSymptomKey },
      });
      console.log('[NLP] 解析主诉匹配到症状', { text, matchedSymptomKey, displayName: symptom?.displayName });
      
      res.json({
        success: true,
        data: {
          matched: true,
          symptomKey: matchedSymptomKey,
          symptomName: symptom?.displayName,
          knowledge: symptom,
        },
      });
    } else {
      console.log('[NLP] 未匹配到相关症状', { text });
      res.json({
        success: true,
        data: {
          matched: false,
          message: '未匹配到相关症状，请尝试更详细的描述',
        },
      });
    }

  } catch (error) {
    console.error('Error analyzing complaint:', error);
    res.status(500).json({ success: false, message: 'Failed to analyze complaint' });
  }
};
