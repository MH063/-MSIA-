import { Request, Response } from 'express';
import * as sessionService from '../services/session.service';
import * as knowledgeService from '../services/knowledge.service';
import prisma from '../prisma';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { secureLogger } from '../utils/secureLogger';
import { validateRosData } from '../utils/rosSecurity';
import {
  validateSessionData,
  validateChiefComplaint,
  validatePresentIllness,
  validatePastHistory,
  validatePersonalHistory,
  validateFamilyHistory,
  validatePhysicalExam,
  validatePatientInfo,
  sanitizeObject,
} from '../utils/formSecurity';
import type { Patient, PhysicalExam, MenstrualHistory, FertilityHistory, FamilyHistory, MaritalHistory } from '../types';

// 统一类型别名 - 用于动态 JSON 数据
type JsonData = Record<string, unknown>;

/**
 * 会话数据类型定义
 */
interface SessionData {
  historian?: string;
  reliability?: string;
  historianRelationship?: string;
  generalInfo?: JsonData;
  chiefComplaint?: JsonData;
  presentIllness?: JsonData;
  pastHistory?: JsonData;
  personalHistory?: JsonData;
  maritalHistory?: JsonData;
  menstrualHistory?: JsonData;
  fertilityHistory?: JsonData;
  familyHistory?: JsonData;
  physicalExam?: PhysicalExam;
  specialistExam?: JsonData;
  auxiliaryExams?: JsonData;
  reviewOfSystems?: JsonData;
  status?: string;
  [key: string]: unknown;
}

/**
 * 患者数据类型定义
 */
interface PatientData {
  name?: string;
  gender?: string;
  birthDate?: Date;
  nativePlace?: string;
  placeOfBirth?: string;
  ethnicity?: string;
  address?: string;
  occupation?: string;
  employer?: string;
  contactInfo?: { phone?: string };
  [key: string]: unknown;
}

// 辅助函数：安全获取对象属性
const getValue = <T>(obj: unknown, key: string, defaultValue: T): T => {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return (obj as Record<string, unknown>)[key] as T ?? defaultValue;
  }
  return defaultValue;
};

