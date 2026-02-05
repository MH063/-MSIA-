import { Request, Response } from 'express';
import prisma from '../prisma';
import {
  generateDiagnosisSuggestions,
  getConfidenceDetails,
  initDiagnosisData,
} from '../services/diagnosis.service';

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

    // 从数据库获取症状映射
    const symptomKnowledge = await prisma.symptomKnowledge.findMany({
      where: { symptomKey: { in: assocKeys } },
      select: { symptomKey: true, displayName: true }
    });
    const assocNameByKey: Record<string, string> = Object.fromEntries(
      symptomKnowledge.map(s => [s.symptomKey, s.displayName])
    );

    const assocNames = assocKeys
      .map((k) => assocNameByKey[k])
      .filter(Boolean);
    const normalizedInputNames = Array.from(
      new Set([ccSymptom, ...assocNames, ...symptoms].filter(Boolean))
    );

    // 从数据库获取症状名称到key的映射
    const allSymptomKnowledge = await prisma.symptomKnowledge.findMany({
      select: { symptomKey: true, displayName: true }
    });
    const symptomNameToKey: Record<string, string> = Object.fromEntries(
      allSymptomKnowledge.map(s => [s.displayName, s.symptomKey])
    );

    const keys = normalizedInputNames.map((n) => symptomNameToKey[n] || n);

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

    // 从数据库获取症状分类信息
    const symptomCategories = await prisma.symptomKnowledge.findMany({
      where: { symptomKey: { in: keys } },
      select: { symptomKey: true, category: true, displayName: true }
    });

    const categoryMap: Record<string, string[]> = {};
    symptomCategories.forEach(s => {
      const cat = s.category || '其他';
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(s.displayName);
    });

    // 根据症状分类生成提示
    for (const [category, symptomNames] of Object.entries(categoryMap)) {
      if (symptomNames.length > 0) {
        hints.push(`${category}方向：请关注${symptomNames.slice(0, 3).join('、')}等症状的详细记录`);
      }
    }

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
