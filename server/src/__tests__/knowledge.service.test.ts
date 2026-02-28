import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  getAllKnowledge,
  getKnowledgeSince,
  getKnowledgeByKey,
  upsertKnowledge,
  countKnowledge,
  getRecentKnowledge,
  deleteKnowledgeByKey,
  deleteKnowledgeBulk,
  SymptomKnowledgeData,
} from '../services/knowledge.service';
import prisma from '../prisma';

vi.mock('../prisma', () => ({
  default: {
    symptomKnowledge: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe('KnowledgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('getAllKnowledge', () => {
    it('应该返回所有症状知识库列表', async () => {
      const mockData = [
        { id: 1, symptomKey: 'headache', displayName: '头痛' },
        { id: 2, symptomKey: 'fever', displayName: '发热' },
      ];
      mockPrisma.symptomKnowledge.findMany.mockResolvedValue(mockData);

      const result = await getAllKnowledge();

      expect(result).toEqual(mockData);
      expect(prisma.symptomKnowledge.findMany).toHaveBeenCalledWith();
    });
  });

  describe('getKnowledgeSince', () => {
    it('应该返回指定时间后更新的知识库条目', async () => {
      const since = new Date('2024-01-01');
      const mockData = [
        { id: 1, symptomKey: 'headache', displayName: '头痛', updatedAt: new Date() },
      ];
      mockPrisma.symptomKnowledge.findMany.mockResolvedValue(mockData);

      const result = await getKnowledgeSince(since);

      expect(result).toEqual(mockData);
      expect(prisma.symptomKnowledge.findMany).toHaveBeenCalledWith({
        where: { updatedAt: { gt: since } },
      });
    });
  });

  describe('getKnowledgeByKey', () => {
    it('应该通过 symptomKey 精确匹配找到知识', async () => {
      const mockData = { id: 1, symptomKey: 'headache', displayName: '头痛' };
      mockPrisma.symptomKnowledge.findUnique.mockResolvedValue(mockData);

      const result = await getKnowledgeByKey('headache');

      expect(result).toEqual(mockData);
      expect(prisma.symptomKnowledge.findUnique).toHaveBeenCalledWith({
        where: { symptomKey: 'headache' },
      });
    });

    it('当 symptomKey 未找到时，应该尝试通过 displayName 精确匹配', async () => {
      const mockData = { id: 1, symptomKey: 'headache', displayName: '头痛' };
      mockPrisma.symptomKnowledge.findUnique.mockResolvedValue(null);
      mockPrisma.symptomKnowledge.findFirst.mockResolvedValue(mockData);

      const result = await getKnowledgeByKey('头痛');

      expect(result).toEqual(mockData);
      expect(prisma.symptomKnowledge.findFirst).toHaveBeenCalledWith({
        where: { displayName: '头痛' },
      });
    });

    it('当精确匹配都失败时，应该尝试模糊匹配', async () => {
      const mockData = { id: 1, symptomKey: 'headache', displayName: '头痛' };
      mockPrisma.symptomKnowledge.findUnique.mockResolvedValue(null);
      mockPrisma.symptomKnowledge.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockData);

      const result = await getKnowledgeByKey('头');

      expect(result).toEqual(mockData);
      expect(prisma.symptomKnowledge.findFirst).toHaveBeenLastCalledWith({
        where: { displayName: { contains: '头' } },
      });
    });

    it('当所有匹配都失败时，应该返回 null', async () => {
      mockPrisma.symptomKnowledge.findUnique.mockResolvedValue(null);
      mockPrisma.symptomKnowledge.findFirst.mockResolvedValue(null);

      const result = await getKnowledgeByKey('unknown');

      expect(result).toBeNull();
    });
  });

  describe('upsertKnowledge', () => {
    it('应该创建或更新症状知识', async () => {
      const mockData: SymptomKnowledgeData = {
        symptomKey: 'headache',
        displayName: '头痛',
        category: 'neurology',
        description: '头部疼痛的症状',
      };
      const mockResult = { id: 1, ...mockData };
      mockPrisma.symptomKnowledge.upsert.mockResolvedValue(mockResult);

      const result = await upsertKnowledge(mockData);

      expect(result).toEqual(mockResult);
      expect(prisma.symptomKnowledge.upsert).toHaveBeenCalledWith({
        where: { symptomKey: 'headache' },
        update: expect.objectContaining({
          displayName: '头痛',
          category: 'neurology',
          description: '头部疼痛的症状',
          version: { increment: 1 },
        }),
        create: expect.objectContaining({
          symptomKey: 'headache',
          displayName: '头痛',
          category: 'neurology',
          description: '头部疼痛的症状',
        }),
      });
    });
  });

  describe('countKnowledge', () => {
    it('应该返回知识库条目总数', async () => {
      mockPrisma.symptomKnowledge.count.mockResolvedValue(100);

      const result = await countKnowledge();

      expect(result).toBe(100);
      expect(prisma.symptomKnowledge.count).toHaveBeenCalledWith();
    });
  });

  describe('getRecentKnowledge', () => {
    it('应该返回最近更新的知识库条目', async () => {
      const mockData = [
        { id: 1, displayName: '头痛', symptomKey: 'headache' },
        { id: 2, displayName: '发热', symptomKey: 'fever' },
      ];
      mockPrisma.symptomKnowledge.findMany.mockResolvedValue(mockData);

      const result = await getRecentKnowledge(2);

      expect(result).toEqual(mockData);
      expect(prisma.symptomKnowledge.findMany).toHaveBeenCalledWith({
        take: 2,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, displayName: true, symptomKey: true },
      });
    });

    it('应该使用默认的 take 值', async () => {
      mockPrisma.symptomKnowledge.findMany.mockResolvedValue([]);

      await getRecentKnowledge();

      expect(prisma.symptomKnowledge.findMany).toHaveBeenCalledWith({
        take: 3,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, displayName: true, symptomKey: true },
      });
    });
  });

  describe('deleteKnowledgeByKey', () => {
    it('应该成功删除存在的知识条目', async () => {
      mockPrisma.symptomKnowledge.delete.mockResolvedValue({ symptomKey: 'headache' });

      const result = await deleteKnowledgeByKey('headache');

      expect(result).toEqual({ deleted: 1, key: 'headache' });
      expect(prisma.symptomKnowledge.delete).toHaveBeenCalledWith({
        where: { symptomKey: 'headache' },
      });
    });

    it('当记录不存在时，应该返回 deleted: 0', async () => {
      const error = new Error('Record not found') as Error & { code: string };
      error.code = 'P2025';
      mockPrisma.symptomKnowledge.delete.mockRejectedValue(error);

      const result = await deleteKnowledgeByKey('unknown');

      expect(result).toEqual({ deleted: 0, key: 'unknown' });
    });

    it('当发生其他错误时，应该抛出异常', async () => {
      const error = new Error('Database error') as Error & { code: string };
      error.code = 'P2000';
      mockPrisma.symptomKnowledge.delete.mockRejectedValue(error);

      await expect(deleteKnowledgeByKey('headache')).rejects.toThrow('Database error');
    });
  });

  describe('deleteKnowledgeBulk', () => {
    it('应该批量删除知识条目', async () => {
      mockPrisma.symptomKnowledge.deleteMany.mockResolvedValue({ count: 3 });

      const result = await deleteKnowledgeBulk(['headache', 'fever', 'cough']);

      expect(result).toBe(3);
      expect(prisma.symptomKnowledge.deleteMany).toHaveBeenCalledWith({
        where: { symptomKey: { in: ['headache', 'fever', 'cough'] } },
      });
    });

    it('当没有匹配的记录时，应该返回 0', async () => {
      mockPrisma.symptomKnowledge.deleteMany.mockResolvedValue({ count: 0 });

      const result = await deleteKnowledgeBulk(['unknown1', 'unknown2']);

      expect(result).toBe(0);
    });
  });
});
