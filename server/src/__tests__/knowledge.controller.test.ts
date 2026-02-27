import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import * as knowledgeController from '../controllers/knowledge.controller';

// Mock dependencies
vi.mock('../services/knowledge.service', () => ({
  getAllKnowledge: vi.fn(),
  getSymptomMappings: vi.fn(),
  getSymptomMappingByName: vi.fn(),
  getDiseases: vi.fn(),
  getDiseaseByName: vi.fn(),
  getKnowledgeByKey: vi.fn(),
  upsertKnowledge: vi.fn(),
  deleteKnowledgeByKey: vi.fn(),
  deleteKnowledgeBulk: vi.fn(),
}));

vi.mock('../utils/secureLogger', () => ({
  secureLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as knowledgeService from '../services/knowledge.service';

const mockService = knowledgeService as unknown as {
  getAllKnowledge: ReturnType<typeof vi.fn>;
  getSymptomMappings: ReturnType<typeof vi.fn>;
  getSymptomMappingByName: ReturnType<typeof vi.fn>;
  getDiseases: ReturnType<typeof vi.fn>;
  getDiseaseByName: ReturnType<typeof vi.fn>;
  getKnowledgeByKey: ReturnType<typeof vi.fn>;
  upsertKnowledge: ReturnType<typeof vi.fn>;
  deleteKnowledgeByKey: ReturnType<typeof vi.fn>;
  deleteKnowledgeBulk: ReturnType<typeof vi.fn>;
};

describe('KnowledgeController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockWrite: ReturnType<typeof vi.fn>;
  let mockSetHeader: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockJson = vi.fn().mockReturnThis();
    mockStatus = vi.fn().mockReturnThis();
    mockWrite = vi.fn().mockReturnThis();
    mockSetHeader = vi.fn().mockReturnThis();
    mockOn = vi.fn();

    mockReq = {
      params: {},
      body: {},
      headers: {},
    };

    mockRes = {
      json: mockJson,
      status: mockStatus,
      write: mockWrite,
      setHeader: mockSetHeader,
      on: mockOn,
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getAllKnowledge', () => {
    it('应该成功返回知识库列表', async () => {
      const mockData = [
        { symptomKey: 'headache', displayName: '头痛' },
        { symptomKey: 'fever', displayName: '发热' },
      ];
      mockService.getAllKnowledge.mockResolvedValueOnce(mockData);

      await knowledgeController.getAllKnowledge(mockReq as Request, mockRes as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });

    it('应该在服务出错时返回500', async () => {
      mockService.getAllKnowledge.mockRejectedValueOnce(new Error('Database error'));

      await knowledgeController.getAllKnowledge(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch knowledge',
      });
    });
  });

  describe('getSymptomMappings', () => {
    it('应该成功返回症状映射列表', async () => {
      const mockData = {
        nameToKey: { '头痛': 'headache', '发热': 'fever' },
        keyToName: { 'headache': '头痛', 'fever': '发热' },
      };
      mockService.getSymptomMappings.mockResolvedValueOnce(mockData);

      await knowledgeController.getSymptomMappings(mockReq as Request, mockRes as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });

    it('应该在服务出错时返回500', async () => {
      mockService.getSymptomMappings.mockRejectedValueOnce(new Error('Database error'));

      await knowledgeController.getSymptomMappings(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
    });
  });

  describe('getSymptomMappingByName', () => {
    it('应该成功返回症状映射', async () => {
      const mockData = { symptomKey: 'headache', displayName: '头痛' };
      mockReq.params = { symptomName: '头痛' };
      mockService.getSymptomMappingByName.mockResolvedValueOnce(mockData);

      await knowledgeController.getSymptomMappingByName(mockReq as Request, mockRes as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });

    it('应该在症状映射不存在时返回404', async () => {
      mockReq.params = { symptomName: 'nonexistent' };
      mockService.getSymptomMappingByName.mockResolvedValueOnce(null);

      await knowledgeController.getSymptomMappingByName(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
    });
  });

  describe('getDiseases', () => {
    it('应该成功返回疾病列表', async () => {
      const mockData = [
        { name: '感冒', category: '呼吸系统' },
        { name: '胃炎', category: '消化系统' },
      ];
      mockService.getDiseases.mockResolvedValueOnce(mockData);

      await knowledgeController.getDiseases(mockReq as Request, mockRes as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });

    it('应该在服务出错时返回500', async () => {
      mockService.getDiseases.mockRejectedValueOnce(new Error('Database error'));

      await knowledgeController.getDiseases(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
    });
  });

  describe('getDiseaseByName', () => {
    it('应该成功返回疾病详情', async () => {
      const mockData = { name: '感冒', description: '上呼吸道感染' };
      mockReq.params = { diseaseName: '感冒' };
      mockService.getDiseaseByName.mockResolvedValueOnce(mockData);

      await knowledgeController.getDiseaseByName(mockReq as Request, mockRes as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });

    it('应该在疾病不存在时返回404', async () => {
      mockReq.params = { diseaseName: 'nonexistent' };
      mockService.getDiseaseByName.mockResolvedValueOnce(null);

      await knowledgeController.getDiseaseByName(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
    });
  });

  describe('getKnowledgeByKey', () => {
    it('应该成功返回知识库条目', async () => {
      const mockData = { symptomKey: 'headache', displayName: '头痛', questions: [] };
      mockReq.params = { key: 'headache' };
      mockService.getKnowledgeByKey.mockResolvedValueOnce(mockData);

      await knowledgeController.getKnowledgeByKey(mockReq as Request, mockRes as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });

    it('应该在条目不存在时返回404', async () => {
      mockReq.params = { key: 'nonexistent' };
      mockService.getKnowledgeByKey.mockResolvedValueOnce(null);

      await knowledgeController.getKnowledgeByKey(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
    });
  });

  describe('upsertKnowledge', () => {
    it('应该成功创建或更新知识库条目', async () => {
      const mockData = { symptomKey: 'headache', displayName: '头痛' };
      mockReq.body = { symptomKey: 'headache', displayName: '头痛' };
      mockService.upsertKnowledge.mockResolvedValueOnce(mockData);

      await knowledgeController.upsertKnowledge(mockReq as Request, mockRes as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });

    it('应该在缺少symptomKey时返回400', async () => {
      mockReq.body = { displayName: '头痛' };

      await knowledgeController.upsertKnowledge(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'symptomKey is required',
      });
    });

    it('应该在服务出错时返回500', async () => {
      mockReq.body = { symptomKey: 'headache', displayName: '头痛' };
      mockService.upsertKnowledge.mockRejectedValueOnce(new Error('Database error'));

      await knowledgeController.upsertKnowledge(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteKnowledge', () => {
    it('应该成功删除知识库条目', async () => {
      mockReq.params = { key: 'headache' };
      mockService.deleteKnowledgeByKey.mockResolvedValueOnce(undefined);

      await knowledgeController.deleteKnowledge(mockReq as Request, mockRes as Response);

      expect(mockJson).toHaveBeenCalledWith({ success: true });
    });

    it('应该在服务出错时返回500', async () => {
      mockReq.params = { key: 'headache' };
      mockService.deleteKnowledgeByKey.mockRejectedValueOnce(new Error('Database error'));

      await knowledgeController.deleteKnowledge(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteKnowledgeBulk', () => {
    it('应该成功批量删除知识库条目', async () => {
      mockReq.body = { keys: ['headache', 'fever'] };
      mockService.deleteKnowledgeBulk.mockResolvedValueOnce(undefined);

      await knowledgeController.deleteKnowledgeBulk(mockReq as Request, mockRes as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: { deletedCount: 2 },
      });
    });

    it('应该在keys为空数组时返回400', async () => {
      mockReq.body = { keys: [] };

      await knowledgeController.deleteKnowledgeBulk(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it('应该在keys不是数组时返回400', async () => {
      mockReq.body = { keys: 'not-an-array' };

      await knowledgeController.deleteKnowledgeBulk(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it('应该在缺少keys时返回400', async () => {
      mockReq.body = {};

      await knowledgeController.deleteKnowledgeBulk(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it('应该在服务出错时返回500', async () => {
      mockReq.body = { keys: ['headache'] };
      mockService.deleteKnowledgeBulk.mockRejectedValueOnce(new Error('Database error'));

      await knowledgeController.deleteKnowledgeBulk(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
    });
  });
});
