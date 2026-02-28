import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  suggestDiagnosis,
  suggestEnhancedDiagnosis,
  getAllDiagnoses,
  getDiagnosisById,
  initializeDiagnosisData,
} from '../controllers/diagnosis.controller';
import prisma from '../prisma';
import type { Response } from 'express';

interface MockRequest {
  body: Record<string, unknown>;
  params: Record<string, string>;
}

function createMockRes(): unknown {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn();
  return res;
}

vi.mock('../prisma', () => ({
  default: {
    diagnosis: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe('DiagnosisController', () => {
  let mockReq: MockRequest;
  let mockRes: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { body: {}, params: {} };
    mockRes = createMockRes();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('suggestDiagnosis', () => {
    it('应该在症状列表为空时返回400', async () => {
      mockReq.body = { symptoms: [] };
      await suggestDiagnosis(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(400);
    });

    it('应该在缺少症状列表时返回400', async () => {
      mockReq.body = {};
      await suggestDiagnosis(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(400);
    });

    it('应该成功返回诊断建议', async () => {
      mockReq.body = { symptoms: ['发热', '咳嗽'] };
      mockPrisma.diagnosis.findMany.mockResolvedValue([
        { id: 1, name: '上呼吸道感染', category: '呼吸系统', symptoms: [{ symptomKey: 'fever' }] },
      ]);
      await suggestDiagnosis(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            suggestions: expect.any(Array),
          }),
        })
      );
    });

    it('应该在数据库错误时返回空建议列表', async () => {
      mockReq.body = { symptoms: ['发热'] };
      mockPrisma.diagnosis.findMany.mockRejectedValue(new Error('DB Error'));
      await suggestDiagnosis(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            suggestions: [],
          }),
        })
      );
    });
  });

  describe('suggestEnhancedDiagnosis', () => {
    it('应该在症状列表为空时返回400', async () => {
      mockReq.body = { symptoms: [] };
      await suggestEnhancedDiagnosis(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(400);
    });

    it('应该成功返回增强诊断建议', async () => {
      mockReq.body = {
        symptoms: ['发热', '咳嗽'],
        patientInfo: { age: 65, gender: 'male' },
        history: { chronicDiseases: ['高血压'] },
      };
      mockPrisma.diagnosis.findMany.mockResolvedValue([
        { id: 1, name: '上呼吸道感染', category: '呼吸系统', symptoms: [] },
      ]);
      await suggestEnhancedDiagnosis(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            suggestions: expect.any(Array),
            confidence: expect.any(Number),
            reasoning: expect.any(String),
          }),
        })
      );
    });
  });

  describe('getAllDiagnoses', () => {
    it('应该成功返回所有诊断列表', async () => {
      const mockDiagnoses = [
        { id: 1, name: '上呼吸道感染', category: '呼吸系统' },
        { id: 2, name: '高血压', category: '心血管系统' },
      ];
      mockPrisma.diagnosis.findMany.mockResolvedValue(mockDiagnoses);
      await getAllDiagnoses(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith({
        success: true,
        data: mockDiagnoses,
      });
    });

    it('应该在数据库错误时返回500', async () => {
      mockPrisma.diagnosis.findMany.mockRejectedValue(new Error('DB Error'));
      await getAllDiagnoses(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(500);
    });
  });

  describe('getDiagnosisById', () => {
    it('应该成功返回诊断详情', async () => {
      const mockDiagnosis = { id: 1, name: '上呼吸道感染', category: '呼吸系统' };
      mockReq.params = { id: '1' };
      mockPrisma.diagnosis.findUnique.mockResolvedValue(mockDiagnosis);
      await getDiagnosisById(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith({
        success: true,
        data: mockDiagnosis,
      });
    });

    it('应该在诊断不存在时返回404', async () => {
      mockReq.params = { id: '999' };
      mockPrisma.diagnosis.findUnique.mockResolvedValue(null);
      await getDiagnosisById(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(404);
    });
  });

  describe('initializeDiagnosisData', () => {
    it('应该在已有数据时返回提示信息', async () => {
      mockPrisma.diagnosis.count.mockResolvedValue(5);
      await initializeDiagnosisData(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith({
        success: true,
        message: '诊断数据已存在，无需初始化',
      });
    });

    it('应该成功初始化诊断数据', async () => {
      mockPrisma.diagnosis.count.mockResolvedValue(0);
      mockPrisma.diagnosis.create.mockResolvedValue({});
      await initializeDiagnosisData(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith({
        success: true,
        message: '诊断数据初始化成功',
      });
    });
  });
});
