import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSymptomMappings } from '../controllers/mapping.controller';
import prisma from '../prisma';
import type { Response } from 'express';

interface MockRequest {
  body: Record<string, unknown>;
}

function createMockRes(): unknown {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn();
  return res;
}

vi.mock('../prisma', () => ({
  default: {
    symptomKnowledge: {
      findMany: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe('MappingController', () => {
  let mockReq: MockRequest;
  let mockRes: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { body: {} };
    mockRes = createMockRes();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSymptomMappings', () => {
    it('应该成功返回症状映射列表', async () => {
      const mockSymptoms = [
        {
          symptomKey: 'fever',
          displayName: '发热',
          category: '全身症状',
          description: '体温升高',
          associatedSymptoms: ['畏寒', '寒战'],
          redFlags: ['高热不退'],
          requiredQuestions: ['体温多少度？'],
        },
        {
          symptomKey: 'headache',
          displayName: '头痛',
          category: '神经系统',
          description: '头部疼痛',
          associatedSymptoms: null,
          redFlags: null,
          requiredQuestions: [],
        },
      ];
      mockPrisma.symptomKnowledge.findMany.mockResolvedValue(mockSymptoms);

      await getSymptomMappings(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            symptoms: mockSymptoms,
            count: 2,
          }),
        })
      );
    });

    it('应该正确构建nameToKey映射', async () => {
      const mockSymptoms = [
        {
          symptomKey: 'fever',
          displayName: '发热',
          category: '全身症状',
          description: null,
          associatedSymptoms: null,
          redFlags: null,
          requiredQuestions: [],
        },
      ];
      mockPrisma.symptomKnowledge.findMany.mockResolvedValue(mockSymptoms);

      await getSymptomMappings(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            nameToKey: expect.objectContaining({
              '发热': 'fever',
            }),
          }),
        })
      );
    });

    it('应该正确处理同义词映射', async () => {
      const mockSymptoms = [
        {
          symptomKey: 'headache',
          displayName: '头痛',
          category: '神经系统',
          description: null,
          associatedSymptoms: ['头疼', '偏头痛'],
          redFlags: null,
          requiredQuestions: [],
        },
      ];
      mockPrisma.symptomKnowledge.findMany.mockResolvedValue(mockSymptoms);

      await getSymptomMappings(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            synonyms: expect.objectContaining({
              '头疼': 'headache',
              '偏头痛': 'headache',
            }),
          }),
        })
      );
    });

    it('应该正确处理oliguria_anuria_polyuria拆分', async () => {
      const mockSymptoms = [
        {
          symptomKey: 'oliguria_anuria_polyuria',
          displayName: '少尿/无尿/多尿',
          category: '泌尿系统',
          description: null,
          associatedSymptoms: null,
          redFlags: null,
          requiredQuestions: [],
        },
      ];
      mockPrisma.symptomKnowledge.findMany.mockResolvedValue(mockSymptoms);

      await getSymptomMappings(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            nameToKey: expect.objectContaining({
              '少尿': 'oliguria',
              '无尿': 'anuria',
              '多尿': 'polyuria',
            }),
          }),
        })
      );
    });

    it('应该在数据库为空时返回空列表', async () => {
      mockPrisma.symptomKnowledge.findMany.mockResolvedValue([]);

      await getSymptomMappings(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            symptoms: [],
            count: 0,
            nameToKey: {},
            synonyms: {},
          }),
        })
      );
    });

    it('应该在数据库错误时返回500', async () => {
      mockPrisma.symptomKnowledge.findMany.mockRejectedValue(new Error('DB Error'));

      await getSymptomMappings(mockReq as never, mockRes as Response);

      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(500);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith({
        success: false,
        message: '获取症状映射失败',
      });
    });
  });
});
