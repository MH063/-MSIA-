import { Request, Response } from 'express';
import * as knowledgeService from '../services/knowledge.service';
import { eventBus } from '../services/eventBus.service';
import prisma from '../prisma';

/**
 * 获取知识库列表
 */
export const getAllKnowledge = async (req: Request, res: Response) => {
  try {
    const { since } = req.query as Record<string, string>;
    if (since) {
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        res.status(400).json({ success: false, message: 'Invalid since parameter' });
        return;
      }
      const inc = await knowledgeService.getKnowledgeSince(sinceDate);
      res.json({ success: true, data: inc });
      return;
    }
    const list = await knowledgeService.getAllKnowledge();
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Error fetching knowledge list:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch knowledge list' });
  }
};

export const streamKnowledgeUpdates = async (_req: Request, res: Response) => {
  eventBus.addClient(res);
};

/**
 * 根据 Key 获取症状知识
 */
export const getKnowledgeByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params as any;
    const keyStr = Array.isArray(key) ? key[0] : key as string;
    const knowledge = await knowledgeService.getKnowledgeByKey(keyStr);
    if (!knowledge) {
      res.status(404).json({ success: false, message: 'Symptom knowledge not found' });
      return;
    }
    res.json({ success: true, data: knowledge });
  } catch (error) {
    console.error('Error fetching knowledge by key:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch symptom knowledge' });
  }
};

/**
 * 创建或更新知识
 */
export const upsertKnowledge = async (req: Request, res: Response) => {
  try {
    const knowledge = await knowledgeService.upsertKnowledge(req.body);
    res.json({ success: true, data: knowledge });
  } catch (error) {
    console.error('Error upserting knowledge:', error);
    res.status(500).json({ success: false, message: 'Failed to upsert knowledge' });
  }
};

/**
 * 删除单个症状知识
 */
export const deleteKnowledge = async (req: Request, res: Response) => {
  try {
    const { key } = req.params as any;
    const keyStr = Array.isArray(key) ? key[0] : key as string;
    const result = await knowledgeService.deleteKnowledgeByKey(keyStr);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({ success: false, message: 'Failed to delete symptom knowledge' });
  }
};

/**
 * 批量删除症状知识
 */
export const deleteKnowledgeBulk = async (req: Request, res: Response) => {
  try {
    const { keys } = req.body as any;
    if (!Array.isArray(keys) || keys.length === 0) {
      res.status(400).json({ success: false, message: 'keys (string[]) is required' });
      return;
    }
    const deletedCount = await knowledgeService.deleteKnowledgeBulk(keys.map(String));
    res.json({ success: true, data: { deletedCount } });
  } catch (error) {
    console.error('Error bulk deleting knowledge:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk delete symptom knowledge' });
  }
};

/**
 * 获取症状问诊要点映射列表
 * 从数据库动态获取，不再使用硬编码数据
 */
export const getSymptomMappings = async (req: Request, res: Response) => {
  try {
    const { category, priority, bodySystem, search } = req.query as Record<string, string>;

    // 从数据库查询症状知识
    const where: any = {};
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (bodySystem && bodySystem !== 'all') {
      where.bodySystems = {
        array_contains: bodySystem
      };
    }
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { symptomKey: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const knowledgeList = await prisma.symptomKnowledge.findMany({
      where,
      select: {
        id: true,
        symptomKey: true,
        displayName: true,
        category: true,
        priority: true,
        questions: true,
        physicalExamination: true,
        differentialPoints: true,
        associatedSymptoms: true,
        redFlags: true,
        // 扩展字段
        description: true,
        commonCauses: true,
        onsetPatterns: true,
        severityScale: true,
        relatedExams: true,
        imageUrl: true,
        bodySystems: true,
        ageGroups: true,
        prevalence: true,
        updatedAt: true,
      },
      orderBy: { priority: 'desc' },
    });

    // 转换为前端需要的格式
    const mappings = knowledgeList.map((k) => ({
      id: String(k.id),
      symptomKey: k.symptomKey,
      symptomName: k.displayName,
      category: k.category || '其他',
      priority: k.priority || 'medium',
      questions: (k.questions as string[]) || [],
      physicalExamination: (k.physicalExamination as string[]) || [],
      differentialPoints: (k.differentialPoints as string[]) || [],
      relatedSymptoms: (k.associatedSymptoms as string[]) || [],
      redFlags: (k.redFlags as string[]) || [],
      // 扩展字段
      description: k.description || '',
      commonCauses: (k.commonCauses as string[]) || [],
      onsetPatterns: (k.onsetPatterns as string[]) || [],
      severityScale: (k.severityScale as any[]) || [],
      relatedExams: (k.relatedExams as string[]) || [],
      imageUrl: k.imageUrl || '',
      bodySystems: (k.bodySystems as string[]) || [],
      ageGroups: (k.ageGroups as string[]) || [],
      prevalence: k.prevalence || 'common',
      updatedAt: k.updatedAt.toISOString(),
    }));

    res.json({ success: true, data: mappings });
  } catch (error) {
    console.error('Error fetching symptom mappings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch symptom mappings' });
  }
};

