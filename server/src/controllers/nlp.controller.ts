import { Request, Response } from 'express';
import prisma from '../prisma';
import { parseChiefComplaintText } from '../services/chiefComplaintParser';
import { SYMPTOM_SYNONYMS as PREDEFINED_SYNONYMS } from './mapping.controller';

/**
 * 解析主诉
 * 根据关键词简单匹配症状，从数据库获取症状映射
 */
export const analyzeComplaint = async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      res.status(400).json({ success: false, message: 'Text is required' });
      return;
    }
    if (typeof text === 'string') {
      const t = text.trim();
      const hasCjk = /[\u4E00-\u9FFF]/u.test(t);
      const looksLikeLostCjk = !hasCjk && /[?？]/u.test(t);
      if (looksLikeLostCjk) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ENCODING',
            message: '请求文本疑似编码错误，请确保使用UTF-8发送中文内容',
          },
        });
        return;
      }
    }

    // 从数据库获取症状映射数据
    const symptomKnowledge = await prisma.symptomKnowledge.findMany({
      select: {
        symptomKey: true,
        displayName: true
      }
    });

    // 构建同义词映射和症状名称列表
    const SYMPTOM_NAME_TO_KEY: Record<string, string> = {};

    symptomKnowledge.forEach(sk => {
      if (sk.displayName && sk.symptomKey) {
        SYMPTOM_NAME_TO_KEY[sk.displayName] = sk.symptomKey;
      }
    });
    
    // 使用预定义的同义词映射（只包含存在于数据库中的症状）
    const SYMPTOM_SYNONYMS: Record<string, string> = {};
    for (const [synonym, canonicalName] of Object.entries(PREDEFINED_SYNONYMS)) {
      if (SYMPTOM_NAME_TO_KEY[canonicalName]) {
        SYMPTOM_SYNONYMS[synonym] = canonicalName;
      }
    }
    console.log('[NLP] 同义词映射加载', { count: Object.keys(SYMPTOM_SYNONYMS).length });

    function findAllOccurrences(source: string, phrase: string): number[] {
      const result: number[] = [];
      let start = 0;
      while (true) {
        const idx = source.indexOf(phrase, start);
        if (idx === -1) break;
        result.push(idx);
        start = idx + phrase.length;
      }
      return result;
    }

    const parsed = parseChiefComplaintText(String(text || ''), { synonyms: SYMPTOM_SYNONYMS, knownSymptoms: Object.keys(SYMPTOM_NAME_TO_KEY) });
    const foundNames = new Set<string>();
    const occurrences: Array<{ name: string; index: number }> = [];

    const probeText = String(text || '');
    const probeExtra = parsed.complaint_text ? ` ${parsed.complaint_text}` : '';
    const probe = `${probeText}${probeExtra}`;

    for (const [synonym, standard] of Object.entries(SYMPTOM_SYNONYMS)) {
      const idxs = findAllOccurrences(probe, synonym);
      if (idxs.length > 0) {
        foundNames.add(standard);
        for (const i of idxs) occurrences.push({ name: standard, index: i });
      }
    }
    for (const name of Object.keys(SYMPTOM_NAME_TO_KEY)) {
      const idxs = findAllOccurrences(probe, name);
      if (idxs.length > 0) {
        foundNames.add(name);
        for (const i of idxs) occurrences.push({ name, index: i });
      }
    }

    if (foundNames.size === 0 && parsed.complaint_text) {
      for (const name of Object.keys(SYMPTOM_NAME_TO_KEY)) {
        if (parsed.complaint_text.includes(name)) {
          foundNames.add(name);
        }
      }
    }

    const durationRange =
      parsed.duration_value && typeof parsed.duration_value === 'object' && parsed.duration_unit
        ? { min: parsed.duration_value.min, max: parsed.duration_value.max, unit: parsed.duration_unit, raw: parsed.duration_raw }
        : null;
    const duration =
      parsed.duration_value && parsed.duration_unit
        ? {
            value: typeof parsed.duration_value === 'object' ? parsed.duration_value.min : parsed.duration_value,
            unit: parsed.duration_unit,
          }
        : { value: null as number | null, unit: null as string | null };
    const perSymptomDurations: Array<{ name: string; value: number; unit: string }> = [];

    const matchedNames = Array.from(foundNames);
    const matched: Array<{ name: string; key: string; knowledge: any | null }> = [];
    for (const name of matchedNames) {
      const key = SYMPTOM_NAME_TO_KEY[name] || name.toLowerCase().replace(/\s+/g, '_');
      const knowledge = await prisma.symptomKnowledge.findUnique({ where: { symptomKey: key } });
      matched.push({ name, key, knowledge });
    }

    const normalizationSafe = true;
    const normalizedComplaint = parsed.normalized_text || String(text || '');

    const missingKnowledge = matched.filter(m => !m.knowledge).map(m => m.name);
    const validation = {
      inputSymptoms: matchedNames,
      mappedKeys: matched.map(m => m.key),
      missingKnowledge,
      consistent: missingKnowledge.length === 0
    };

    if (matched.length > 0) {
      console.log('[NLP] 解析主诉识别到症状', {
        text,
        matchedNames,
        duration,
        durationRange,
        complaint_text: parsed.complaint_text,
        duration_raw: parsed.duration_raw,
        confidence: parsed.confidence,
        failure_reason: parsed.failure_reason,
      });
      res.json({
        success: true,
        data: {
          matchedCount: matched.length,
          matchedSymptoms: matched,
          duration,
          durationRange,
          perSymptomDurations,
          normalizedComplaint,
          originalText: text,
          complaintParse: parsed,
          validation,
          normalizationSafe
        }
      });
    } else {
      console.log('[NLP] 未匹配到相关症状', {
        text,
        duration,
        durationRange,
        complaint_text: parsed.complaint_text,
        duration_raw: parsed.duration_raw,
        confidence: parsed.confidence,
        failure_reason: parsed.failure_reason,
      });
      res.json({
        success: true,
        data: {
          matchedCount: 0,
          matchedSymptoms: [],
          duration,
          durationRange,
          perSymptomDurations: [],
          normalizedComplaint,
          originalText: text,
          complaintParse: parsed,
          validation,
          normalizationSafe: true
        }
      });
    }

  } catch (error) {
    console.error('Error analyzing complaint:', error);
    res.status(500).json({ success: false, message: 'Failed to analyze complaint' });
  }
};

