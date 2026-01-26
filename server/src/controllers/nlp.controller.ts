import { Request, Response } from 'express';
import prisma from '../prisma';
import { SYMPTOM_SYNONYMS, SYMPTOM_NAME_TO_KEY } from '../services/mapping.service';

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

    const foundNames = new Set<string>();
    const occurrences: Array<{ name: string; index: number }> = [];

    for (const [synonym, standard] of Object.entries(SYMPTOM_SYNONYMS)) {
      const idxs = findAllOccurrences(text, synonym);
      if (idxs.length > 0) {
        foundNames.add(standard);
        for (const i of idxs) occurrences.push({ name: standard, index: i });
      }
    }
    for (const name of Object.keys(SYMPTOM_NAME_TO_KEY)) {
      const idxs = findAllOccurrences(text, name);
      if (idxs.length > 0) {
        foundNames.add(name);
        for (const i of idxs) occurrences.push({ name, index: i });
      }
    }

    if (foundNames.size === 0) {
      if (text.includes('泻') || text.includes('腹泻') || text.includes('水样') || text.includes('稀便') || text.includes('里急后重')) {
        foundNames.add('腹泻');
      }
      if (text.includes('腹') || text.includes('肚子') || text.includes('胃')) {
        foundNames.add('腹痛');
      }
      if (text.includes('胸')) {
        foundNames.add('胸痛');
      }
      if (text.includes('悸') || text.includes('慌') || text.includes('跳')) {
        foundNames.add('心悸');
      }
      if (text.includes('头痛') || text.includes('偏头痛')) {
        foundNames.add('头痛');
      }
      if (text.includes('头晕') || text.includes('晕') || text.includes('天旋地转')) {
        foundNames.add('眩晕');
      }
      if (text.includes('热') || text.includes('烧') || text.includes('烫')) {
        foundNames.add('发热');
      }
      if (text.includes('咳') || text.includes('痰')) {
        foundNames.add('咳嗽');
      }
      if (text.includes('喘') || text.includes('呼吸困难') || text.includes('气促') || text.includes('憋')) {
        foundNames.add('呼吸困难');
      }
      if (text.includes('累') || text.includes('乏') || text.includes('疲') || text.includes('力')) {
        foundNames.add('乏力');
      }
      if (text.includes('吐') || text.includes('恶心') || text.includes('呕吐') || text.includes('恶心呕吐')) {
        foundNames.add('恶心呕吐');
      }
    }

    let duration = { value: null as number | null, unit: null as string | null };
    const perSymptomDurations: Array<{ name: string; value: number; unit: string }> = [];
    const durationRegexGlobal = /(\d+)\s*(小时|天|周|月|年)/g;
    const durationMatches = Array.from(text.matchAll(durationRegexGlobal)) as Array<RegExpMatchArray & { index: number }>;
    if (durationMatches.length > 0) {
      duration.value = parseInt(durationMatches[0][1], 10);
      duration.unit = durationMatches[0][2];
      if (occurrences.length > 0) {
        for (const m of durationMatches) {
          const mIndex = m.index;
          let nearestName = '';
          let nearestDist = Number.POSITIVE_INFINITY;
          for (const occ of occurrences) {
            const dist = mIndex - occ.index;
            if (dist >= 0 && dist < nearestDist) {
              nearestDist = dist;
              nearestName = occ.name;
            }
          }
          if (nearestName) {
            perSymptomDurations.push({
              name: nearestName,
              value: parseInt(m[1], 10),
              unit: m[2]
            });
          }
        }
      }
    }

    const matchedNames = Array.from(foundNames);
    const matched: Array<{ name: string; key: string; knowledge: any | null }> = [];
    for (const name of matchedNames) {
      const key = SYMPTOM_NAME_TO_KEY[name] || name.toLowerCase().replace(/\s+/g, '_');
      const knowledge = await prisma.symptomKnowledge.findUnique({ where: { symptomKey: key } });
      matched.push({ name, key, knowledge });
    }

    const normalizationSafe = (() => {
      if (durationMatches.length <= 1) return true;
      const uniqueNamesWithDur = new Set(perSymptomDurations.map(d => d.name));
      return uniqueNamesWithDur.size <= 1;
    })();
    const normalizedComplaint = normalizationSafe ? (() => {
      if (matchedNames.length === 0) return text || '';
      const sym = matchedNames.join('伴');
      const dur = duration.value ? `${duration.value}${duration.unit || ''}` : '';
      return dur ? `${sym}${dur}` : sym;
    })() : text || '';

    const missingKnowledge = matched.filter(m => !m.knowledge).map(m => m.name);
    const validation = {
      inputSymptoms: matchedNames,
      mappedKeys: matched.map(m => m.key),
      missingKnowledge,
      consistent: missingKnowledge.length === 0
    };

    if (matched.length > 0) {
      console.log('[NLP] 解析主诉识别到症状', { text, matchedNames, duration, perSymptomDurations, normalizationSafe });
      res.json({
        success: true,
        data: {
          matchedCount: matched.length,
          matchedSymptoms: matched,
          duration,
          perSymptomDurations,
          normalizedComplaint,
          originalText: text,
          validation,
          normalizationSafe
        }
      });
    } else {
      console.log('[NLP] 未匹配到相关症状', { text });
      res.json({
        success: true,
        data: {
          matchedCount: 0,
          matchedSymptoms: [],
          duration,
          perSymptomDurations: [],
          normalizedComplaint: text || '',
          originalText: text,
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
