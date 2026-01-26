import { Request, Response } from 'express';
import * as knowledgeService from '../services/knowledge.service';
import { eventBus } from '../services/eventBus.service';

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
