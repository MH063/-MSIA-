import { Request, Response } from 'express';
import prisma from '../prisma';
import {
  generateDiagnosisSuggestions,
  getConfidenceDetails,
  initDiagnosisData,
} from '../services/diagnosis.service';
import { SYMPTOM_NAME_TO_KEY } from '../services/mapping.service';

/**
 * suggestDiagnosis
 * 基于当前会话与症状知识库的实时信息生成"诊断方向"建议
 * 从数据库动态获取诊断规则，不再使用硬编码数据
 */
export const suggestDiagnosis = async (req: Request, res: Response) => {
  try {
    const { sessionId, symptoms, gender, age } = req.body as {
      sessionId?: number;
      symptoms?: string[];
      gender?: string;
      age?: number;
    };

    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.json({ success: true, data: [] });
    }

    if (typeof sessionId !== 'number' || !Number.isFinite(sessionId)) {
      return res
        .status(400)
        .json({ success: false, message: 'sessionId 必须为数字' });
    }

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        chiefComplaint: true,
        presentIllness: true,
        patient: { select: { gender: true, birthDate: true } },
      },
    });

    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: '会话不存在' });
    }

    const pi = (session.presentIllness || {}) as Record<string, unknown>;
    const cc = (session.chiefComplaint || {}) as Record<string, unknown>;
    const ccSymptom = (cc['symptom'] as string | undefined) || '';
    const assocKeys = (pi['associatedSymptoms'] as string[] | undefined) || [];

    const assocNameByKey: Record<string, string> = {
      fever: '发热',
      chills: '畏寒',
      sweating: '出汗',
      weight_loss: '消瘦（体重下降）',
      nausea: '恶心与呕吐',
      diarrhea: '腹泻',
      cough: '咳嗽',
      sputum: '咳痰',
      chest_pain: '胸痛',
      hematemesis: '上消化道出血',
      melena: '黑便',
      hemoptysis: '咯血',
      dizziness: '眩晕',
      headache: '头痛',
      palpitation: '心悸',
      dyspnea: '呼吸困难',
    };

    const assocNames = assocKeys
      .map((k) => assocNameByKey[k])
      .filter(Boolean);
    const normalizedInputNames = Array.from(
      new Set([ccSymptom, ...assocNames, ...symptoms].filter(Boolean))
    );
    const keys = normalizedInputNames.map((n) => SYMPTOM_NAME_TO_KEY[n] || n);

    const knowledgeItems = await prisma.symptomKnowledge.findMany({
      where: { symptomKey: { in: keys } },
      select: {
        symptomKey: true,
        displayName: true,
        associatedSymptoms: true,
        redFlags: true,
      },
    });

    const redFlagNames = new Set<string>();
    const relatedNames = new Set<string>();

    for (const item of knowledgeItems) {
      for (const r of (item.redFlags || []) as string[]) {
        if (r) redFlagNames.add(r);
      }
      for (const s of (item.associatedSymptoms || []) as string[]) {
        if (s) relatedNames.add(s);
      }
    }

    const hints: string[] = [];
    const hasResp = normalizedInputNames.some((n) =>
      ['咳嗽', '咳痰', '咯血', '胸痛', '呼吸困难', '发热', '盗汗'].includes(n)
    );
    const hasDigest = normalizedInputNames.some((n) =>
      ['腹痛', '腹泻', '恶心与呕吐', '上消化道出血', '黑便', '黄疸'].includes(n)
    );
    const hasNeuro = normalizedInputNames.some((n) =>
      ['头痛', '眩晕', '抽搐', '意识障碍'].includes(n)
    );

    if (hasResp)
      hints.push('呼吸系统方向：请结合发热/咳嗽/呼吸困难等完善病程与阴性症状记录');
    if (hasDigest)
      hints.push(
        '消化系统方向：注意呕血/黑便等提示出血风险，完善诱因与缓解因素'
      );
    if (hasNeuro)
      hints.push(
        '神经系统方向：结合起病方式与伴随症状（如抽搐/意识障碍）完善记录'
      );
    if (redFlagNames.size > 0)
      hints.unshift(`存在警惕征象：${Array.from(redFlagNames).join('、')}`);

    const related = Array.from(relatedNames).filter(
      (n) => !normalizedInputNames.includes(n)
    );
    if (related.length > 0) {
      hints.push(`常见鉴别症状：${related.slice(0, 8).join('、')}`);
    }

    return res.json({ success: true, data: hints.slice(0, 8) });
  } catch (error) {
    console.error('Diagnosis error:', error);
    res.status(500).json({ success: false, message: '生成诊断建议失败' });
  }
};

