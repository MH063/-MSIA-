
import dayjs from 'dayjs';

export interface HpiValues {
  onsetTime?: string;
  onsetMode?: string;
  trigger?: string;
  location?: string;
  quality?: string | string[];
  severity?: string;
  durationDetails?: string;
  factors?: string;
  associatedSymptoms?: string[];
  associatedSymptomsDetails?: string;
  negativeSymptoms?: string;
  treatmentHistory?: string | string[];
  admissionDiagnosis?: string;
  spirit?: string;
  appetite?: string;
  sleep?: string;
  strength?: string;
  weight?: string;
  weight_change_jin?: number | string;
  urine_stool?: string;
  general_line?: string;
  // Evolution is sometimes stored here
  hpi_evolution?: string;
  evolution?: string;
}

/**
 * buildHpiNarrative
 * 将表单中的现病史相关字段整理为一段逻辑连贯、条理清晰的叙述性文字
 * @param values HPI values object
 * @param mainSymptom Chief complaint symptom (text)
 * @param labelByKey Map of symptom keys to labels (for associated symptoms)
 */
export function buildHpiNarrative(
  values: HpiValues,
  mainSymptom: string = '不适',
  labelByKey: Record<string, string> = {}
): string {
  const INDENT = '  ';
  const ensureEnd = (text: string): string => {
    const t = String(text || '').trim();
    if (!t) return '';
    return /[。！？]$/u.test(t) ? t : `${t}。`;
  };

  const normalizeOnsetTime = (val: string | undefined): string => {
    const t = String(val || '').trim();
    if (!t || /^(无|-|—)$/u.test(t)) return '';
    if (/^\d+(天|周|月|小时|分钟)$/u.test(t) && !/前$/.test(t)) return `${t}前`;
    return t;
  };

  const normalizeTrigger = (val: string | undefined): string => {
    const t = String(val || '').trim();
    if (!t || /^(无|-|—)$/u.test(t)) return '无明显诱因';
    return t;
  };

  const normalizeOnsetMode = (val: string | undefined): string => {
    if (val === 'sudden') return '急';
    if (val === 'gradual') return '缓';
    return '';
  };

  const normalizeNegative = (val: string | undefined): string => {
    const raw = String(val || '').trim().replace(/[。；，、]+$/u, '');
    if (!raw || /^(无|-|—)$/u.test(raw)) return '';
    if (/^(无|否认)/u.test(raw)) return raw;
    return `无${raw}`;
  };

  const normalizeField = (
    val: string | undefined,
    field: 'spirit' | 'sleep' | 'appetite' | 'strength' | 'weight' | 'urine_stool'
  ): string => {
    const raw = (val ?? '').toString().trim();
    if (!raw) return '';
    if (raw === '—') return '';

    const map: Record<string, Record<string, string>> = {
      spirit: { good: '好', bad: '差', poor: '差', normal: '一般' },
      appetite: { normal: '正常', increased: '增加', decreased: '减退', poor: '差' },
      sleep: { normal: '正常', bad: '差', poor: '差' },
      strength: { normal: '正常', good: '好', bad: '差', poor: '差', weak: '减弱', decreased: '减弱', '正常': '正常', '尚可': '尚可', '减弱': '减弱' },
      weight: { no_change: '无变化', loss: '下降', decreased: '下降', gain: '增加', increased: '增加' },
      urine_stool: { normal: '正常', 'no abnormal': '无异常' },
    };

    if (map[field] && map[field][raw]) return map[field][raw];
    return raw;
  };

  const formatWeight = (val: string | undefined, jin: number | string | undefined): string => {
    const raw = normalizeField(val, 'weight');
    const normalized = raw === '无变化' ? '无明显变化' : raw;
    if (!normalized) return '';
    if (normalized === '无明显变化') return normalized;
    if (/斤/u.test(normalized)) return normalized;
    const n = typeof jin === 'number' ? jin : Number(String(jin ?? '').trim());
    const hasJin = Number.isFinite(n) && n > 0;
    if ((normalized === '下降' || normalized === '增加') && hasJin) return `${normalized}${n}斤`;
    return normalized;
  };

  const formatUrineStool = (val: string | undefined): string => {
    const raw = normalizeField(val, 'urine_stool').trim().replace(/。$/u, '');
    if (!raw) return '';

    const t = raw
      .replace(/\s+/gu, ' ')
      .replace(/[，、；;]+/gu, '，')
      .replace(/\s*\/\s*/gu, '，')
      .replace(/^二便/u, '')
      .trim()
      .replace(/^：/u, '')
      .trim();

    if (!t) return '';
    if (/^(正常|无异常)$/u.test(t)) return '大小便无异常';
    if (/^大小便/u.test(t)) return t;

    const hasUrine = /小便|排尿|尿/u.test(t);
    const hasStool = /大便|排便|便/u.test(t);

    if (/小便/u.test(t) && /大便/u.test(t)) return t;
    if (hasStool && !hasUrine) {
      const stoolText = /^大便/u.test(t) ? t : `大便${t}`;
      return `小便无异常，${stoolText}`;
    }
    if (hasUrine && !hasStool) {
      const urineText = /^小便/u.test(t) ? t : `小便${t}`;
      return `${urineText}，大便无异常`;
    }

    if (/干结|便秘|腹泻|便血|黑便|稀|柏油样便/u.test(t)) {
      const stoolText = /^大便/u.test(t) ? t : `大便${t}`;
      return `小便无异常，${stoolText}`;
    }

    return `大小便${t}`;
  };

  const onsetTime = normalizeOnsetTime(values.onsetTime) || '不详时间';
  const triggerText = normalizeTrigger(values.trigger);
  const onsetModeText = normalizeOnsetMode(values.onsetMode);

  const symptomCore = (() => {
    const locRaw = String(values.location || '').trim();
    const loc = /^(无|-|—)$/u.test(locRaw) ? '' : locRaw;
    const sym = String(mainSymptom || '').trim() || '不适';
    return loc ? `${loc}${sym}` : sym;
  })();

  const symptomFeatures = (() => {
    const normalizeFeature = (val: unknown): string => {
      const t = String(val ?? '').trim().replace(/[。；，、]+$/u, '').trim();
      if (!t) return '';
      if (/^(-|—|无|未详|不详|无明显)$/u.test(t)) return '';
      return t;
    };

    const detailSegments: string[] = [];
    if (values.quality) {
      const q = Array.isArray(values.quality) ? values.quality.join('、') : values.quality;
      const qt = String(q || '').trim();
      if (qt && !/^(-|—|无)$/u.test(qt)) detailSegments.push(`性质为${qt}`);
    }

    if (values.severity) {
      const severityMap: Record<string, string> = { mild: '轻度', moderate: '中度', severe: '重度' };
      const s = String(values.severity).trim();
      if (!/^(-|—|无)$/u.test(s)) {
        if (severityMap[s]) detailSegments.push(`程度为${severityMap[s]}`);
        else if (s) detailSegments.push(`程度${s}`);
      }
    }

    if (values.durationDetails) {
      const dur = normalizeFeature(values.durationDetails);
      if (dur) detailSegments.push(dur);
    }

    if (values.factors) {
      const fac = normalizeFeature(values.factors);
      if (fac) detailSegments.push(fac);
    }

    return detailSegments.join('，');
  })();

  const evolutionTextRaw = values.hpi_evolution || values.evolution;
  const evolutionText = String(evolutionTextRaw || '').trim().replace(/[。；，、]+$/u, '');

  const associatedText = (() => {
    const detail = String(values.associatedSymptomsDetails || '').trim().replace(/[。；，、]+$/u, '');
    if (detail) return detail.replace(/^伴有/u, '').trim();
    const list = Array.isArray(values.associatedSymptoms) ? values.associatedSymptoms : [];
    const labels = list.map(k => labelByKey[k] || k).map(s => String(s || '').trim()).filter(Boolean);
    if (labels.length > 0) return labels.join('、');
    return '';
  })();

  const negativeText = normalizeNegative(values.negativeSymptoms);

  const treatmentText = (() => {
    const raw = (() => {
      const v = values.treatmentHistory;
      if (Array.isArray(v)) return v.map(x => String(x || '').trim()).filter(Boolean).join(',');
      return String(v || '').trim();
    })();
    if (!raw) return '';

    const datePattern = /(\d{4})(?:\/|-|\.|年)(\d{1,2})(?:\/|-|\.|月)(\d{1,2})/u;

    const splitLines = (text: string): string[] => {
      const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const byNewline = normalized
        .split('\n')
        .map(l => String(l || '').trim())
        .filter(Boolean);
      if (byNewline.length > 1) return byNewline;
      const single = byNewline[0] || '';
      const sep = single.includes(',') ? ',' : single.includes('，') ? '，' : '';
      if (!sep) return byNewline;
      return single
        .split(sep)
        .map(l => String(l || '').trim())
        .filter(Boolean);
    };

    const normalizeDateText = (y: string, m: string, d: string): string => {
      const mm = String(Number(m)).padStart(2, '0');
      const dd = String(Number(d)).padStart(2, '0');
      return `${y}-${mm}-${dd}`;
    };

    const extractDate = (line: string): { dateText: string; ts: number } => {
      const m = line.match(datePattern);
      if (!m) return { dateText: '', ts: Number.POSITIVE_INFINITY };
      const dateText = normalizeDateText(m[1], m[2], m[3]);
      const ts = dayjs(dateText).isValid() ? dayjs(dateText).valueOf() : Number.POSITIVE_INFINITY;
      return { dateText, ts };
    };

    const normalizeLine = (input: string): { line: string; ts: number } => {
      const trimmed = String(input || '').trim();
      if (!trimmed) return { line: '', ts: Number.POSITIVE_INFINITY };

      const stripped = trimmed.replace(/^记录\s*\d+\s*/u, '').replace(/^记录\d+\s*/u, '').trim();

      const bracket = stripped.match(/^\[(.*?)\]/u);
      if (bracket) {
        const date = String(bracket[1] || '').trim();
        const dateText = dayjs(date).isValid() ? dayjs(date).format('YYYY-MM-DD') : date;
        const content = stripped.substring(bracket[0].length).trim();
        const ts = date && dayjs(dateText).isValid() ? dayjs(dateText).valueOf() : Number.POSITIVE_INFINITY;
        const line = `${dateText}${content ? ` ${content}` : ''}`.trim();
        return { line, ts };
      }

      const match = stripped.match(datePattern);
      if (!match || match.index == null) {
        return { line: stripped.replace(/[。；，、]+$/u, ''), ts: Number.POSITIVE_INFINITY };
      }

      const { dateText, ts } = extractDate(stripped);
      const rest = stripped.slice(match.index + match[0].length).trim();
      const normalized = `${dateText}${rest}`.trim().replace(/^[，、；;]+/u, '').trim();
      return { line: normalized.replace(/[。；，、]+$/u, ''), ts };
    };

    const inputs = splitLines(raw);
    const normalizedItems = inputs
      .map((line, idx) => ({ ...normalizeLine(line), idx }))
      .filter(it => Boolean(it.line));

    const stripPlanLabel = (text: string): string => {
      return String(text || '')
        .replace(/治疗\/方案[:：]\s*/gu, '')
        .replace(/治疗方案[:：]\s*/gu, '')
        .trim();
    };

    const buildSentence = (line: string, prefixCengYu: boolean): string => {
      const cleaned = stripPlanLabel(String(line || '').trim()).replace(/[。；，、]+$/u, '');
      if (!cleaned) return '';

      const m = cleaned.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/u);
      const dateText = m ? m[1] : '';
      let rest = (m ? m[2] : cleaned).trim();
      rest = rest.replace(/\s+/gu, ' ');

      const instMatch =
        rest.match(/(?:^|[，,；;]\s*)于([^，,；;]+?)(?=([，,；;]|$))/u) ||
        rest.match(/(?:^|[，,；;]\s*)在([^，,；;]+?)(?=([，,；;]|$))/u);
      const inst = instMatch ? String(instMatch[1] || '').trim() : '';
      if (inst) {
        rest = rest
          .replace(new RegExp(`(?:^|[，,；;]\\s*)(?:于|在)${inst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=([，,；;]|$))`, 'u'), '')
          .trim();
      }

      const outcomeMatch = rest.match(
        /(效果不佳|疗效不佳|无明显缓解|未见明显缓解|无缓解|稍缓解|明显缓解|好转|缓解|减轻|加重)/u
      );
      const outcome = outcomeMatch ? String(outcomeMatch[1] || '').trim() : '';
      if (outcome) {
        rest = rest.replace(outcome, '').replace(/[，,；;]\s*$/u, '').trim();
      }

      const actionRaw = rest.replace(/^[，,；;]+/u, '').trim().replace(/[，,；;]\s*$/u, '').trim();
      const action = (() => {
        const a = stripPlanLabel(actionRaw);
        if (!a) return '';
        if (/^(予以|予|给予|行)/u.test(a)) return a;
        if (/^(检查|检验|彩超|B超|CT|MRI|X线|血常规|尿常规|心电图|胸片)/u.test(a)) return `行${a}`;
        return `予${a}`;
      })();

      const head = `${prefixCengYu ? '曾于' : ''}${dateText || '不详时间'}${inst ? `在${inst}` : ''}就诊`;

      const tail = (() => {
        if (!outcome) return '';
        const core = outcome.replace(/^症状/u, '').trim();
        if (!core) return '';
        const isGood = /(好转|缓解|减轻)/u.test(core) && !/(无|未见)/u.test(core);
        return isGood ? `，后症状${core}` : `，但症状${core}`;
      })();

      return ensureEnd([head, action ? `，${action}` : '', tail].join('').replace(/[，,；;]\s*$/u, '').trim());
    };

    const sentences = normalizedItems.map((it, idx) => buildSentence(it.line, idx === 0)).filter(Boolean);
    return sentences.join('');
  })();

  const normalizeDx = (val: string | undefined): string => {
    return String(val || '')
      .trim()
      .replace(/[“”"']/gu, '')
      .replace(/^门诊(拟)?/u, '')
      .replace(/收入我科$/u, '')
      .replace(/[。；，、]+$/u, '')
      .trim();
  };

  const generalSentence = (() => {
    const generalParts: string[] = [];
    const spirit = normalizeField(values.spirit, 'spirit');
    const appetite = normalizeField(values.appetite, 'appetite');
    const sleep = normalizeField(values.sleep, 'sleep');
    const strength = normalizeField(values.strength, 'strength');

    const weight = formatWeight(values.weight, values.weight_change_jin);

    const excretionRaw = formatUrineStool(values.urine_stool);
    const excretion = (() => {
      if (!excretionRaw) return '';
      const t = String(excretionRaw || '').trim().replace(/[。；，、]+$/u, '');
      if (!t) return '';
      const cleaned = t.replace(/^大小便/u, '').trim().replace(/^[:：]/u, '').trim();
      if (!cleaned) return '';
      if (/^(小便|大便|大小便)/u.test(cleaned)) return cleaned;
      return `大小便${cleaned}`;
    })();

    const base = (() => {
      const raw = values.general_line && String(values.general_line).trim() ? String(values.general_line) : '';
      const t = raw.trim().replace(/^>/u, '').trim().replace(/[。；，、]+$/u, '').trim();
      if (!t) return '';
      if (/^一般情况[:：]/u.test(t)) return t.replace(/^一般情况[:：]\s*/u, '').trim();
      if (/^起病以来[，、]?/u.test(t)) return t.replace(/^起病以来[，、]?/u, '').trim();
      if (/^病程中[，、]?/u.test(t)) return t.replace(/^病程中[，、]?/u, '').trim();
      if (/^患者/u.test(t)) return t.replace(/^患者/u, '').replace(/^，/u, '').trim();
      return t;
    })();

    if (base) {
      const normalizedBase = base
        .replace(/大小便[:：]\s*/gu, '')
        .replace(/体重变化/gu, '体重')
        .trim()
        .replace(/[。；，、]+$/u, '');

      const weightJin = (() => {
        const n = typeof values.weight_change_jin === 'number' ? values.weight_change_jin : Number(String(values.weight_change_jin ?? '').trim());
        return Number.isFinite(n) && n > 0 ? n : 0;
      })();
      const withWeightJin = (() => {
        if (!weightJin) return normalizedBase;
        if (/体重(?:下降|增加)\d+斤/u.test(normalizedBase)) return normalizedBase;
        return normalizedBase.replace(/体重(下降|增加)(?!\d+斤)/u, (_m, dir) => `体重${dir}${weightJin}斤`);
      })();

      const extraParts: string[] = [];
      if (spirit && !/精神/u.test(withWeightJin)) extraParts.push(`精神${spirit}`);
      if (appetite && !/食欲/u.test(withWeightJin)) extraParts.push(`食欲${appetite}`);
      if (sleep && !/睡眠/u.test(withWeightJin)) extraParts.push(`睡眠${sleep}`);
      if (strength && !/体力/u.test(withWeightJin)) extraParts.push(`体力${strength}`);
      if (excretion && !/(小便|大便|大小便)/u.test(withWeightJin)) extraParts.push(excretion);
      if (weight && !/体重/u.test(withWeightJin)) extraParts.push(`体重${weight}`);

      const merged = [withWeightJin, ...extraParts].filter(Boolean).join('、').replace(/[。；，、]+$/u, '');
      return `发病以来，患者${merged}。`.replace(/患者患者/gu, '患者');
    }

    const spiritText = spirit || '未详';
    const appetiteText = appetite || '未详';
    const sleepText = sleep || '未详';
    const strengthText = strength || '未详';
    const excretionText = excretion || '大小便未详';
    const weightText = weight || '未详';

    generalParts.push(`精神${spiritText}`);
    generalParts.push(`食欲${appetiteText}`);
    generalParts.push(`睡眠${sleepText}`);
    generalParts.push(`体力${strengthText}`);
    generalParts.push(excretionText);
    generalParts.push(`体重${weightText}`);

    return `发病以来，患者${generalParts.join('、')}。`.replace(/患者患者/gu, '患者');
  })();

  const hpiLine1 = (() => {
    const modeClause = onsetModeText ? `${onsetModeText}性` : '';
    const symptomClause = symptomFeatures ? `${symptomCore}，${symptomFeatures}` : symptomCore;

    const onset = onsetTime.endsWith('前') ? onsetTime : onsetTime;
    const triggerClause = triggerText ? (triggerText.endsWith('后') ? triggerText : `${triggerText}后`) : '无明显诱因后';
    const head = `患者${onset}，在${triggerClause}${modeClause}起病，初起表现为${symptomClause}。`.replace(/，，/gu, '，');

    const evolutionClause = (() => {
      const ev = evolutionText;
      const assoc = associatedText ? associatedText.replace(/^并出现/u, '').replace(/^出现/u, '').trim() : '';
      const neg = negativeText ? negativeText.replace(/[。；，、]+$/u, '') : '';

      if (!ev && !assoc && !neg) return '';

      if (ev) {
        const cleanedEv = ev.replace(/[。；，、]+$/u, '');
        const filteredAssoc = (() => {
          if (!assoc) return '';
          const tokens = assoc
            .replace(/[。！？]+$/u, '')
            .split(/[、，,；;]+/u)
            .map(s => String(s || '').trim())
            .filter(Boolean);
          if (tokens.length <= 1) {
            const t = tokens[0] || assoc;
            return t && cleanedEv.includes(t) ? '' : assoc;
          }
          const kept = tokens.filter(t => t && !cleanedEv.includes(t));
          return kept.join('、');
        })();
        const evLooksComplete = /[，,。；;：:\n]/u.test(cleanedEv) || /出现|伴有|伴随|并发|加重|减轻|缓解/u.test(cleanedEv);
        const baseEv = evLooksComplete ? `随后，${cleanedEv}` : `随后，病情逐渐${cleanedEv}`;
        const needAssoc = filteredAssoc;
        const tailParts = [
          needAssoc ? `并出现${needAssoc}` : undefined,
          neg && !new RegExp(neg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u').test(cleanedEv) ? neg : undefined,
        ].filter(Boolean);
        const tail = tailParts.length > 0 ? `，${tailParts.join('，')}` : '';
        return ensureEnd(`${baseEv}${tail}`.replace(/[。；，、]+$/u, ''));
      }

      const tailParts = [
        assoc ? `出现${assoc}` : undefined,
        neg || undefined,
      ].filter(Boolean);
      if (tailParts.length === 0) return '';
      return ensureEnd(`随后，${tailParts.join('，')}`.replace(/[。；，、]+$/u, ''));
    })();

    const arrive = '为求进一步诊治，遂来我院就诊。';
    const dx = normalizeDx(values.admissionDiagnosis);
    const admit = dx ? `门诊以“${dx}”收入我科。` : '';

    return [head, evolutionClause, treatmentText, arrive, admit].filter(Boolean).join('');
  })();

  const hpiLine2 = `${generalSentence}`;

  return `${INDENT}${hpiLine1}\n${INDENT}${hpiLine2}`;
}
