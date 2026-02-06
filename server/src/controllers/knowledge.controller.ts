import { Request, Response } from 'express';
import * as knowledgeService from '../services/knowledge.service';
import { secureLogger } from '../utils/secureLogger';

/**
 * 获取所有知识库条目
 */
export const getAllKnowledge = async (_req: Request, res: Response) => {
  try {
    const knowledge = await knowledgeService.getAllKnowledge();
    res.json({ success: true, data: knowledge });
  } catch (error) {
    secureLogger.error('[KnowledgeController] 获取知识库列表失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch knowledge' });
  }
};

/**
 * 获取知识库流式更新
 */
export const streamKnowledgeUpdates = async (_req: Request, res: Response) => {
  try {
    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // 发送初始数据
    const knowledge = await knowledgeService.getAllKnowledge();
    res.write(`data: ${JSON.stringify({ type: 'initial', data: knowledge })}\n\n`);
    
    // 保持连接打开
    const keepAlive = setInterval(() => {
      res.write(':keepalive\n\n');
    }, 30000);
    
    // 清理
    res.on('close', () => {
      clearInterval(keepAlive);
    });
  } catch (error) {
    secureLogger.error('[KnowledgeController] 流式获取知识库失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to stream knowledge' });
  }
};

/**
 * 获取症状映射列表
 */
export const getSymptomMappings = async (_req: Request, res: Response) => {
  try {
    const mappings = await knowledgeService.getSymptomMappings();
    res.json({ success: true, data: mappings });
  } catch (error) {
    secureLogger.error('[KnowledgeController] 获取症状映射失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch symptom mappings' });
  }
};

/**
 * 根据症状名称获取映射
 */
export const getSymptomMappingByName = async (req: Request, res: Response) => {
  try {
    const symptomName = String(req.params.symptomName);
    const mapping = await knowledgeService.getSymptomMappingByName(symptomName);
    if (!mapping) {
      res.status(404).json({ success: false, message: 'Symptom mapping not found' });
      return;
    }
    res.json({ success: true, data: mapping });
  } catch (error) {
    secureLogger.error('[KnowledgeController] 获取症状映射失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch symptom mapping' });
  }
};

/**
 * 获取疾病列表
 */
export const getDiseases = async (_req: Request, res: Response) => {
  try {
    const diseases = await knowledgeService.getDiseases();
    res.json({ success: true, data: diseases });
  } catch (error) {
    secureLogger.error('[KnowledgeController] 获取疾病列表失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch diseases' });
  }
};

/**
 * 根据疾病名称获取详情
 */
export const getDiseaseByName = async (req: Request, res: Response) => {
  try {
    const diseaseName = String(req.params.diseaseName);
    const disease = await knowledgeService.getDiseaseByName(diseaseName);
    if (!disease) {
      res.status(404).json({ success: false, message: 'Disease not found' });
      return;
    }
    res.json({ success: true, data: disease });
  } catch (error) {
    secureLogger.error('[KnowledgeController] 获取疾病详情失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch disease' });
  }
};

/**
 * 根据key获取知识库条目
 */
export const getKnowledgeByKey = async (req: Request, res: Response) => {
  try {
    const key = String(req.params.key);
    const knowledge = await knowledgeService.getKnowledgeByKey(key);
    if (!knowledge) {
      res.status(404).json({ success: false, message: 'Knowledge not found' });
      return;
    }
    res.json({ success: true, data: knowledge });
  } catch (error) {
    secureLogger.error('[KnowledgeController] 获取知识库条目失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch knowledge' });
  }
};

/**
 * 创建或更新知识库条目
 */
export const upsertKnowledge = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data.symptomKey) {
      res.status(400).json({ success: false, message: 'symptomKey is required' });
      return;
    }
    const knowledge = await knowledgeService.upsertKnowledge(data);
    res.json({ success: true, data: knowledge });
  } catch (error) {
    secureLogger.error('[KnowledgeController] 保存知识库条目失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to save knowledge' });
  }
};

/**
 * 删除知识库条目
 */
export const deleteKnowledge = async (req: Request, res: Response) => {
  try {
    const key = String(req.params.key);
    await knowledgeService.deleteKnowledgeByKey(key);
    res.json({ success: true });
  } catch (error) {
    secureLogger.error('[KnowledgeController] 删除知识库条目失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to delete knowledge' });
  }
};

/**
 * 批量删除知识库条目
 */
export const deleteKnowledgeBulk = async (req: Request, res: Response) => {
  try {
    const { keys } = req.body as { keys: string[] };
    if (!Array.isArray(keys) || keys.length === 0) {
      res.status(400).json({ success: false, message: 'Keys array is required' });
      return;
    }
    await knowledgeService.deleteKnowledgeBulk(keys);
    res.json({ success: true, data: { deletedCount: keys.length } });
  } catch (error) {
    secureLogger.error('[KnowledgeController] 批量删除知识库条目失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to delete knowledge' });
  }
};