/**
 * suggestEnhancedDiagnosis
 * 增强版诊断建议接口
 * 从数据库动态获取诊断规则，返回症状关联图谱数据、诊断置信度评分
 */
export const suggestEnhancedDiagnosis = async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      currentSymptom,
      associatedSymptoms,
      redFlags,
      age,
      gender,
    } = req.body as {
      sessionId?: number;
      currentSymptom?: string;
      associatedSymptoms?: string[];
      redFlags?: string[];
      age?: number;
      gender?: string;
    };

    if (!currentSymptom) {
      return res.json({
        success: true,
        data: {
          diagnoses: [],
          confidenceDetails: [],
          symptomAssociations: [],
        },
      });
    }

    if (typeof sessionId !== 'number' || !Number.isFinite(sessionId)) {
      return res
        .status(400)
        .json({ success: false, message: 'sessionId 必须为数字' });
    }

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: '会话不存在' });
    }

    // 使用新的诊断服务从数据库获取诊断建议
    const { diagnoses, symptomAssociations } =
      await generateDiagnosisSuggestions(
        sessionId,
        currentSymptom,
        associatedSymptoms || [],
        redFlags || [],
        age,
        gender
      );

    // 生成置信度详情
    const confidenceDetails = await Promise.all(
      diagnoses.map(async (d) => {
        const details = await getConfidenceDetails(
          d.id,
          [...(associatedSymptoms || []), currentSymptom],
          redFlags || []
        );
        return {
          diagnosis: d.name,
          confidence: d.confidence,
          supportingEvidence: d.supportingSymptoms,
          conflictingEvidence: d.excludingSymptoms,
          missingEvidence: d.missingSymptoms,
          redFlags: d.redFlags,
          recommendation: d.recommendation,
        };
      })
    );

    console.log('[增强诊断] 生成诊断建议（从数据库）', {
      sessionId,
      currentSymptom,
      diagnosisCount: diagnoses.length,
      topDiagnosis: diagnoses[0]?.name,
    });

    return res.json({
      success: true,
      data: {
        diagnoses: diagnoses.map((d) => ({
          name: d.name,
          confidence: d.confidence,
          supportingSymptoms: d.supportingSymptoms,
          excludingSymptoms: d.excludingSymptoms,
          redFlags: d.redFlags,
          category: d.category,
        })),
        confidenceDetails,
        symptomAssociations,
      },
    });
  } catch (error) {
    console.error('Enhanced diagnosis error:', error);
    res.status(500).json({ success: false, message: '生成增强诊断建议失败' });
  }
};

/**
 * 初始化诊断数据
 * 将基础诊断数据导入数据库
 */
export const initializeDiagnosisData = async (req: Request, res: Response) => {
  try {
    await initDiagnosisData();
    res.json({ success: true, message: '诊断数据初始化完成' });
  } catch (error) {
    console.error('初始化诊断数据失败:', error);
    res.status(500).json({ success: false, message: '初始化失败' });
  }
};

/**
 * 获取所有诊断列表
 */
export const getAllDiagnoses = async (req: Request, res: Response) => {
  try {
    const diagnoses = await prisma.diagnosis.findMany({
      where: { isActive: true },
      include: {
        symptoms: true,
        redFlags: true,
      },
      orderBy: { priority: 'desc' },
    });

    res.json({ success: true, data: diagnoses });
  } catch (error) {
    console.error('获取诊断列表失败:', error);
    res.status(500).json({ success: false, message: '获取诊断列表失败' });
  }
};

/**
 * 根据ID获取诊断详情
 */
export const getDiagnosisById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const diagnosis = await prisma.diagnosis.findUnique({
      where: { id: Number(id) },
      include: {
        symptoms: true,
        redFlags: true,
      },
    });

    if (!diagnosis) {
      return res
        .status(404)
        .json({ success: false, message: '诊断不存在' });
    }

    res.json({ success: true, data: diagnosis });
  } catch (error) {
    console.error('获取诊断详情失败:', error);
    res.status(500).json({ success: false, message: '获取诊断详情失败' });
  }
};
