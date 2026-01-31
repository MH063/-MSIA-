import { Request, Response } from 'express';
import * as sessionService from '../services/session.service';
import * as knowledgeService from '../services/knowledge.service';
import prisma from '../prisma';

/**
 * 创建会话
 */
export const createSession = async (req: Request, res: Response) => {
  try {
    const { patientId, historian, reliability, historianRelationship } = req.body;
    if (!patientId) {
      res.status(400).json({ success: false, message: 'Patient ID is required' });
      return;
    }
    const session = await sessionService.createSession(Number(patientId), {
        historian, reliability, historianRelationship
    });
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, message: 'Failed to create session' });
  }
};

/**
 * 获取会话详情
 */
export const getSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await sessionService.getSessionById(Number(id));
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }
    console.log('[getSession] 返回的session数据:', JSON.stringify({
      id: session.id,
      presentIllness: session.presentIllness,
      presentIllnessKeys: session.presentIllness ? Object.keys(session.presentIllness as any) : []
    }, null, 2));
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch session' });
  }
};

/**
 * 更新会话
 */
export const updateSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    console.log('[updateSession] 接收到的数据:', JSON.stringify(body, null, 2));

    // 1. Separate Patient data and Session data
    const patientFields = [
        'name', 'gender', 'birthDate', 'nativePlace', 'placeOfBirth', 
        'ethnicity', 'address', 'occupation', 'employer', 'phone'
    ];

    const sessionFields = [
        'historian', 'reliability', 'historianRelationship',
        'generalInfo', 'chiefComplaint', 'presentIllness',
        'pastHistory', 'personalHistory', 'maritalHistory',
        'menstrualHistory', 'fertilityHistory', 'familyHistory',
        'physicalExam', 'specialistExam', 'auxiliaryExams',
        'reviewOfSystems', 'status'
    ];

    const patientData: any = {};
    const sessionData: any = {};

    Object.keys(body).forEach(key => {
        if (patientFields.includes(key)) {
            if (key === 'phone') {
                patientData.contactInfo = { phone: body[key] };
            } else if (key === 'birthDate' && body[key]) {
                // 将 ISO 日期字符串转换为 Date 对象
                const dateValue = new Date(body[key]);
                if (!isNaN(dateValue.getTime())) {
                    patientData[key] = dateValue;
                }
            } else {
                patientData[key] = body[key];
            }
        } else if (sessionFields.includes(key)) {
            sessionData[key] = body[key];
        }
    });

    console.log('[updateSession] 分离后的sessionData:', JSON.stringify(sessionData, null, 2));

    // 2. Update Session
    const session = await sessionService.updateSession(Number(id), sessionData);

    console.log('[updateSession] 更新后的session:', JSON.stringify(session, null, 2));

    // 3. Update Patient if there is patient data
    if (Object.keys(patientData).length > 0) {
        await prisma.patient.update({
            where: { id: session.patientId },
            data: patientData
        });
    }

    // 4. Return updated session with patient info
    const updatedSession = await sessionService.getSessionById(Number(id));
    res.json({ success: true, data: updatedSession });

  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ success: false, message: 'Failed to update session' });
  }
};

/**
 * 生成病历报告
 */
