import { Request, Response } from 'express';
import { secureLogger } from '../utils/secureLogger';

/**
 * 分析主诉症状
 */
export const analyzeComplaint = async (req: Request, res: Response) => {
  try {
    // 支持 text 或 complaint 字段
    const text = req.body.text || req.body.complaint;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, message: '主诉内容不能为空' });
      return;
    }

    // 简单的症状提取逻辑
    const symptoms = extractSymptoms(text);
    const duration = extractDuration(text);

    res.json({
      success: true,
      data: {
        matchedCount: symptoms.length,
        matchedSymptoms: symptoms.map(name => ({ name, key: name, knowledge: null })),
        duration: duration.value ? { value: duration.value, unit: duration.unit } : { value: null, unit: null },
        normalizedComplaint: text,
        originalText: text
      }
    });
  } catch (error) {
    secureLogger.error('[NLPController] 分析主诉失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: '分析主诉失败' });
  }
};

/**
 * 解析主诉结构
 */
export const parseChiefComplaint = async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, message: '文本内容不能为空' });
      return;
    }
    
    // 解析主诉结构
    const parsed = parseComplaintStructure(text);
    
    res.json({ 
      success: true, 
      data: parsed
    });
  } catch (error) {
    secureLogger.error('[NLPController] 解析主诉结构失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: '解析主诉结构失败' });
  }
};

// 辅助函数：从文本中提取症状
function extractSymptoms(text: string): string[] {
  const commonSymptoms = [
    '发热', '咳嗽', '头痛', '头晕', '恶心', '呕吐', '腹痛', '腹泻',
    '胸闷', '胸痛', '心悸', '气短', '乏力', '出汗', '失眠', '食欲减退'
  ];
  
  const found: string[] = [];
  for (const symptom of commonSymptoms) {
    if (text.includes(symptom)) {
      found.push(symptom);
    }
  }
  return found;
}

// 辅助函数：从文本中提取持续时间
function extractDuration(text: string): { value?: number; unit?: string } {
  const patterns = [
    { regex: /(\d+)\s*天/, unit: '天' },
    { regex: /(\d+)\s*周/, unit: '周' },
    { regex: /(\d+)\s*月/, unit: '月' },
    { regex: /(\d+)\s*年/, unit: '年' },
    { regex: /(\d+)\s*小时/, unit: '小时' },
    { regex: /(\d+)\s*分钟/, unit: '分钟' }
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      return {
        value: parseInt(match[1], 10),
        unit: pattern.unit
      };
    }
  }
  return {};
}

// 辅助函数：解析主诉结构
function parseComplaintStructure(text: string) {
  const duration = extractDuration(text);
  const symptoms = extractSymptoms(text);
  
  return {
    originalText: text,
    symptoms,
    duration,
    severity: extractSeverity(text),
    location: extractLocation(text)
  };
}

// 辅助函数：提取严重程度
function extractSeverity(text: string): string | undefined {
  const severityPatterns = [
    { pattern: /轻度|轻微|有点/, level: '轻度' },
    { pattern: /中度|明显|比较/, level: '中度' },
    { pattern: /重度|严重|剧烈|很/, level: '重度' }
  ];
  
  for (const { pattern, level } of severityPatterns) {
    if (pattern.test(text)) {
      return level;
    }
  }
  return undefined;
}

// 辅助函数：提取部位
function extractLocation(text: string): string | undefined {
  const locations = [
    '头部', '胸部', '腹部', '背部', '腰部', '腿部', '手臂', 
    '上腹部', '下腹部', '左胸', '右胸', '心前区'
  ];
  
  for (const location of locations) {
    if (text.includes(location)) {
      return location;
    }
  }
  return undefined;
}