// 辅助函数：安全转换为 Record
const toRecord = (v: unknown): JsonData => {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return v as JsonData;
  }
  return {};
};

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
    secureLogger.error('Error creating session:', error instanceof Error ? error : undefined);
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

    // 权限检查：只有管理员或创建该会话的医生可以访问
    const operator = req.operator;
    if (operator && operator.role === 'doctor' && session.doctorId !== operator.operatorId) {
      secureLogger.warn('[SessionController.getSession] 权限不足', {
        sessionId: session.id,
        doctorId: session.doctorId,
        operatorId: operator.operatorId,
      });
      res.status(403).json({ success: false, message: '无权访问该会话' });
      return;
    }

    secureLogger.info('[SessionController.getSession] 返回session概要', {
      id: session.id,
      hasPresentIllness: Boolean(session.presentIllness),
      presentIllnessKeys: session.presentIllness ? Object.keys(session.presentIllness as Record<string, unknown>) : [],
    });
    res.json({ success: true, data: session });
  } catch (error) {
    secureLogger.error('[SessionController.getSession] 获取session失败:', error instanceof Error ? error : undefined);
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

    secureLogger.info('[SessionController.updateSession] 接收到的数据概要', {
      id,
      keys: body && typeof body === 'object' ? Object.keys(body) : [],
    });

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

    const patientData: PatientData = {};
    const sessionData: SessionData = {};

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

    secureLogger.debug('[updateSession] 分离后的sessionData', { sessionDataKeys: Object.keys(sessionData) });

    // 2. 全面验证所有板块数据安全性
    const allValidationErrors: string[] = [];

    // 验证患者基本信息
    if (Object.keys(patientData).length > 0) {
      const patientValidation = validatePatientInfo(patientData);
      if (!patientValidation.valid) {
        allValidationErrors.push(...patientValidation.errors);
        secureLogger.warn('[updateSession] 患者信息验证失败', { errors: patientValidation.errors });
      }
      Object.assign(patientData, patientValidation.sanitized);
    }

    // 验证主诉
    if (sessionData.chiefComplaint) {
      const ccValidation = validateChiefComplaint(sessionData.chiefComplaint);
      if (!ccValidation.valid) {
        allValidationErrors.push(...ccValidation.errors);
        secureLogger.warn('[updateSession] 主诉验证失败', { errors: ccValidation.errors });
      }
      sessionData.chiefComplaint = ccValidation.sanitized;
    }

    // 验证现病史
    if (sessionData.presentIllness) {
      const piValidation = validatePresentIllness(sessionData.presentIllness);
      if (!piValidation.valid) {
        allValidationErrors.push(...piValidation.errors);
        secureLogger.warn('[updateSession] 现病史验证失败', { errors: piValidation.errors });
      }
      sessionData.presentIllness = piValidation.sanitized;
    }

    // 验证既往史
    if (sessionData.pastHistory) {
      const phValidation = validatePastHistory(sessionData.pastHistory);
      if (!phValidation.valid) {
        allValidationErrors.push(...phValidation.errors);
        secureLogger.warn('[updateSession] 既往史验证失败', { errors: phValidation.errors });
      }
      sessionData.pastHistory = phValidation.sanitized;
    }

    // 验证个人史
    if (sessionData.personalHistory) {
      const persValidation = validatePersonalHistory(sessionData.personalHistory);
      if (!persValidation.valid) {
        allValidationErrors.push(...persValidation.errors);
        secureLogger.warn('[updateSession] 个人史验证失败', { errors: persValidation.errors });
      }
      sessionData.personalHistory = persValidation.sanitized;
    }

    // 验证家族史
    if (sessionData.familyHistory) {
      const fhValidation = validateFamilyHistory(sessionData.familyHistory);
      if (!fhValidation.valid) {
        allValidationErrors.push(...fhValidation.errors);
        secureLogger.warn('[updateSession] 家族史验证失败', { errors: fhValidation.errors });
      }
      sessionData.familyHistory = fhValidation.sanitized;
    }

    // 验证体格检查
    if (sessionData.physicalExam) {
      const peValidation = validatePhysicalExam(sessionData.physicalExam);
      if (!peValidation.valid) {
        allValidationErrors.push(...peValidation.errors);
        secureLogger.warn('[updateSession] 体格检查验证失败', { errors: peValidation.errors });
      }
      sessionData.physicalExam = peValidation.sanitized as unknown as PhysicalExam;
    }

    // 验证系统回顾
    if (sessionData.reviewOfSystems) {
      const rosValidation = validateRosData(sessionData.reviewOfSystems);
      if (!rosValidation.valid) {
        allValidationErrors.push(...rosValidation.errors);
        secureLogger.warn('[updateSession] 系统回顾验证失败', { errors: rosValidation.errors });
      }
      sessionData.reviewOfSystems = rosValidation.sanitized;
    }

    // 验证其他字段（婚育史、月经史、辅助检查等）
    const otherFields = ['maritalHistory', 'menstrualHistory', 'fertilityHistory', 'specialistExam', 'auxiliaryExams', 'generalInfo'];
    for (const field of otherFields) {
      if (sessionData[field as keyof SessionData]) {
        const sanitized = sanitizeObject(sessionData[field as keyof SessionData] as Record<string, unknown>);
        sessionData[field as keyof SessionData] = sanitized as any;
      }
    }

    // 3. Update Session
    const session = await sessionService.updateSession(Number(id), sessionData as Record<string, unknown>);

    secureLogger.debug('[updateSession] 更新后的session', { sessionId: session.id });

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
    secureLogger.error('[SessionController.updateSession] 更新session失败', error instanceof Error ? error : undefined);
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

    const patient = session.patient as Patient;
    const chiefComplaint = session.chiefComplaint;
    const presentIllness = session.presentIllness;
    const cp = chiefComplaint as Record<string, unknown> | undefined;
    const pi = presentIllness as Record<string, unknown> | undefined;

    const ensureSentenceEnd = (text: unknown): string => {
      const t = String(text ?? '').trim();
      if (!t) {return '';}
      return /[。！？]$/u.test(t) ? t : `${t}。`;
    };

    const normalizeText = (v: unknown): string => {
      const t = String(v ?? '').trim();
      if (!t) {return '';}
      if (t === '-' || t === '—' || t === '无') {return '';}
      return t;
    };

    const formatDate = (v: unknown, fallback: string): string => {
      if (!v) {return fallback;}
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) {return fallback;}
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    };

    let report = `【基本信息】\n`;
    const ageText = patient.birthDate
      ? Math.floor((new Date().getTime() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) + '岁'
      : '未知';
    const generalItems: string[] = [];
    generalItems.push(`姓名：${patient.name || '未记录'}`);
    generalItems.push(`性别：${patient.gender || '未知'}`);
    generalItems.push(`年龄：${ageText}`);
    generalItems.push(`民族：${patient.ethnicity || '未记录'}`);
    generalItems.push(`婚况：${(session.maritalHistory as MaritalHistory | undefined)?.status || '未记录'}`);
    generalItems.push(`出生地：${patient.placeOfBirth || '未记录'}`);
    generalItems.push(`籍贯：${patient.nativePlace || '未记录'}`);
    generalItems.push(`职业：${patient.occupation || '未记录'}`);
    generalItems.push(`住址：${patient.address || '未记录'}`);
    generalItems.push(`入院日期：${new Date(session.createdAt).toLocaleDateString()}`);
    generalItems.push(`记录日期：${new Date().toLocaleDateString()}`);
    generalItems.push(`病史陈述者：${session.historian || '本人'}`);
    if (session.historianRelationship) {
      const relationMap: Record<string, string> = {
        'self': '本人',
        'spouse': '配偶',
        'parent': '父母',
        'child': '子女',
        'sibling': '兄弟姐妹',
        'other': '其他'
      };
      const relation = relationMap[session.historianRelationship] || session.historianRelationship;
      generalItems.push(`关系：${relation}`);
    }
    generalItems.push(`可靠程度：${session.reliability || '可靠'}`);
    report += `${generalItems.map(it => `  ${it}`).join('\n')}\n\n`;

    const ccText = ensureSentenceEnd(cp?.text || '未记录');
    report += `【主诉】\n  ${ccText}\n\n`;

    const buildHpiNarrative = (values: Record<string, unknown>, mainSymptom: string): string => {
      const INDENT = '  ';
      const ensureEnd = (text: string): string => {
        const t = String(text || '').trim();
        if (!t) {return '';}
        return /[。！？]$/u.test(t) ? t : `${t}。`;
      };

      const normalizeOnsetTime = (val: unknown): string => {
        const t = normalizeText(val);
        if (!t) {return '';}
        if (/^\d+(天|周|月|小时|分钟)$/u.test(t) && !/前$/.test(t)) {return `${t}前`;}
        return t;
      };

      const normalizeTrigger = (val: unknown): string => normalizeText(val) || '无明显诱因';

      const normalizeOnsetMode = (val: unknown): string => {
        const t = normalizeText(val);
        if (t === 'sudden') {return '急';}
        if (t === 'gradual') {return '缓';}
        return '';
      };

      const normalizeNegative = (val: unknown): string => {
        const raw = normalizeText(val).replace(/[。；，、]+$/u, '');
        if (!raw) {return '';}
        if (/^(无|否认)/u.test(raw)) {return raw;}
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
          if (!t) {return '';}
          if (/^(无|未详|不详|无明显)$/u.test(t)) {return '';}
          return t;
        };

        const segments: string[] = [];
        const qualityRaw = values.quality as unknown;
        if (Array.isArray(qualityRaw)) {
          const q = qualityRaw.map(normalizeText).filter(Boolean).join('、');
          if (q) {segments.push(`性质为${q}`);}
        } else {
          const q = normalizeText(qualityRaw);
          if (q) {segments.push(`性质为${q}`);}
        }

        const severityRaw = normalizeText(values.severity);
        if (severityRaw) {
          const severityMap: Record<string, string> = { mild: '轻度', moderate: '中度', severe: '重度' };
          const sev = severityMap[severityRaw] || severityRaw;
          segments.push(severityMap[severityRaw] ? `程度为${sev}` : `程度${sev}`);
        }

        const durationDetails = normalizeFeature(values.durationDetails);
        if (durationDetails) {segments.push(durationDetails);}

        const factors = normalizeFeature(values.factors);
        if (factors) {segments.push(factors);}

        return segments.join('，');
      })();

      const evolutionText = normalizeText(values.hpi_evolution ?? values.evolution).replace(/[。；，、]+$/u, '');
      const assocText = (() => {
        const detail = normalizeText(values.associatedSymptomsDetails).replace(/[。；，、]+$/u, '');
        if (detail) {return detail.replace(/^伴有/u, '').trim();}
        const assoc = (values.associatedSymptoms as unknown) as string[] | undefined;
        if (!Array.isArray(assoc) || assoc.length === 0) {return '';}
        const labels = assoc.map(a => normalizeText(a)).filter(Boolean);
        return labels.join('、');
      })();
      const negativeText = normalizeNegative(values.negativeSymptoms);

      const treatmentText = (() => {
        const raw = normalizeText(values.treatmentHistory);
        if (!raw) {return '';}

        const datePattern = /(\d{4})(?:\/|-|\.|年)(\d{1,2})(?:\/|-|\.|月)(\d{1,2})/u;

        const splitLines = (text: string): string[] => {
          const byLine = text
            .split('\n')
            .map(l => String(l || '').trim())
            .filter(Boolean);
          if (byLine.length > 1) {return byLine;}
          const single = byLine[0] || '';
          const sep = single.includes(',') ? ',' : single.includes('，') ? '，' : '';
          if (!sep) {return byLine;}
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
          if (!m) {return { dateText: '', ts: Number.POSITIVE_INFINITY };}
          const dateText = normalizeDateText(m[1], m[2], m[3]);
          const ts = new Date(dateText).getTime();
          return { dateText, ts: Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY };
        };

        const normalizeLine = (input: string): { line: string; ts: number } => {
          const trimmed = String(input || '').trim();
          if (!trimmed) {return { line: '', ts: Number.POSITIVE_INFINITY };}

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
          if (!cleaned) {return '';}

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
            if (!a) {return '';}
            if (/^(予以|予|给予|行)/u.test(a)) {return a;}
            if (/^(检查|检验|彩超|B超|CT|MRI|X线|血常规|尿常规|心电图|胸片)/u.test(a)) {return `行${a}`;}
            return `予${a}`;
          })();

          const head = `${prefixCengYu ? '曾于' : ''}${dateText || '不详时间'}${inst ? `在${inst}` : ''}就诊`;

          const tail = (() => {
            if (!outcome) {return '';}
            const core = outcome.replace(/^症状/u, '').trim();
            if (!core) {return '';}
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
          if (!raw) {return '';}
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
          if (!raw) {return '';}
          if (/^(正常|无异常)$/u.test(raw)) {return '无异常';}
          if (/^大小便/u.test(raw)) {return raw.replace(/^大小便/u, '').trim();}
          return raw;
        };

        const generalLineRaw = normalizeText(values.general_line).replace(/[。；，、]+$/u, '');
        const base = (() => {
          if (!generalLineRaw) {return '';}
          if (/^一般情况[:：]/u.test(generalLineRaw)) {return generalLineRaw.replace(/^一般情况[:：]\s*/u, '').trim();}
          if (/^起病以来[，、]?/u.test(generalLineRaw)) {return generalLineRaw.replace(/^起病以来[，、]?/u, '').trim();}
          if (/^病程中[，、]?/u.test(generalLineRaw)) {return generalLineRaw.replace(/^病程中[，、]?/u, '').trim();}
          if (/^患者/u.test(generalLineRaw)) {return generalLineRaw.replace(/^患者/u, '').replace(/^，/u, '').trim();}
          return generalLineRaw.trim();
        })();
        if (base) {
          const spiritVal = normalizeField(values.spirit, 'spirit');
          const appetiteVal = normalizeField(values.appetite, 'appetite');
          const sleepVal = normalizeField(values.sleep, 'sleep');
          const strengthVal = normalizeField(values.strength, 'strength');
          const excretionRaw = formatUrineStool(values.urine_stool);
          const excretionVal = (() => {
            if (!excretionRaw) {return '';}
            const cleaned = String(excretionRaw).trim().replace(/^大小便/u, '').trim().replace(/^[:：]/u, '').trim();
            if (!cleaned) {return '';}
            if (/^(小便|大便|二便)/u.test(cleaned)) {return cleaned;}
            return `二便${cleaned}`;
          })();

          const weightRaw = normalizeField(values.weight, 'weight');
          const weightNorm = (weightRaw === '无变化' ? '无明显变化' : weightRaw) || '';
          const weightJinRaw = normalizeText((values as Record<string, unknown>).weight_change_jin);
          const weightJin = Number(weightJinRaw);
          const weightVal = (() => {
            if (!weightNorm) {return '';}
            if (/斤/u.test(weightNorm)) {return weightNorm;}
            if ((weightNorm === '下降' || weightNorm === '增加') && Number.isFinite(weightJin) && weightJin > 0) {return `${weightNorm}${weightJin}斤`;}
            return weightNorm;
          })();

          const normalizedBase = base
            .replace(/大小便[:：]\s*/gu, '')
            .replace(/体重变化/gu, '体重')
            .trim()
            .replace(/[。；，、]+$/u, '');

          const withWeightJin = (() => {
            if (!(Number.isFinite(weightJin) && weightJin > 0)) {return normalizedBase;}
            if (/体重(?:下降|增加)\d+斤/u.test(normalizedBase)) {return normalizedBase;}
            return normalizedBase.replace(/体重(下降|增加)(?!\d+斤)/u, (_m, dir) => `体重${dir}${weightJin}斤`);
          })();

          const extraParts: string[] = [];
          if (spiritVal && !/精神/u.test(withWeightJin)) {extraParts.push(`精神${spiritVal}`);}
          if (appetiteVal && !/食欲/u.test(withWeightJin)) {extraParts.push(`食欲${appetiteVal}`);}
          if (sleepVal && !/睡眠/u.test(withWeightJin)) {extraParts.push(`睡眠${sleepVal}`);}
          if (strengthVal && !/体力/u.test(withWeightJin)) {extraParts.push(`体力${strengthVal}`);}
          if (excretionVal && !/(小便|大便|二便|大小便)/u.test(withWeightJin)) {extraParts.push(excretionVal);}
          if (weightVal && !/体重/u.test(withWeightJin)) {extraParts.push(`体重${weightVal}`);}

          const merged = [withWeightJin, ...extraParts].filter(Boolean).join('、').replace(/[。；，、]+$/u, '');
          return `发病以来，患者${merged}。`.replace(/患者患者/gu, '患者');
        }

        const spirit = normalizeField(values.spirit, 'spirit') || '未详';
        const appetite = normalizeField(values.appetite, 'appetite') || '未详';
        const sleep = normalizeField(values.sleep, 'sleep') || '未详';
        const strength = normalizeField(values.strength, 'strength') || '未详';
        const excretionRaw = formatUrineStool(values.urine_stool);
        const excretion = (() => {
          if (!excretionRaw) {return '二便未详';}
          const cleaned = String(excretionRaw).trim().replace(/^大小便/u, '').trim().replace(/^[:：]/u, '').trim();
          if (!cleaned) {return '二便未详';}
          if (/^(小便|大便|二便)/u.test(cleaned)) {return cleaned;}
          return `二便${cleaned}`;
        })();
        const weightRaw = normalizeField(values.weight, 'weight');
        const weight = (weightRaw === '无变化' ? '无明显变化' : weightRaw) || '未详';
        const weightJinRaw = normalizeText((values as Record<string, unknown>).weight_change_jin);
        const weightJin = Number(weightJinRaw);
        const weightText = (() => {
          if (!weight || weight === '未详') {return weight;}
          if (/斤/u.test(weight)) {return weight;}
          if ((weight === '下降' || weight === '增加') && Number.isFinite(weightJin) && weightJin > 0) {return `${weight}${weightJin}斤`;}
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
          if (!ev && !assoc && !neg) {return '';}
          if (ev) {
            const cleanedEv = ev.replace(/[。；，、]+$/u, '');
            const filteredAssoc = (() => {
              if (!assoc) {return '';}
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
          if (tailParts.length === 0) {return '';}
          return ensureEnd(`随后，${tailParts.join('，')}`.replace(/[。；，、]+$/u, ''));
        })();

        const arrive = '为求进一步诊治，遂来我院就诊。';
        const dx = normalizeDx(values.admissionDiagnosis);
        const admit = dx ? `门诊以“${dx}”收入我科。` : '';
        return [head, evolutionClause, treatmentText, arrive, admit].filter(Boolean).join('');
      })();

      return `${INDENT}${hpiLine1}\n${INDENT}${generalSentence}`;
    };

    const _ensureAdmissionDiagnosisOnFirstLine = (text: string, dx: string): string => {
      const t = String(text || '').trim();
      const normalizedDx = String(dx || '')
        .trim()
        .replace(/[“”"']/gu, '')
        .replace(/^门诊拟/u, '')
        .replace(/收入我科$/u, '')
        .replace(/[。；，、]+$/u, '')
        .trim();
      if (!t || !normalizedDx) {return t;}
      if (/门诊拟.*收入我科/u.test(t)) {return t;}
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
    const _dx = normalizeText(pi?.admissionDiagnosis);
    const normalizedPiText = String(piTextRaw || '').trimEnd();

    if (!normalizedPiText) {
      report += `【现病史】\n  未记录。\n\n`;
    } else {
      report += `【现病史】\n`;
      const hpiLines = normalizedPiText.replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\r/g, ''));
      for (const line of hpiLines) {
        const t = String(line || '');
        if (!t.trim()) {continue;}
        report += `${t.startsWith('  ') ? t : `  ${t.replace(/^\s+/u, '')}`}\n`;
      }
      report += `\n`;
    }

    const pmh = (session.pastHistory || {}) as Record<string, unknown>;
    report += `【既往史】\n`;

    const surgeries = pmh.surgeries as unknown[] | undefined;
    const surgeryItems: string[] = [];
    const traumaItems: string[] = [];
    const formatMonth = (v: unknown, fallback: string): string => {
      if (!v) {return fallback;}
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) {return fallback;}
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
        if (isTraumaName(name)) {traumaItems.push(base);}
        else {surgeryItems.push(base);}
      });
    }
    const surgeryText = surgeryItems.length > 0 ? ensureSentenceEnd(surgeryItems.join('；')) : '否认手术史。';
    const traumaText = traumaItems.length > 0 ? ensureSentenceEnd(traumaItems.join('；')) : '否认外伤史。';
    report += `  手术史：${surgeryText}\n`;
    report += `  外伤史：${traumaText}\n`;

    const transfusions = getValue(pmh, 'transfusions', undefined) as unknown[] | undefined;
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

    const allergies = getValue(pmh, 'allergies', undefined) as unknown[] | undefined;
    const noAllergies = Boolean(getValue(pmh, 'noAllergies', false));
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

    const infectiousRaw = normalizeText(getValue(pmh, 'infectiousHistory', undefined) ?? getValue(pmh, 'pmh_infectious', undefined));
    const infectiousText = infectiousRaw
      ? ensureSentenceEnd(infectiousRaw)
      : '否认肝炎、结核、梅毒、艾滋病等传染病史。';
    report += `  传染病史：${infectiousText}\n`;

    const diseases: string[] = Array.isArray(getValue(pmh, 'pmh_diseases', undefined)) ? getValue(pmh, 'pmh_diseases', []) as string[] : [];
    const diseaseDetails = getValue(pmh, 'diseaseDetails', {}) as Record<string, { year?: number; control?: string; medication?: string }>;
    const systemicText = (() => {
      if (diseases.length > 0) {
        const diseaseTexts = diseases.map((d: string) => {
          const dd = diseaseDetails?.[d];
          const info: string[] = [];
          if (dd?.year) {info.push(`确诊${dd.year}年`);}
          if (dd?.control) {info.push(`控制${dd.control}`);}
          if (dd?.medication) {info.push(`平日服用${dd.medication}`);}
          return info.length > 0 ? `${d}（${info.join('，')}）` : d;
        });
        return ensureSentenceEnd(`既往患有${diseaseTexts.join('；')}`);
      }
      const illnessHistory = normalizeText(pmh?.illnessHistory);
      if (illnessHistory) {return ensureSentenceEnd(illnessHistory.replace(/\n+/g, '；'));}
      return '否认高血压、糖尿病、冠心病等慢性病史。';
    })();
    report += `  系统性疾病：${systemicText}\n`;

    const vaccination = normalizeText(pmh?.vaccinationHistory);
    if (vaccination) {report += `  预防接种史：${ensureSentenceEnd(vaccination)}\n`;}

    report += `\n【系统回顾】\n`;
      const ros = session.reviewOfSystems;
      
      // 症状英文到中文的映射
      const symptomNameMap: Record<string, string> = {
        // 呼吸系统
        'chest_pain': '胸痛',
        'chest pain': '胸痛',
        'chestPain': '胸痛',
        'cough': '咳嗽',
        'dyspnea': '呼吸困难',
        'shortness_of_breath': '呼吸困难',
        'shortness of breath': '呼吸困难',
        'hemoptysis': '咯血',
        'wheezing': '喘息',
        'sputum': '咳痰',
        // 循环系统
        'palpitation': '心悸',
        'edema': '水肿',
        'syncope': '晕厥',
        'chest_tightness': '胸闷',
        'chest tightness': '胸闷',
        // 消化系统
        'abdominal_pain': '腹痛',
        'abdominal pain': '腹痛',
        'nausea': '恶心',
        'vomiting': '呕吐',
        'diarrhea': '腹泻',
        'constipation': '便秘',
        'melena': '黑便',
        'hematemesis': '呕血',
        'jaundice': '黄疸',
        'bloating': '腹胀',
        'poor_appetite': '食欲不振',
        'poor appetite': '食欲不振',
        // 泌尿系统
        'dysuria': '排尿困难',
        'frequency': '尿频',
        'urgency': '尿急',
        'hematuria': '血尿',
        'oliguria': '少尿',
        'polyuria': '多尿',
        'urinary_incontinence': '尿失禁',
        'urinary incontinence': '尿失禁',
        // 血液系统
        'anemia': '贫血',
        'bleeding': '出血',
        'bruising': '瘀斑',
        // 内分泌及代谢
        'polydipsia': '多饮',
        'polyphagia': '多食',
        'weight_loss': '体重下降',
        'weight loss': '体重下降',
        'weight_gain': '体重增加',
        'weight gain': '体重增加',
        'fever': '发热',
        'night_sweats': '盗汗',
        'night sweats': '盗汗',
        // 神经精神
        'headache': '头痛',
        'dizziness': '头晕',
        'insomnia': '失眠',
        'anxiety': '焦虑',
        'depression': '抑郁',
        'seizure': '抽搐',
        'weakness': '乏力',
        'numbness': '麻木',
        // 肌肉骨骼
        'joint_pain': '关节痛',
        'joint pain': '关节痛',
        'muscle_pain': '肌肉痛',
        'muscle pain': '肌肉痛',
        'back_pain': '背痛',
        'back pain': '背痛',
        'neck_pain': '颈痛',
        'neck pain': '颈痛',
        'limb_pain': '肢体痛',
        'limb pain': '肢体痛',
        'arthritis': '关节炎',
        'fracture': '骨折',
        // 其他常见症状
        'fatigue': '疲劳',
        'malaise': '不适',
        'chills': '寒战',
        'rash': '皮疹',
        'itching': '瘙痒',
      };
      
      const translateSymptom = (symptom: string): string => {
        const normalized = symptom.toLowerCase().trim();
        return symptomNameMap[normalized] || symptomNameMap[symptom] || symptom;
      };
      
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
          const rosData = ros as JsonData;
          
          for (const item of rosConfig) {
              const data = rosData[item.key];
              if (!data) {continue;}

              let content = '';
              // Handle new structure { symptoms: [], details: '' }
              if (typeof data === 'object' && !Array.isArray(data)) {
                  const dataObj = data as JsonData;
                  const parts = [];
                  if (dataObj.symptoms && Array.isArray(dataObj.symptoms) && dataObj.symptoms.length > 0) {
                      // 翻译症状名称为中文
                      const translatedSymptoms = (dataObj.symptoms as string[]).map((s: string) => translateSymptom(s));
                      parts.push(`症状：${translatedSymptoms.join('、')}`);
                  }
                  if (dataObj.details) {
                      parts.push(`详情：${dataObj.details}`);
                  }
                  if (parts.length > 0) {
                      content = parts.join('；');
                  }
              } 
              // Handle old structure string[]
              else if (Array.isArray(data) && data.length > 0) {
                  // 翻译症状名称为中文
                  const translatedSymptoms = data.map((s: string) => translateSymptom(s));
                  content = translatedSymptoms.join('、');
              }

              if (content) {
                  report += `${item.label}：${content}\n`;
                  hasRos = true;
              }
          }
          
          if (!hasRos) {report += "无特殊异常\n";}
      } else {
          report += "未记录\n";
      }
      
      report += `\n【个人史】\n`;
     const personal = session.personalHistory as JsonData | undefined;
     if (personal && typeof personal === 'object') {
         // 1. 社会经历
         if (personal.social) {
             report += `1. 社会经历：${personal.social}\n`;
         }

         // 2. 职业及工作条件
         const occupation = session.patient?.occupation || '未记录';
         const employer = (session.patient as { employer?: string })?.employer || '未记录';
         if (personal.work_cond || occupation !== '未记录' || employer !== '未记录') {
             report += `2. 职业及工作条件：\n`;
             if (occupation !== '未记录') {report += `   职业：${occupation}  `;}
             if (employer !== '未记录') {report += `单位：${employer}`;}
             if (occupation !== '未记录' || employer !== '未记录') {report += '\n';}
             if (personal.work_cond) {report += `   工作环境/接触史：${personal.work_cond}\n`;}
         }

         // 3. 习惯与嗜好
        const habits = [];
        if (personal.living_habits) {habits.push(`起居饮食：${personal.living_habits}`);}
         
         // Smoking
         const smokingStatus = personal.smoking_status || personal.smoking;
         if (smokingStatus) {
             let s = `吸烟：${smokingStatus}`;
             if (personal.smoking_details) {s += ` (${personal.smoking_details})`;}
             habits.push(s);
         }

         // Alcohol
         const alcoholStatus = personal.alcohol_status || personal.alcohol;
         if (alcoholStatus) {
             let a = `饮酒：${alcoholStatus}`;
             if (personal.alcohol_details) {a += ` (${personal.alcohol_details})`;}
             habits.push(a);
         }

         if (personal.substances) {habits.push(`其他嗜好：${personal.substances}`);}
         
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
     const marital = session.maritalHistory as MaritalHistory | undefined;
     if (marital) {
         let mContent = `婚姻状况：${marital.status || '未记录'}`;
         if (marital.marriage_age) {mContent += `，结婚年龄：${marital.marriage_age}岁`;}
         if (marital.spouse_health) {mContent += `，配偶健康状况：${marital.spouse_health}`;}
         if (marital.children) {mContent += `，子女情况：${marital.children}`;} // In case added to marital structure
         report += `${mContent}\n`;
         
         if (marital.other) {report += `说明：${marital.other}\n`;}
     } else {
         report += "未记录\n";
     }

     const menstrual = session.menstrualHistory as MenstrualHistory | undefined;
     const fertility = session.fertilityHistory as FertilityHistory | undefined;
     
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
            const details = [];
            if (menstrual.flow) {details.push(`经量：${menstrual.flow}`);}
            if (menstrual.color) {details.push(`经色：${menstrual.color}`);}
            if (menstrual.pain) {details.push(`痛经/白带：${menstrual.pain}`);}
             
             if (details.length > 0) {
                 report += `      ${details.join('，')}\n`;
             }
         }

         if (fertility) {
              let fLine = `生育史：G${fertility.gravida || '0'}P${fertility.para || '0'}`;
              if (fertility.abortion_artificial) {fLine += `，人工流产${fertility.abortion_artificial}次`;}
              if (fertility.abortion_natural) {fLine += `，自然流产${fertility.abortion_natural}次`;}
              report += `${fLine}\n`;
              
              if (fertility.stillbirth) {report += `      死产/早产：${fertility.stillbirth}\n`;}
              if (fertility.premature) {report += `      早产：${fertility.premature}\n`;}
              if (fertility.contraception) {report += `      避孕措施：${fertility.contraception}\n`;}
         }
     }

     report += `\n【家族史】\n`;
     const family = session.familyHistory as FamilyHistory | undefined;
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
        const genetic = [];
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

     // 体格检查
     report += `\n【体格检查】\n`;
     const physicalExam = session.physicalExam as PhysicalExam & { vitalSigns?: Record<string, unknown>; general?: Record<string, unknown> } | undefined;
     if (physicalExam) {
         let hasPhysical = false;
         
         // 生命体征（支持 vitalSigns 和 general 两种格式）
         const vitalSigns = physicalExam.vitalSigns || physicalExam.general;
         if (vitalSigns) {
             const v = vitalSigns;
             const items: string[] = [];
             
             // 体温
             const temp = v.temperature || v.temp || v.t;
             if (temp) {items.push(`体温：${temp}°C`);}
             
             // 脉搏/心率
             const pulse = v.pulse || v.heartRate || v.heart_rate || v.hr || v.p;
             if (pulse) {items.push(`脉搏：${pulse}次/分`);}
             
             // 呼吸
             const resp = v.respiration || v.respiratoryRate || v.respiratory_rate || v.rr || v.r;
             if (resp) {items.push(`呼吸：${resp}次/分`);}
             
             // 血压 - 支持多种格式
             let bp = v.bloodPressure || v.bp || v.blood_pressure;
             // 如果没有直接的血压字段，尝试组合收缩压和舒张压
             if (!bp && (v.systolic || v.diastolic || v.sbp || v.dbp || v.systolicBP || v.diastolicBP)) {
                 const systolic = v.systolic || v.sbp || v.systolicBP;
                 const diastolic = v.diastolic || v.dbp || v.diastolicBP;
                 if (systolic && diastolic) {
                     bp = `${systolic}/${diastolic}`;
                 } else if (systolic) {
                     bp = `${systolic}/`;
                 } else if (diastolic) {
                     bp = `/${diastolic}`;
                 }
             }
             if (bp) {items.push(`血压：${bp}mmHg`);}
             
             // 体重
             const weight = v.weight || v.wt;
             if (weight) {items.push(`体重：${weight}kg`);}
             
             // 身高
             const height = v.height || v.ht;
             if (height) {items.push(`身高：${height}cm`);}
             
             // BMI
             const bmi = v.BMI || v.bmi;
             if (bmi) {items.push(`BMI：${bmi}`);}
             
             // 血氧饱和度
             const spo2 = v.spo2 || v.SpO2 || v.oxygenSaturation || v.oxygen_saturation || v.o2sat;
             if (spo2) {items.push(`血氧饱和度：${spo2}%`);}
             
             // 疼痛评分
             const painScore = v.painScore !== undefined ? v.painScore : (v.pain_score !== undefined ? v.pain_score : v.pain);
             if (painScore !== undefined && painScore !== null) {items.push(`疼痛评分：${painScore}分`);}
             
             if (items.length > 0) {
                 report += `生命体征：${items.join('，')}\n`;
                 hasPhysical = true;
             }
             
             // 一般情况
             const generalCondition = v.generalAppearance || v.consciousness || v.conscious || v.general_condition || v.status;
             if (generalCondition) {
                 report += `一般情况：${generalCondition}\n`;
                 hasPhysical = true;
             }
         }
         
         // 皮肤黏膜
         if (physicalExam.skin && typeof physicalExam.skin === 'string') {
             report += `皮肤黏膜：${physicalExam.skin}\n`;
             hasPhysical = true;
         }
         
         // 淋巴结
         if (physicalExam.lymphNodes && typeof physicalExam.lymphNodes === 'string') {
             report += `淋巴结：${physicalExam.lymphNodes}\n`;
             hasPhysical = true;
         }
         
         // 头部
         if (physicalExam.head && typeof physicalExam.head === 'string') {
             report += `头部：${physicalExam.head}\n`;
             hasPhysical = true;
         }
         
         // 颈部
         if (physicalExam.neck && typeof physicalExam.neck === 'string') {
             report += `颈部：${physicalExam.neck}\n`;
             hasPhysical = true;
         }
         
         // 胸部
         if (physicalExam.chest && typeof physicalExam.chest === 'string') {
             report += `胸部：${physicalExam.chest}\n`;
             hasPhysical = true;
         }
         
         // 心脏
         if (physicalExam.heart && typeof physicalExam.heart === 'string') {
             report += `心脏：${physicalExam.heart}\n`;
             hasPhysical = true;
         }
         
         // 肺部
         if (physicalExam.lungs && typeof physicalExam.lungs === 'string') {
             report += `肺部：${physicalExam.lungs}\n`;
             hasPhysical = true;
         }
         
         // 腹部
         if (physicalExam.abdomen && typeof physicalExam.abdomen === 'string') {
             report += `腹部：${physicalExam.abdomen}\n`;
             hasPhysical = true;
         }
         
         // 四肢
         if (physicalExam.extremities && typeof physicalExam.extremities === 'string') {
             report += `四肢：${physicalExam.extremities}\n`;
             hasPhysical = true;
         }
         
         // 神经系统
         if (physicalExam.nervousSystem && typeof physicalExam.nervousSystem === 'string') {
             report += `神经系统：${physicalExam.nervousSystem}\n`;
             hasPhysical = true;
         }
         
         // 其他
         if (physicalExam.other && typeof physicalExam.other === 'string') {
             report += `其他：${physicalExam.other}\n`;
             hasPhysical = true;
         }
         
         if (!hasPhysical) {
             report += "未记录\n";
         }
     } else {
         report += "未记录\n";
     }

     // 辅助检查
     report += `\n【辅助检查】\n`;
     const auxiliaryExams = session.auxiliaryExams;
     
     // 辅助检查类型中文映射
     const examTypeMap: Record<string, string> = {
       'blood_routine': '血常规',
       'bloodRoutine': '血常规',
       'blood': '血常规',
       'urine_routine': '尿常规',
       'urineRoutine': '尿常规',
       'urine': '尿常规',
       'stool': '大便常规',
       'stool_routine': '大便常规',
       'liver_function': '肝功能',
       'liverFunction': '肝功能',
       'renal_function': '肾功能',
       'renalFunction': '肾功能',
       'electrolyte': '电解质',
       'blood_lipid': '血脂',
       'bloodLipid': '血脂',
       'blood_sugar': '血糖',
       'bloodSugar': '血糖',
       'coagulation': '凝血功能',
       'cardiac_marker': '心肌标志物',
       'cardiacMarker': '心肌标志物',
       'inflammation': '炎症指标',
       'tumor_marker': '肿瘤标志物',
       'tumorMarker': '肿瘤标志物',
       'thyroid': '甲状腺功能',
       'ecg': '心电图',
       'EKG': '心电图',
       'chest_xray': '胸部X线',
       'chestXray': '胸部X线',
       'xray': 'X线',
       'ct': 'CT',
       'CT': 'CT',
       'mri': 'MRI',
       'MRI': 'MRI',
       'ultrasound': '超声',
       'B超': '超声',
       'gastroscopy': '胃镜',
       'colonoscopy': '肠镜',
       'bronchoscopy': '支气管镜',
       'pathology': '病理检查',
       'biopsy': '活检',
       'culture': '细菌培养',
       'virus': '病毒检测',
       'autoimmune': '自身免疫指标',
       'allergy_test': '过敏原检测',
       'drug_level': '药物浓度',
       'blood_gas': '血气分析',
       'bone_marrow': '骨髓穿刺',
       'lp': '腰椎穿刺',
       'lumbar_puncture': '腰椎穿刺',
     };
     
     const translateExamType = (type: string): string => {
       return examTypeMap[type] || type;
     };
     
     /**
     * 辅助检查项目接口
     */
    interface ExamItem {
      type?: string;
      examType?: string;
      name?: string;
      category?: string;
      result?: unknown;
      date?: string;
      examDate?: string;
      [key: string]: unknown;
    }

    // 格式化辅助检查结果，避免显示 [object Object]
    const formatExamResult = (value: unknown): string => {
      if (value === null || value === undefined) {return '未记录结果';}
      if (typeof value === 'string') {return value;}
      if (typeof value === 'number' || typeof value === 'boolean') {return String(value);}
      if (Array.isArray(value)) {
        return value.map(item => formatExamResult(item)).join('；');
      }
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        // 提取对象中的关键字段
        const parts: string[] = [];
        if (obj.result !== undefined) {parts.push(formatExamResult(obj.result));}
        if (obj.value !== undefined) {parts.push(formatExamResult(obj.value));}
        if (obj.content !== undefined) {parts.push(formatExamResult(obj.content));}
        if (obj.description !== undefined) {parts.push(formatExamResult(obj.description));}
        if (obj.finding !== undefined) {parts.push(formatExamResult(obj.finding));}
        if (obj.conclusion !== undefined) {parts.push(formatExamResult(obj.conclusion));}
        if (obj.diagnosis !== undefined) {parts.push(formatExamResult(obj.diagnosis));}
        if (parts.length > 0) {return parts.join('；');}
        // 如果没有标准字段，尝试提取所有非空值
        const entries = Object.entries(obj)
          .filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'id' && k !== 'createdAt' && k !== 'updatedAt')
          .map(([k, v]) => `${k}: ${formatExamResult(v)}`);
        if (entries.length > 0) {return entries.join('；');}
        return '已检查';
      }
      return String(value);
    };
     
     if (auxiliaryExams && Array.isArray(auxiliaryExams) && auxiliaryExams.length > 0) {
        auxiliaryExams.forEach((exam: unknown, index: number) => {
            if (typeof exam === 'string') {
              report += `${index + 1}. ${exam}\n`;
            } else if (exam && typeof exam === 'object') {
              const examItem = exam as ExamItem;
              const examType = examItem.type || examItem.examType || examItem.name || examItem.category || `检查${index + 1}`;
              const examName = translateExamType(examType);
              const examResult = formatExamResult(examItem.result !== undefined ? examItem.result : exam);
              const examDate = examItem.date || examItem.examDate ? `(${(examItem.date || examItem.examDate)})` : '';
              report += `${index + 1}. ${examName}${examDate}：${examResult}\n`;
            }
        });
    } else if (auxiliaryExams && typeof auxiliaryExams === 'object') {
        // 处理对象格式的辅助检查数据
        const exams = Object.entries(auxiliaryExams as Record<string, unknown>);
        if (exams.length > 0) {
            let index = 0;
            exams.forEach(([key, value]: [string, unknown]) => {
                // 过滤掉无意义的键
                if (key === 'none' || key === 'exams' || key === 'id' || key === 'createdAt' || key === 'updatedAt') {return;}
                if (value === null || value === undefined || value === '') {return;}
                if (typeof value === 'boolean' && value === true) {
                  // 如果值只是 true，显示为"已检查"
                  index++;
                  const examName = translateExamType(key);
                  report += `${index}. ${examName}：已检查\n`;
                  return;
                }
                const examName = translateExamType(key);
                const examResult = formatExamResult(value);
                if (examResult && examResult !== '未记录结果' && examResult !== 'true') {
                  index++;
                  report += `${index}. ${examName}：${examResult}\n`;
                }
            });
            if (index === 0) {
              report += "未记录\n";
            }
        } else {
            report += "未记录\n";
        }
    } else {
        report += "未记录\n";
    }

     report += `\n【初步建议】\n`;
    report += `建议进行进一步体格检查及相关辅助检查。`;

    res.json({ success: true, data: { report } });

  } catch (error) {
    secureLogger.error('[SessionController.generateReport] 生成报告失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

/**
 * sanitizeDownloadFilename
 * 生成安全的下载文件名（过滤Windows不允许字符，限制长度）
 */
function sanitizeDownloadFilename(name: string): string {
  const raw = String(name || '').trim() || '病历';
  return raw
    .replace(/[\\/:*?"<>|]/gu, '_')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 120);
}

function formatDateForFilename(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function buildAttachmentContentDisposition(filename: string): string {
  const safe = String(filename || '').trim() || 'download';
  const dot = safe.lastIndexOf('.');
  const ext = dot > 0 && dot >= safe.length - 10 ? safe.slice(dot) : '';
  const base = ext ? safe.slice(0, dot) : safe;

  const asciiBase = sanitizeDownloadFilename(base)
    .replace(/[^\x20-\x7E]/gu, '_')
    .replace(/["\r\n]/gu, '_')
    .trim();

  const fallbackBase = asciiBase.replace(/_+/gu, '_').replace(/^_+|_+$/gu, '');
  const fallback = (fallbackBase || 'download') + ext;
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

/**
 * resolvePdfFontPath
 * 在不同操作系统上尝试找到可用的中文字体文件路径，供PDF生成使用
 */
function resolvePdfFontPath(): string | null {
  const candidates = [
    // 优先使用 TTF，避免部分库不支持 TTC
    'C:/Windows/Fonts/simhei.ttf',
    'C:/Windows/Fonts/msyh.ttf',
    'C:/Windows/Fonts/simkai.ttf',
    'C:/Windows/Fonts/simfang.ttf',
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/simsun.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/arphic/ukai.ttc',
    '/System/Library/Fonts/PingFang.ttc',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {return p;}
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * buildPdfBuffer
 * 将纯文本病历内容渲染为PDF并返回Buffer（服务端内存生成，不落盘）
 * 使用嵌入中文字体确保中文正确显示
 */
async function buildPdfBuffer(params: { title: string; text: string }): Promise<Buffer> {
  const { title, text } = params;
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: { Title: title },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // 注册中文字体
    const fontPath = resolvePdfFontPath();
    let fontRegistered = false;
    
    if (fontPath) {
      try {
        // 注册字体供后续使用
        doc.registerFont('ChineseFont', fontPath);
        fontRegistered = true;
        secureLogger.info('[export.pdf] 中文字体注册成功', { fontPath });
      } catch (e) {
        secureLogger.warn('[export.pdf] 字体注册失败，将使用默认字体', { fontPath, error: e instanceof Error ? e.message : String(e) });
      }
    } else {
      secureLogger.warn('[export.pdf] 未找到可用中文字体，可能导致中文无法正常显示');
    }

    // 使用注册的字体或默认字体
    const fontToUse = fontRegistered ? 'ChineseFont' : undefined;
    
    // 标题
    if (fontToUse) {
      doc.font(fontToUse).fontSize(18).text(title, { align: 'center' });
    } else {
      doc.fontSize(18).text(title, { align: 'center' });
    }
    
    doc.moveDown(1);
    
    // 内容 - 逐行处理以支持换行
    const lines = String(text || '').split(/\r?\n/gu);
    const contentFontSize = 11;
    
    for (const line of lines) {
      if (fontToUse) {
        doc.font(fontToUse).fontSize(contentFontSize).fillColor('#111');
      } else {
        doc.fontSize(contentFontSize).fillColor('#111');
      }
      
      // 处理空行
      if (line.trim() === '') {
        doc.moveDown(0.5);
      } else {
        doc.text(line, {
          align: 'left',
          lineGap: 4,
          continued: false,
        });
      }
    }
    
    doc.end();
  });
}

/**
 * buildDocxBuffer
 * 将纯文本病历内容渲染为Word(docx)并返回Buffer（服务端内存生成，不落盘）
 * 优化格式以匹配预览界面
 */
async function buildDocxBuffer(params: { title: string; text: string }): Promise<Buffer> {
  const { title, text } = params;
  const lines = String(text || '').split(/\r?\n/gu);
  
  // 构建段落列表，处理空行和格式
  const paragraphs: Paragraph[] = [];
  
  // 添加标题
  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 36 })],
      spacing: { after: 200 },
      alignment: 'center',
    })
  );
  
  // 添加分隔线
  paragraphs.push(
    new Paragraph({
      children: [],
      border: {
        bottom: {
          color: '999999',
          space: 1,
          style: 'single',
          size: 6,
        },
      },
      spacing: { after: 200 },
    })
  );
  
  // 处理内容行
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 空行处理
    if (trimmedLine === '') {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: ' ', size: 22 })],
          spacing: { after: 100 },
        })
      );
      continue;
    }
    
    // 检测是否是标题行（以【】或[]包裹的内容）
    const isSectionTitle = /^(?:【[^【】]+】|\[[^\]]+])$/.test(trimmedLine);
    // 检测是否是小标题（以数字或特定符号开头）
    const isSubTitle = /^(\d+[.．、]|[-•·])/.test(trimmedLine);
    
    if (isSectionTitle) {
      // 章节标题
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: trimmedLine, bold: true, size: 26 })],
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (isSubTitle) {
      // 小标题
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: trimmedLine, bold: true, size: 24 })],
          spacing: { before: 100, after: 50 },
          indent: { left: 200 },
        })
      );
    } else {
      // 普通内容
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: trimmedLine, size: 22 })],
          spacing: { after: 50 },
          indent: { left: 200 },
        })
      );
    }
  }
  
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch = 1440 twips
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });
  
  const buf = await Packer.toBuffer(doc);
  return Buffer.from(buf);
}