export const generateReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await sessionService.getSessionById(Number(id));

    if (!session || !session.patient) {
      res.status(404).json({ success: false, message: 'Session or patient not found' });
      return;
    }

    const { patient, chiefComplaint, presentIllness } = session;
    const cp = chiefComplaint as any;
    const pi = presentIllness as any;

    const ensureSentenceEnd = (text: unknown): string => {
      const t = String(text ?? '').trim();
      if (!t) return '';
      return /[。！？]$/u.test(t) ? t : `${t}。`;
    };

    const toRecord = (v: unknown): Record<string, unknown> => {
      if (typeof v === 'object' && v !== null) return v as Record<string, unknown>;
      return {};
    };

    const normalizeText = (v: unknown): string => {
      const t = String(v ?? '').trim();
      if (!t) return '';
      if (t === '-' || t === '—' || t === '无') return '';
      return t;
    };

    const formatDate = (v: unknown, fallback: string): string => {
      if (!v) return fallback;
      const d = new Date(v as any);
      if (Number.isNaN(d.getTime())) return fallback;
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    };

    let report = `一般项目：`;
    const ageText = patient.birthDate
      ? Math.floor((new Date().getTime() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) + '岁'
      : '未知';
    const generalItems: string[] = [];
    generalItems.push(`姓名：${patient.name || '未记录'}`);
    generalItems.push(`性别：${patient.gender || '未知'}`);
    generalItems.push(`年龄：${ageText}`);
    generalItems.push(`民族：${(patient as any).ethnicity || '未记录'}`);
    generalItems.push(`婚况：${(session.maritalHistory as any)?.status || '未记录'}`);
    generalItems.push(`出生地：${(patient as any).placeOfBirth || '未记录'}`);
    generalItems.push(`籍贯：${(patient as any).nativePlace || '未记录'}`);
    generalItems.push(`职业：${(patient as any).occupation || '未记录'}`);
    generalItems.push(`住址：${(patient as any).address || '未记录'}`);
    generalItems.push(`入院日期：${new Date(session.createdAt).toLocaleDateString()}`);
    generalItems.push(`记录日期：${new Date().toLocaleDateString()}`);
    generalItems.push(`病史陈述者：${(session as any).historian || '本人'}`);
    if ((session as any).historianRelationship) generalItems.push(`关系：${(session as any).historianRelationship}`);
    generalItems.push(`可靠程度：${(session as any).reliability || '可靠'}`);
    report += `${generalItems.join('  ')}\n\n`;

    const ccText = ensureSentenceEnd(cp?.text || '未记录');
    report += `主诉：${ccText}\n\n`;

    const buildHpiNarrative = (values: Record<string, unknown>, mainSymptom: string): string => {
      const INDENT = '  ';
      const ensureEnd = (text: string): string => {
        const t = String(text || '').trim();
        if (!t) return '';
        return /[。！？]$/u.test(t) ? t : `${t}。`;
      };

      const normalizeOnsetTime = (val: unknown): string => {
        const t = normalizeText(val);
        if (!t) return '';
        if (/^\d+(天|周|月|小时|分钟)$/u.test(t) && !/前$/.test(t)) return `${t}前`;
        return t;
      };

      const normalizeTrigger = (val: unknown): string => normalizeText(val) || '无明显诱因';

      const normalizeOnsetMode = (val: unknown): string => {
        const t = normalizeText(val);
        if (t === 'sudden') return '急';
        if (t === 'gradual') return '缓';
        return '';
      };

      const normalizeNegative = (val: unknown): string => {
        const raw = normalizeText(val).replace(/[。；，、]+$/u, '');
        if (!raw) return '';
        if (/^(无|否认)/u.test(raw)) return raw;
        return `无${raw}`;
      };

      const normalizeDx = (val: unknown): string => {
        return String(val ?? '')
          .trim()
          .replace(/[“”"']/gu, '')
          .replace(/^门诊(拟)?/u, '')
          .replace(/收入我科$/u, '')
          .replace(/[。；，、]+$/u, '')
          .trim();
      };

      const onsetTime = normalizeOnsetTime(values.onsetTime) || '不详时间';
      const triggerText = normalizeTrigger(values.trigger);
      const onsetModeText = normalizeOnsetMode(values.onsetMode);

      const symptomCore = (() => {
        const loc = normalizeText(values.location);
        const sym = String(mainSymptom || '').trim() || '不适';
        return loc ? `${loc}${sym}` : sym;
      })();

      const symptomFeatures = (() => {
        const normalizeFeature = (val: unknown): string => {
          const t = normalizeText(val).replace(/[。；，、]+$/u, '').trim();
          if (!t) return '';
          if (/^(无|未详|不详|无明显)$/u.test(t)) return '';
          return t;
        };

        const segments: string[] = [];
        const qualityRaw = values.quality as unknown;
        if (Array.isArray(qualityRaw)) {
          const q = qualityRaw.map(normalizeText).filter(Boolean).join('、');
          if (q) segments.push(`性质为${q}`);
        } else {
          const q = normalizeText(qualityRaw);
          if (q) segments.push(`性质为${q}`);
        }

        const severityRaw = normalizeText(values.severity);
        if (severityRaw) {
          const severityMap: Record<string, string> = { mild: '轻度', moderate: '中度', severe: '重度' };
          const sev = severityMap[severityRaw] || severityRaw;
          segments.push(severityMap[severityRaw] ? `程度为${sev}` : `程度${sev}`);
        }

        const durationDetails = normalizeFeature(values.durationDetails);
        if (durationDetails) segments.push(durationDetails);

        const factors = normalizeFeature(values.factors);
        if (factors) segments.push(factors);

        return segments.join('，');
      })();

      const evolutionText = normalizeText(values.hpi_evolution ?? values.evolution).replace(/[。；，、]+$/u, '');
      const assocText = (() => {
        const detail = normalizeText(values.associatedSymptomsDetails).replace(/[。；，、]+$/u, '');
        if (detail) return detail.replace(/^伴有/u, '').trim();
        const assoc = (values.associatedSymptoms as unknown) as string[] | undefined;
        if (!Array.isArray(assoc) || assoc.length === 0) return '';
        const labels = assoc.map(a => normalizeText(a)).filter(Boolean);
        return labels.join('、');
      })();
      const negativeText = normalizeNegative(values.negativeSymptoms);

      const treatmentText = (() => {
        const raw = normalizeText(values.treatmentHistory);
        if (!raw) return '';

        const datePattern = /(\d{4})(?:\/|-|\.|年)(\d{1,2})(?:\/|-|\.|月)(\d{1,2})/u;

        const splitLines = (text: string): string[] => {
          const byLine = text
            .split('\n')
            .map(l => String(l || '').trim())
            .filter(Boolean);
          if (byLine.length > 1) return byLine;
          const single = byLine[0] || '';
          const sep = single.includes(',') ? ',' : single.includes('，') ? '，' : '';
          if (!sep) return byLine;
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
          const ts = new Date(dateText).getTime();
          return { dateText, ts: Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY };
        };

        const normalizeLine = (input: string): { line: string; ts: number } => {
          const trimmed = String(input || '').trim();
          if (!trimmed) return { line: '', ts: Number.POSITIVE_INFINITY };

          const stripped = trimmed.replace(/^记录\s*\d+\s*/u, '').replace(/^记录\d+\s*/u, '').trim();

          const bracket = stripped.match(/^\[(.*?)\]/u);
          if (bracket) {
            const date = String(bracket[1] || '').trim();
            const dateText = /^\d{4}-\d{1,2}-\d{1,2}/u.test(date)
              ? date.replace(/^(\d{4})-(\d{1,2})-(\d{1,2}).*$/u, (_, y, m, d) => normalizeDateText(y, m, d))
              : date;
            const content = stripped.substring(bracket[0].length).trim();
            const ts = dateText && /^\d{4}-\d{2}-\d{2}/u.test(dateText) ? new Date(dateText).getTime() : Number.POSITIVE_INFINITY;
            const line = `${dateText}${content ? ` ${content}` : ''}`.trim();
            return { line, ts: Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY };
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
            const instEsc = inst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            rest = rest
              .replace(new RegExp(`(?:^|[，,；;]\\s*)(?:于|在)${instEsc}(?=([，,；;]|$))`, 'u'), '')
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

      const generalSentence = (() => {
        const normalizeField = (
          val: unknown,
          field: 'spirit' | 'sleep' | 'appetite' | 'strength' | 'weight' | 'urine_stool'
        ): string => {
          const raw = normalizeText(val);
          if (!raw) return '';
          const map: Record<string, Record<string, string>> = {
            spirit: { good: '好', bad: '差', poor: '差', normal: '一般' },
            appetite: { normal: '正常', increased: '增加', decreased: '减退', poor: '差' },
            sleep: { normal: '正常', bad: '差', poor: '差' },
            strength: { normal: '正常', good: '好', bad: '差', poor: '差', weak: '减弱', decreased: '减弱', '正常': '正常', '尚可': '尚可', '减弱': '减弱' },
            weight: { no_change: '无变化', loss: '下降', decreased: '下降', gain: '增加', increased: '增加' },
            urine_stool: { normal: '正常', 'no abnormal': '无异常' },
          };
          return map[field]?.[raw] || raw;
        };

        const formatUrineStool = (val: unknown): string => {
          const raw = normalizeField(val, 'urine_stool').trim().replace(/。$/u, '');
          if (!raw) return '';
          if (/^(正常|无异常)$/u.test(raw)) return '无异常';
          if (/^大小便/u.test(raw)) return raw.replace(/^大小便/u, '').trim();
          return raw;
        };

        const generalLineRaw = normalizeText(values.general_line).replace(/[。；，、]+$/u, '');
        const base = (() => {
          if (!generalLineRaw) return '';
          if (/^一般情况[:：]/u.test(generalLineRaw)) return generalLineRaw.replace(/^一般情况[:：]\s*/u, '').trim();
          if (/^起病以来[，、]?/u.test(generalLineRaw)) return generalLineRaw.replace(/^起病以来[，、]?/u, '').trim();
          if (/^病程中[，、]?/u.test(generalLineRaw)) return generalLineRaw.replace(/^病程中[，、]?/u, '').trim();
          if (/^患者/u.test(generalLineRaw)) return generalLineRaw.replace(/^患者/u, '').replace(/^，/u, '').trim();
          return generalLineRaw.trim();
        })();
        if (base) {
          const spiritVal = normalizeField(values.spirit, 'spirit');
          const appetiteVal = normalizeField(values.appetite, 'appetite');
          const sleepVal = normalizeField(values.sleep, 'sleep');
          const strengthVal = normalizeField(values.strength, 'strength');
          const excretionRaw = formatUrineStool(values.urine_stool);
          const excretionVal = (() => {
            if (!excretionRaw) return '';
            const cleaned = String(excretionRaw).trim().replace(/^大小便/u, '').trim().replace(/^[:：]/u, '').trim();
            if (!cleaned) return '';
            if (/^(小便|大便|二便)/u.test(cleaned)) return cleaned;
            return `二便${cleaned}`;
          })();

          const weightRaw = normalizeField(values.weight, 'weight');
          const weightNorm = (weightRaw === '无变化' ? '无明显变化' : weightRaw) || '';
          const weightJinRaw = normalizeText((values as Record<string, unknown>).weight_change_jin);
          const weightJin = Number(weightJinRaw);
          const weightVal = (() => {
            if (!weightNorm) return '';
            if (/斤/u.test(weightNorm)) return weightNorm;
            if ((weightNorm === '下降' || weightNorm === '增加') && Number.isFinite(weightJin) && weightJin > 0) return `${weightNorm}${weightJin}斤`;
            return weightNorm;
          })();

          const normalizedBase = base
            .replace(/大小便[:：]\s*/gu, '')
            .replace(/体重变化/gu, '体重')
            .trim()
            .replace(/[。；，、]+$/u, '');

          const withWeightJin = (() => {
            if (!(Number.isFinite(weightJin) && weightJin > 0)) return normalizedBase;
            if (/体重(?:下降|增加)\d+斤/u.test(normalizedBase)) return normalizedBase;
            return normalizedBase.replace(/体重(下降|增加)(?!\d+斤)/u, (_m, dir) => `体重${dir}${weightJin}斤`);
          })();

          const extraParts: string[] = [];
          if (spiritVal && !/精神/u.test(withWeightJin)) extraParts.push(`精神${spiritVal}`);
          if (appetiteVal && !/食欲/u.test(withWeightJin)) extraParts.push(`食欲${appetiteVal}`);
          if (sleepVal && !/睡眠/u.test(withWeightJin)) extraParts.push(`睡眠${sleepVal}`);
          if (strengthVal && !/体力/u.test(withWeightJin)) extraParts.push(`体力${strengthVal}`);
          if (excretionVal && !/(小便|大便|二便|大小便)/u.test(withWeightJin)) extraParts.push(excretionVal);
          if (weightVal && !/体重/u.test(withWeightJin)) extraParts.push(`体重${weightVal}`);

          const merged = [withWeightJin, ...extraParts].filter(Boolean).join('、').replace(/[。；，、]+$/u, '');
          return `发病以来，患者${merged}。`.replace(/患者患者/gu, '患者');
        }

        const spirit = normalizeField(values.spirit, 'spirit') || '未详';
        const appetite = normalizeField(values.appetite, 'appetite') || '未详';
        const sleep = normalizeField(values.sleep, 'sleep') || '未详';
        const strength = normalizeField(values.strength, 'strength') || '未详';
        const excretionRaw = formatUrineStool(values.urine_stool);
        const excretion = (() => {
          if (!excretionRaw) return '二便未详';
          const cleaned = String(excretionRaw).trim().replace(/^大小便/u, '').trim().replace(/^[:：]/u, '').trim();
          if (!cleaned) return '二便未详';
          if (/^(小便|大便|二便)/u.test(cleaned)) return cleaned;
          return `二便${cleaned}`;
        })();
        const weightRaw = normalizeField(values.weight, 'weight');
        const weight = (weightRaw === '无变化' ? '无明显变化' : weightRaw) || '未详';
        const weightJinRaw = normalizeText((values as Record<string, unknown>).weight_change_jin);
        const weightJin = Number(weightJinRaw);
        const weightText = (() => {
          if (!weight || weight === '未详') return weight;
          if (/斤/u.test(weight)) return weight;
          if ((weight === '下降' || weight === '增加') && Number.isFinite(weightJin) && weightJin > 0) return `${weight}${weightJin}斤`;
          return weight;
        })();
        return `发病以来，患者精神${spirit}、体力${strength}、食欲${appetite}、睡眠${sleep}、${excretion}、体重${weightText}。`;
      })();

      const hpiLine1 = (() => {
        const modeClause = onsetModeText ? `${onsetModeText}性` : '';
        const symptomClause = symptomFeatures ? `${symptomCore}，${symptomFeatures}` : symptomCore;
        const triggerClause = triggerText ? (triggerText.endsWith('后') ? triggerText : `${triggerText}后`) : '无明显诱因后';
        const head = `患者${onsetTime}，在${triggerClause}${modeClause}起病，初起表现为${symptomClause}。`.replace(/，，/gu, '，');

        const evolutionClause = (() => {
          const ev = evolutionText;
          const assoc = assocText ? assocText.replace(/^并出现/u, '').replace(/^出现/u, '').trim() : '';
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
            const tailParts = [filteredAssoc ? `并出现${filteredAssoc}` : undefined, neg || undefined].filter(Boolean);
            const tail = tailParts.length > 0 ? `，${tailParts.join('，')}` : '';
            return ensureEnd(`${baseEv}${tail}`.replace(/[。；，、]+$/u, ''));
          }
          const tailParts = [assoc ? `出现${assoc}` : undefined, neg || undefined].filter(Boolean);
          if (tailParts.length === 0) return '';
          return ensureEnd(`随后，${tailParts.join('，')}`.replace(/[。；，、]+$/u, ''));
        })();

        const arrive = '为求进一步诊治，遂来我院就诊。';
        const dx = normalizeDx(values.admissionDiagnosis);
        const admit = dx ? `门诊以“${dx}”收入我科。` : '';
        return [head, evolutionClause, treatmentText, arrive, admit].filter(Boolean).join('');
      })();

      return `${INDENT}${hpiLine1}\n${INDENT}${generalSentence}`;
    };

    const ensureAdmissionDiagnosisOnFirstLine = (text: string, dx: string): string => {
      const t = String(text || '').trim();
      const normalizedDx = String(dx || '')
        .trim()
        .replace(/[“”"']/gu, '')
        .replace(/^门诊拟/u, '')
        .replace(/收入我科$/u, '')
        .replace(/[。；，、]+$/u, '')
        .trim();
      if (!t || !normalizedDx) return t;
      if (/门诊拟.*收入我科/u.test(t)) return t;
      const base = t.replace(/[。；，、]+$/u, '');
      return `${base}，门诊拟“${normalizedDx}”收入我科。`;
    };

    const mainSymptomForHpi =
      normalizeText(cp?.symptom) ||
      normalizeText(cp?.symptomName) ||
      (normalizeText(cp?.text) ? normalizeText(cp?.text).replace(/[。！？]+$/u, '') : '') ||
      '不适';

    const narrativeSource = normalizeText(pi?.narrativeSource);
    const builtPiText = buildHpiNarrative(toRecord(pi), mainSymptomForHpi);
    const piTextRaw =
      narrativeSource === 'auto' ? builtPiText : String(pi?.narrative || '').trimEnd() || builtPiText;
    const dx = normalizeText(pi?.admissionDiagnosis);
    const normalizedPiText = String(piTextRaw || '').trimEnd();

    if (!normalizedPiText) {
      report += `现病史：未记录。\n\n`;
    } else {
      report += `现病史：\n`;
      const hpiLines = normalizedPiText.replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\r/g, ''));
      for (const line of hpiLines) {
        const t = String(line || '');
        if (!t.trim()) continue;
        report += `${t.startsWith('  ') ? t : `  ${t.replace(/^\s+/u, '')}`}\n`;
      }
      report += `\n`;
    }

    const pmh = (session.pastHistory || {}) as any;
    report += `既往史：\n`;

    const surgeries = pmh?.surgeries;
    const surgeryItems: string[] = [];
    const traumaItems: string[] = [];
    const formatMonth = (v: unknown, fallback: string): string => {
      if (!v) return fallback;
      const d = new Date(v as any);
      if (Number.isNaN(d.getTime())) return fallback;
      return `${d.getFullYear()}年${d.getMonth() + 1}月`;
    };
    const isTraumaName = (name: string): boolean =>
      /外伤|创伤|骨折|车祸|跌倒|扭伤|撞伤|砸伤|刀伤|刺伤|烧伤|烫伤/u.test(name);
    if (Array.isArray(surgeries) && surgeries.length > 0) {
      surgeries.forEach((s: unknown) => {
        const r = toRecord(s);
        const dateText = normalizeText(r.date) ? formatMonth(r.date, '时间不详') : '时间不详';
        const location = normalizeText(r.location ?? r.hospital) || '外院';
        const name = normalizeText(r.name) || '不详';
        const outcome = normalizeText(r.outcome ?? r.note);
        const base = `${dateText}于${location}行“${name}”${outcome ? `，${outcome}` : ''}`.replace(/。$/u, '');
        if (isTraumaName(name)) traumaItems.push(base);
        else surgeryItems.push(base);
      });
    }
    const surgeryText = surgeryItems.length > 0 ? ensureSentenceEnd(surgeryItems.join('；')) : '否认手术史。';
    const traumaText = traumaItems.length > 0 ? ensureSentenceEnd(traumaItems.join('；')) : '否认外伤史。';
    report += `  手术史：${surgeryText}\n`;
    report += `  外伤史：${traumaText}\n`;

    const transfusions = pmh?.transfusions;
    if (Array.isArray(transfusions) && transfusions.length > 0) {
      const trans = transfusions
        .map((t: unknown) => {
          const r = toRecord(t);
          const dateText = normalizeText(r.date) ? formatDate(r.date, '时间不详') : '时间不详';
          const reason = normalizeText(r.reason);
          const amount = normalizeText(r.amount);
          const reaction = normalizeText(r.reaction) || '无不良反应';
          const reasonPart = reason ? `因${reason}` : '';
          const amountPart = amount ? `输${amount}` : '输血';
          return `${dateText}${reasonPart}${amountPart}，${reaction}`.replace(/。$/u, '');
        })
        .join('；');
      report += `  输血史：${ensureSentenceEnd(trans)}\n`;
    } else {
      report += `  输血史：否认输血史。\n`;
    }

    const allergies = pmh?.allergies;
    const noAllergies = Boolean(pmh?.noAllergies);
    if (Array.isArray(allergies) && allergies.length > 0) {
      const severityMap: Record<string, string> = { mild: '轻度', moderate: '中度', severe: '重度' };
      const algs = allergies
        .map((a: unknown) => {
          const r = toRecord(a);
          const allergen = normalizeText(r.allergen ?? r.substance) || '过敏原不详';
          const reaction = normalizeText(r.reaction);
          const severityRaw = normalizeText(r.severity);
          const severity = severityMap[severityRaw] || severityRaw;
          const extra = [reaction, severity].filter(Boolean).join('，');
          return extra ? `${allergen}（${extra}）` : allergen;
        })
        .join('、');
      report += `  过敏史：${ensureSentenceEnd(algs)}\n`;
    } else if (noAllergies) {
      report += `  过敏史：否认药物及食物过敏史。\n`;
    } else {
      report += `  过敏史：否认药物及食物过敏史。\n`;
    }

    const infectiousRaw = normalizeText(pmh?.infectiousHistory ?? pmh?.pmh_infectious);
    const infectiousText = infectiousRaw
      ? ensureSentenceEnd(infectiousRaw)
      : '否认肝炎、结核、梅毒、艾滋病等传染病史。';
    report += `  传染病史：${infectiousText}\n`;

    const diseases: string[] = Array.isArray(pmh?.pmh_diseases) ? pmh.pmh_diseases : [];
    const diseaseDetails = (pmh?.diseaseDetails || {}) as Record<string, { year?: number; control?: string; medication?: string }>;
    const systemicText = (() => {
      if (diseases.length > 0) {
        const diseaseTexts = diseases.map((d: string) => {
          const dd = diseaseDetails?.[d];
          const info: string[] = [];
          if (dd?.year) info.push(`确诊${dd.year}年`);
          if (dd?.control) info.push(`控制${dd.control}`);
          if (dd?.medication) info.push(`平日服用${dd.medication}`);
          return info.length > 0 ? `${d}（${info.join('，')}）` : d;
        });
        return ensureSentenceEnd(`既往患有${diseaseTexts.join('；')}`);
      }
      const illnessHistory = normalizeText(pmh?.illnessHistory);
      if (illnessHistory) return ensureSentenceEnd(illnessHistory.replace(/\n+/g, '；'));
      return '否认高血压、糖尿病、冠心病等慢性病史。';
    })();
    report += `  系统性疾病：${systemicText}\n`;

    const vaccination = normalizeText(pmh?.vaccinationHistory);
    if (vaccination) report += `  预防接种史：${ensureSentenceEnd(vaccination)}\n`;

    report += `\n【系统回顾】\n`;
      const ros = session.reviewOfSystems as any;
      
      const rosConfig = [
        { key: 'respiratory', label: '1. 呼吸系统' },
        { key: 'cardiovascular', label: '2. 循环系统' },
        { key: 'digestive', label: '3. 消化系统' },
        { key: 'urinary', label: '4. 泌尿系统' },
        { key: 'hematologic', label: '5. 血液系统' },
        { key: 'endocrine', label: '6. 内分泌及代谢系统' },
        { key: 'neurological', label: '7. 神经精神系统' },
        { key: 'musculoskeletal', label: '8. 肌肉骨骼系统' }
      ];

      if (ros && typeof ros === 'object') {
          let hasRos = false;
          
          for (const item of rosConfig) {
              const data = ros[item.key];
              if (!data) continue;

              let content = '';
              // Handle new structure { symptoms: [], details: '' }
              if (typeof data === 'object' && !Array.isArray(data)) {
                  const parts = [];
                  if (data.symptoms && Array.isArray(data.symptoms) && data.symptoms.length > 0) {
                      parts.push(`症状：${data.symptoms.join(', ')}`);
                  }
                  if (data.details) {
                      parts.push(`详情：${data.details}`);
                  }
                  if (parts.length > 0) {
                      content = parts.join('；');
                  }
              } 
              // Handle old structure string[]
              else if (Array.isArray(data) && data.length > 0) {
                  content = data.join(', ');
              }

              if (content) {
                  report += `${item.label}：${content}\n`;
                  hasRos = true;
              }
          }
          
          if (!hasRos) report += "无特殊异常\n";
      } else {
          report += "未记录\n";
      }
      
      report += `\n【个人史】\n`;
     const personal = session.personalHistory as any;
     if (personal && typeof personal === 'object') {
         // 1. 社会经历
         if (personal.social) {
             report += `1. 社会经历：${personal.social}\n`;
         }

         // 2. 职业及工作条件
         const occupation = (session as any).occupation || '未记录';
         const employer = (session as any).employer || '未记录';
         if (personal.work_cond || occupation !== '未记录' || employer !== '未记录') {
             report += `2. 职业及工作条件：\n`;
             if (occupation !== '未记录') report += `   职业：${occupation}  `;
             if (employer !== '未记录') report += `单位：${employer}`;
             if (occupation !== '未记录' || employer !== '未记录') report += '\n';
             if (personal.work_cond) report += `   工作环境/接触史：${personal.work_cond}\n`;
         }

         // 3. 习惯与嗜好
         let habits = [];
         if (personal.living_habits) habits.push(`起居饮食：${personal.living_habits}`);
         
         // Smoking
         const smokingStatus = personal.smoking_status || personal.smoking;
         if (smokingStatus) {
             let s = `吸烟：${smokingStatus}`;
             if (personal.smoking_details) s += ` (${personal.smoking_details})`;
             habits.push(s);
         }

         // Alcohol
         const alcoholStatus = personal.alcohol_status || personal.alcohol;
         if (alcoholStatus) {
             let a = `饮酒：${alcoholStatus}`;
             if (personal.alcohol_details) a += ` (${personal.alcohol_details})`;
             habits.push(a);
         }

         if (personal.substances) habits.push(`其他嗜好：${personal.substances}`);
         
         if (habits.length > 0) {
             report += `3. 习惯与嗜好：\n   ${habits.join('\n   ')}\n`;
         }

         // 4. 冶游史
         if (personal.sexual_history) {
             report += `4. 冶游史：${personal.sexual_history}\n`;
         }

         // Legacy 'other'
         if (personal.other && !personal.work_cond && !personal.living_habits) {
             report += `其他说明(旧)：${personal.other}\n`;
         }

     } else {
         report += "未记录\n";
     }

     report += `\n【婚姻史】\n`;
     const marital = session.maritalHistory as any;
     if (marital) {
         let mContent = `婚姻状况：${marital.status || '未记录'}`;
         if (marital.marriage_age) mContent += `，结婚年龄：${marital.marriage_age}岁`;
         if (marital.spouse_health) mContent += `，配偶健康状况：${marital.spouse_health}`;
         if (marital.children) mContent += `，子女情况：${marital.children}`; // In case added to marital structure
         report += `${mContent}\n`;
         
         if (marital.other) report += `说明：${marital.other}\n`;
     } else {
         report += "未记录\n";
     }

     const menstrual = session.menstrualHistory as any;
     const fertility = session.fertilityHistory as any;
     
     if (menstrual || fertility) {
         report += `\n【月经与生育史】\n`;
         
         if (menstrual) {
             // Format: Age Duration/Cycle LMP/Menopause
             const age = menstrual.age || '?';
             const duration = menstrual.duration || '?';
             const cycle = menstrual.cycle || '?';
             const lmpOrMenopause = menstrual.menopause_age 
                ? `${menstrual.menopause_age}岁(绝经)` 
                : (menstrual.lmp || '未知');
             
             // Formula style line
             report += `月经史：${age}  ${duration}/${cycle}  ${lmpOrMenopause}\n`;
             
             // Details line
             let details = [];
             if (menstrual.flow) details.push(`经量：${menstrual.flow}`);
             if (menstrual.color) details.push(`经色：${menstrual.color}`);
             if (menstrual.pain) details.push(`痛经/白带：${menstrual.pain}`);
             
             if (details.length > 0) {
                 report += `      ${details.join('，')}\n`;
             }
         }

         if (fertility) {
              let fLine = `生育史：G${fertility.gravida || '0'}P${fertility.para || '0'}`;
              if (fertility.abortion_artificial) fLine += `，人工流产${fertility.abortion_artificial}次`;
              if (fertility.abortion_natural) fLine += `，自然流产${fertility.abortion_natural}次`;
              report += `${fLine}\n`;
              
              if (fertility.stillbirth) report += `      死产/早产：${fertility.stillbirth}\n`;
              if (fertility.premature) report += `      早产：${fertility.premature}\n`;
              if (fertility.contraception) report += `      避孕措施：${fertility.contraception}\n`;
         }
     }

     report += `\n【家族史】\n`;
     const family = session.familyHistory as any;
     if (family) {
         let hasFamily = false;
         
         // 新字段支持
         if (family.father_health) { report += `父亲健康状况：${family.father_health}\n`; hasFamily = true; }
         if (family.mother_health) { report += `母亲健康状况：${family.mother_health}\n`; hasFamily = true; }
         if (family.siblings_health) { report += `兄弟姐妹健康状况：${family.siblings_health}\n`; hasFamily = true; }
         if (family.children_health) { report += `子女健康状况：${family.children_health}\n`; hasFamily = true; }
         if (family.genetic_disease) { report += `家族遗传病史：${family.genetic_disease}\n`; hasFamily = true; }
         if (family.similar_disease) { report += `类似疾病史：${family.similar_disease}\n`; hasFamily = true; }

         // 1. Relatives status (Legacy)
         if (family.parents) { report += `父母：${family.parents}\n`; hasFamily = true; }
         if (family.siblings) { report += `兄弟姐妹：${family.siblings}\n`; hasFamily = true; }
         if (family.children) { report += `子女：${family.children}\n`; hasFamily = true; }
         
         // 2. Genetic diseases (Legacy)
         let genetic = [];
         if (family.conditions && Array.isArray(family.conditions) && family.conditions.length > 0) {
             genetic.push(...family.conditions);
         }
         
         if (genetic.length > 0) {
             report += `家族遗传病史(旧)：${genetic.join('；')}\n`;
             hasFamily = true;
         }

         // 3. Deceased (if stored in separate field, currently maybe in parents/siblings text)
         if (family.deceased) {
             report += `已故亲属：${family.deceased}\n`;
             hasFamily = true;
         }

         if (family.other) {
             report += `说明：${family.other}\n`;
             hasFamily = true;
         }
         
         if (!hasFamily) {
              report += "未记录\n";
         }
     } else {
         report += "未记录\n";
     }

     report += `\n【初步建议】\n`;
    report += `建议进行进一步体格检查及相关辅助检查。`;

    res.json({ success: true, data: { report } });

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

/**
 * 获取会话列表
 */
export const getAllSessions = async (req: Request, res: Response) => {
    try {
        // 支持 limit/offset 与 page/pageSize
        const { limit, offset, page, pageSize, status, search } = req.query as Record<string, string>;
        let take = 10;
        let skip = 0;
        if (typeof limit === 'string') {
            take = Number(limit);
        } else if (typeof pageSize === 'string') {
            take = Number(pageSize);
        }
        if (typeof offset === 'string') {
            skip = Number(offset);
        } else if (typeof page === 'string') {
            const p = Number(page) || 1;
            skip = (p - 1) * take;
        }

        const where: any = {};
        
        // Status filtering
        if (status) {
            if (status === 'incomplete') {
                where.status = { notIn: ['archived', 'completed'] };
            } else if (status === 'completed') {
                where.status = { in: ['archived', 'completed'] };
            } else {
                where.status = status;
            }
        }

        // Search by patient name
        if (search) {
            where.patient = {
                name: {
                    contains: search,
                    mode: 'insensitive'
                }
            };
        }

        const sessions = await sessionService.getSessions({
            take,
            skip,
            where,
            orderBy: { createdAt: 'desc' }
        });
        const total = await sessionService.countSessions(where);
        res.json({ success: true, data: { items: sessions, total } });
    } catch (error) {
        console.error('Error getting sessions:', error);
        res.status(500).json({ success: false, message: 'Failed to get sessions' });
    }
};

/**
 * 获取仪表盘统计数据
 */
export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayCount = await sessionService.countSessions({
            createdAt: { gte: today }
        });

        const completedCount = await sessionService.countSessions({
            status: 'completed'
        });
        const archivedCount = await sessionService.countSessions({
            status: 'archived'
        });

        const recentSessions = await sessionService.getSessions({
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        const knowledgeCount = await knowledgeService.countKnowledge();
        const recentKnowledge = await knowledgeService.getRecentKnowledge(3);

        res.json({
            success: true,
            data: {
                todayCount,
                completedCount,
                archivedCount,
                recentSessions,
                knowledgeCount,
                recentKnowledge
            }
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Failed to get dashboard stats' });
    }
};

/**
 * 删除会话
 */
export const deleteSession = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await sessionService.deleteSession(Number(id));
        res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ success: false, message: 'Failed to delete session' });
    }
};

/**
 * 批量删除会话
 */
export const deleteSessionsBulk = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body as { ids: number[] };
        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ success: false, message: '缺少有效的ID列表' });
            return;
        }
        const normalizedIds = ids.map(Number).filter(id => Number.isFinite(id));
        console.log('[Controller] Bulk delete sessions ids:', normalizedIds);
        const result = await sessionService.deleteSessionsBulk(normalizedIds);
        res.json({ success: true, data: { deletedCount: result.count } });
    } catch (error) {
        console.error('Error bulk deleting sessions:', error);
        res.status(500).json({ success: false, message: 'Failed to bulk delete sessions' });
    }
};