/**
 * 根据症状名称获取问诊要点
 * 从数据库动态获取
 */
export const getSymptomMappingByName = async (req: Request, res: Response) => {
  try {
    const { symptomName } = req.params;

    const name = Array.isArray(symptomName) ? symptomName[0] : symptomName;

    const knowledge = await prisma.symptomKnowledge.findFirst({
      where: {
        OR: [
          { displayName: name },
          { symptomKey: name },
        ],
      },
      select: {
        id: true,
        symptomKey: true,
        displayName: true,
        category: true,
        priority: true,
        questions: true,
        physicalExamination: true,
        differentialPoints: true,
        associatedSymptoms: true,
        redFlags: true,
        // 扩展字段
        description: true,
        commonCauses: true,
        onsetPatterns: true,
        severityScale: true,
        relatedExams: true,
        imageUrl: true,
        bodySystems: true,
        ageGroups: true,
        prevalence: true,
        updatedAt: true,
      },
    });

    if (!knowledge) {
      res.status(404).json({ success: false, message: 'Symptom mapping not found' });
      return;
    }

    const mapping = {
      id: String(knowledge.id),
      symptomKey: knowledge.symptomKey,
      symptomName: knowledge.displayName,
      category: knowledge.category || '其他',
      priority: knowledge.priority || 'medium',
      questions: (knowledge.questions as string[]) || [],
      physicalExamination: (knowledge.physicalExamination as string[]) || [],
      differentialPoints: (knowledge.differentialPoints as string[]) || [],
      relatedSymptoms: (knowledge.associatedSymptoms as string[]) || [],
      redFlags: (knowledge.redFlags as string[]) || [],
      // 扩展字段
      description: knowledge.description || '',
      commonCauses: (knowledge.commonCauses as string[]) || [],
      onsetPatterns: (knowledge.onsetPatterns as string[]) || [],
      severityScale: (knowledge.severityScale as any[]) || [],
      relatedExams: (knowledge.relatedExams as string[]) || [],
      imageUrl: knowledge.imageUrl || '',
      bodySystems: (knowledge.bodySystems as string[]) || [],
      ageGroups: (knowledge.ageGroups as string[]) || [],
      prevalence: knowledge.prevalence || 'common',
      updatedAt: knowledge.updatedAt.toISOString(),
    };

    res.json({ success: true, data: mapping });
  } catch (error) {
    console.error('Error fetching symptom mapping:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch symptom mapping' });
  }
};

/**
 * 获取疾病百科列表
 * 从数据库动态获取（使用 diagnoses 表）
 */
export const getDiseases = async (req: Request, res: Response) => {
  try {
    const { category } = req.query as Record<string, string>;
    
    const where: any = { isActive: true };
    if (category) where.category = category;
    
    const diagnoses = await prisma.diagnosis.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        symptoms: {
          select: {
            symptomKey: true,
            weight: true,
          },
        },
        redFlags: {
          select: {
            redFlagName: true,
            severityLevel: true,
          },
        },
        updatedAt: true,
      },
      orderBy: { priority: 'desc' },
    });

    // 转换为疾病百科格式
    const diseases = diagnoses.map((d) => ({
      id: String(d.id),
      name: d.name,
      aliases: [],
      category: d.category || '未分类',
      definition: d.description || '',
      symptoms: d.symptoms.map((s) => s.symptomKey),
      redFlags: d.redFlags.map((r) => r.redFlagName),
      updatedAt: d.updatedAt.toISOString(),
    }));

    res.json({ success: true, data: diseases });
  } catch (error) {
    console.error('Error fetching diseases:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch diseases' });
  }
};

/**
 * 根据疾病名称获取详情
 * 从数据库动态获取
 */
export const getDiseaseByName = async (req: Request, res: Response) => {
  try {
    const { diseaseName } = req.params as any;
    const nameStr = Array.isArray(diseaseName) ? String(diseaseName[0]) : String(diseaseName);
    
    const diagnosis = await prisma.diagnosis.findFirst({
      where: {
        name: nameStr,
        isActive: true,
      },
      include: {
        symptoms: true,
        redFlags: true,
      },
    });

    if (!diagnosis) {
      res.status(404).json({ success: false, message: 'Disease not found' });
      return;
    }

    const disease = {
      id: String(diagnosis.id),
      name: diagnosis.name,
      aliases: [],
      category: diagnosis.category || '未分类',
      definition: diagnosis.description || '',
      etiology: '',
      clinicalManifestations: diagnosis.symptoms.map((s) => s.symptomKey),
      diagnosisCriteria: [],
      treatment: '',
      prognosis: '',
      relatedDiseases: [],
      references: [],
      updatedAt: diagnosis.updatedAt.toISOString(),
    };

    res.json({ success: true, data: disease });
  } catch (error) {
    console.error('Error fetching disease:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch disease' });
  }
};