/**
 * getReportTextForExport
 * 复用现有 generateReport 的逻辑，得到报告纯文本（用于导出PDF/Word）
 */
type ExportErrorBody = { success: false; message: string };
type CapturedBody = { success?: boolean; data?: { report?: string } } | { success: false; message: string } | null;

async function getReportTextForExport(sessionId: number): Promise<{ ok: true; report: string } | { ok: false; status: number; body: ExportErrorBody }> {
  const fakeReq = { params: { id: String(sessionId) } } as unknown as Request;
  const captured: { status: number; body: CapturedBody } = { status: 200, body: null };
  const fakeRes = {
    status(code: number) {
      captured.status = code;
      return fakeRes;
    },
    json(payload: unknown) {
      captured.body = payload as { success?: boolean; data?: { report?: string } };
      return fakeRes;
    },
  } as unknown as Response;

  await generateReport(fakeReq, fakeRes);

  if (captured.status >= 400 || !captured.body?.success) {
    const errorBody = captured.body;
    const message = errorBody && typeof errorBody === 'object' && 'message' in errorBody 
      ? String(errorBody.message) 
      : '生成报告失败';
    return { ok: false, status: captured.status || 500, body: { success: false, message } };
  }

  const report = String((captured.body as { data?: { report?: string } })?.data?.report || '').trim();
  if (!report) {
    return { ok: false, status: 500, body: { success: false, message: '报告为空' } };
  }

  return { ok: true, report };
}