export const parseChiefComplaint = async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: unknown };
    const raw = typeof text === 'string' ? text : '';
    if (!raw.trim()) {
      return res.status(400).json({ success: false, message: 'text 必填' });
    }

    // 从数据库获取症状映射数据
    const symptomKnowledge = await prisma.symptomKnowledge.findMany({
      select: {
        symptomKey: true,
        displayName: true
      }
    });

    // 构建同义词映射和症状名称列表
    const SYMPTOM_NAME_TO_KEY: Record<string, string> = {};

    symptomKnowledge.forEach(sk => {
      if (sk.displayName && sk.symptomKey) {
        SYMPTOM_NAME_TO_KEY[sk.displayName] = sk.symptomKey;
      }
    });
    
    // 使用预定义的同义词映射（只包含存在于数据库中的症状）
    const SYMPTOM_SYNONYMS: Record<string, string> = {};
    for (const [synonym, canonicalName] of Object.entries(PREDEFINED_SYNONYMS)) {
      if (SYMPTOM_NAME_TO_KEY[canonicalName]) {
        SYMPTOM_SYNONYMS[synonym] = canonicalName;
      }
    }

    const parsed = parseChiefComplaintText(raw, { synonyms: SYMPTOM_SYNONYMS, knownSymptoms: Object.keys(SYMPTOM_NAME_TO_KEY) });
    console.log('[CC_PARSE] 主诉解析', {
      text: raw,
      complaint_text: parsed.complaint_text,
      duration_value: parsed.duration_value,
      duration_unit: parsed.duration_unit,
      duration_raw: parsed.duration_raw,
      confidence: parsed.confidence,
      failure_reason: parsed.failure_reason,
    });

    return res.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error('[CC_PARSE] 主诉解析失败', error);
    return res.status(500).json({ success: false, message: '主诉解析失败' });
  }
};