/**
 * exportReportPdf
 * 导出指定会话的病历报告PDF文件流
 */
export const exportReportPdf = async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      res.status(400).json({ success: false, message: 'id 必须为正整数' });
      return;
    }

    const reportRes = await getReportTextForExport(sessionId);
    if (!reportRes.ok) {
      res.status(reportRes.status).json(reportRes.body);
      return;
    }

    const session = await sessionService.getSessionById(sessionId);
    const patientName = String(session?.patient?.name || '').trim() || '未命名';
    const title = `病历-${patientName}-${formatDateForFilename(new Date())}`;
    const filename = sanitizeDownloadFilename(title) + '.pdf';

    secureLogger.info('[export.pdf] 开始生成', { sessionId, filename });
    const pdf = await buildPdfBuffer({ title, text: reportRes.report });
    secureLogger.info('[export.pdf] 生成完成', { sessionId, bytes: pdf.byteLength });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildAttachmentContentDisposition(filename));
    res.status(200).end(pdf);
  } catch (error) {
    secureLogger.error('[export.pdf] 导出失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: '导出PDF失败' });
  }
};

/**
 * exportReportDocx
 * 导出指定会话的病历报告Word(docx)文件流
 */
export const exportReportDocx = async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      res.status(400).json({ success: false, message: 'id 必须为正整数' });
      return;
    }

    const reportRes = await getReportTextForExport(sessionId);
    if (!reportRes.ok) {
      res.status(reportRes.status).json(reportRes.body);
      return;
    }

    const session = await sessionService.getSessionById(sessionId);
    const patientName = String(session?.patient?.name || '').trim() || '未命名';
    const title = `病历-${patientName}-${formatDateForFilename(new Date())}`;
    const filename = sanitizeDownloadFilename(title) + '.docx';

    secureLogger.info('[export.docx] 开始生成', { sessionId, filename });
    const docx = await buildDocxBuffer({ title, text: reportRes.report });
    secureLogger.info('[export.docx] 生成完成', { sessionId, bytes: docx.byteLength });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', buildAttachmentContentDisposition(filename));
    res.status(200).end(docx);
  } catch (error) {
    secureLogger.error('[export.docx] 导出失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: '导出Word失败' });
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

        const where: Record<string, unknown> = {};
        
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
        secureLogger.error('[SessionController.getAllSessions] 获取会话列表失败', error instanceof Error ? error : undefined);
        res.status(500).json({ success: false, message: 'Failed to get sessions' });
    }
};

/**
 * 获取仪表盘统计数据
 */
export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const since = new Date(todayStart);
        since.setDate(since.getDate() - 6);

        const [
            todayCount,
            completedCount,
            archivedCount,
            totalSessions,
            totalPatients,
            recentSessions,
            statusGroup,
            knowledgeCount,
            recentKnowledge,
            sessionsDailyRaw,
            completedDailyRaw,
        ] = await Promise.all([
            sessionService.countSessions({ createdAt: { gte: todayStart } }),
            sessionService.countSessions({ status: 'completed' }),
            sessionService.countSessions({ status: 'archived' }),
            sessionService.countSessions(),
            prisma.patient.count(),
            sessionService.getSessions({ take: 5, orderBy: { createdAt: 'desc' } }),
            prisma.interviewSession.groupBy({ by: ['status'], _count: { _all: true } }),
            knowledgeService.countKnowledge(),
            knowledgeService.getRecentKnowledge(3),
            prisma.$queryRaw<Array<{ date: Date; count: number }>>`
                SELECT DATE(created_at) as date, COUNT(*)::int as count
                FROM interview_sessions
                WHERE created_at >= ${since}
                GROUP BY DATE(created_at)
                ORDER BY DATE(created_at) ASC;
            `,
            prisma.$queryRaw<Array<{ date: Date; count: number }>>`
                SELECT DATE(created_at) as date, COUNT(*)::int as count
                FROM interview_sessions
                WHERE created_at >= ${since} AND status = 'completed'
                GROUP BY DATE(created_at)
                ORDER BY DATE(created_at) ASC;
            `,
        ]);

        const statusCounts: Record<string, number> = {};
        for (const row of statusGroup) {
            statusCounts[String(row.status)] = Number(row._count?._all || 0);
        }

        const fmt = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const dailyMap = (rows: Array<{ date: Date; count: number }>) => {
            const map = new Map<string, number>();
            for (const r of rows) {map.set(fmt(new Date(r.date)), Number(r.count || 0));}
            return map;
        };
        const sessionsDailyMap = dailyMap(sessionsDailyRaw);
        const completedDailyMap = dailyMap(completedDailyRaw);

        const last7DaysSessions: Array<{ date: string; count: number }> = [];
        const last7DaysCompleted: Array<{ date: string; count: number }> = [];
        for (let i = 0; i < 7; i += 1) {
            const d = new Date(since);
            d.setDate(since.getDate() + i);
            const key = fmt(d);
            last7DaysSessions.push({ date: key, count: sessionsDailyMap.get(key) ?? 0 });
            last7DaysCompleted.push({ date: key, count: completedDailyMap.get(key) ?? 0 });
        }

        res.json({
            success: true,
            data: {
                todayCount,
                completedCount,
                archivedCount,
                totalSessions,
                totalPatients,
                statusCounts,
                last7DaysSessions,
                last7DaysCompleted,
                recentSessions,
                knowledgeCount,
                recentKnowledge,
            }
        });
    } catch (error) {
        secureLogger.error('[SessionController.getDashboardStats] 获取仪表盘统计失败', error instanceof Error ? error : undefined);
        res.status(500).json({ success: false, message: 'Failed to get dashboard stats' });
    }
};

/**
 * 删除会话
 */
export const deleteSession = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const sessionId = Number(id);
        const operator = req.operator;
        if (!operator) {
            res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '缺少操作人信息' } });
            return;
        }

        const result = await sessionService.deleteSessionPermanently({ sessionId, operator });
        res.json({ success: true, data: { deletedId: result.deletedId } });
    } catch (error) {
        secureLogger.error('[SessionController.deleteSession] 删除会话失败', error instanceof Error ? error : undefined);
        const err = error as { statusCode?: number; errorCode?: string; message?: string };
        const statusCode = Number(err?.statusCode) || 500;
        const code = String(err?.errorCode || 'INTERNAL_ERROR');
        const message = String(err?.message || '删除失败');
        res.status(statusCode).json({ success: false, error: { code, message } });
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
        const operator = req.operator;
        if (!operator) {
            res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '缺少操作人信息' } });
            return;
        }
        if (operator.role !== 'admin') {
            res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '仅管理员可批量永久删除' } });
            return;
        }
        const normalizedIds = ids.map(Number).filter(id => Number.isFinite(id));
        secureLogger.info('[SessionController.deleteSessionsBulk] 批量删除会话', { count: normalizedIds.length });
        let deletedCount = 0;
        for (const sessionId of normalizedIds) {
            await sessionService.deleteSessionPermanently({ sessionId, operator });
            deletedCount += 1;
        }
        res.json({ success: true, data: { deletedCount } });
    } catch (error) {
        secureLogger.error('[SessionController.deleteSessionsBulk] 批量删除会话失败', error instanceof Error ? error : undefined);
        res.status(500).json({ success: false, message: 'Failed to bulk delete sessions' });
    }
};
