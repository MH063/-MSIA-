import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { analyzeComplaint, parseChiefComplaint } from '../controllers/nlp.controller';
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

describe('NLPController', () => {
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

  describe('analyzeComplaint', () => {
    it('应该在主诉内容为空时返回400', async () => {
      mockReq.body = { text: '' };
      await analyzeComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(400);
    });

    it('应该在缺少主诉内容时返回400', async () => {
      mockReq.body = {};
      await analyzeComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(400);
    });

    it('应该成功分析主诉并返回症状列表', async () => {
      mockReq.body = { text: '患者发热3天，伴有咳嗽、头痛' };
      await analyzeComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            matchedSymptoms: expect.arrayContaining([
              expect.objectContaining({ name: '发热' }),
              expect.objectContaining({ name: '咳嗽' }),
              expect.objectContaining({ name: '头痛' }),
            ]),
            duration: { value: 3, unit: '天' },
          }),
        })
      );
    });

    it('应该支持 complaint 字段作为输入', async () => {
      mockReq.body = { complaint: '患者头痛2周' };
      await analyzeComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            matchedSymptoms: expect.arrayContaining([
              expect.objectContaining({ name: '头痛' }),
            ]),
            duration: { value: 2, unit: '周' },
          }),
        })
      );
    });

    it('应该正确提取持续时间（小时）', async () => {
      mockReq.body = { text: '患者腹痛5小时' };
      await analyzeComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            duration: { value: 5, unit: '小时' },
          }),
        })
      );
    });

    it('应该正确提取持续时间（分钟）', async () => {
      mockReq.body = { text: '患者头晕30分钟' };
      await analyzeComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            duration: { value: 30, unit: '分钟' },
          }),
        })
      );
    });

    it('应该在无匹配症状时返回空数组', async () => {
      mockReq.body = { text: '患者感到不适' };
      await analyzeComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            matchedSymptoms: [],
            matchedCount: 0,
          }),
        })
      );
    });
  });

  describe('parseChiefComplaint', () => {
    it('应该在文本内容为空时返回400', async () => {
      mockReq.body = { text: '' };
      await parseChiefComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(400);
    });

    it('应该在缺少文本内容时返回400', async () => {
      mockReq.body = {};
      await parseChiefComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).status).toHaveBeenCalledWith(400);
    });

    it('应该成功解析主诉结构', async () => {
      mockReq.body = { text: '患者重度头痛3天，伴有恶心' };
      await parseChiefComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            symptoms: expect.arrayContaining(['头痛', '恶心']),
            duration: { value: 3, unit: '天' },
            severity: '重度',
          }),
        })
      );
    });

    it('应该正确提取轻度严重程度', async () => {
      mockReq.body = { text: '患者轻微头痛' };
      await parseChiefComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            severity: '轻度',
          }),
        })
      );
    });

    it('应该正确提取中度严重程度', async () => {
      mockReq.body = { text: '患者明显头痛' };
      await parseChiefComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            severity: '中度',
          }),
        })
      );
    });

    it('应该正确提取重度严重程度', async () => {
      mockReq.body = { text: '患者剧烈头痛' };
      await parseChiefComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            severity: '重度',
          }),
        })
      );
    });

    it('应该正确提取部位信息', async () => {
      mockReq.body = { text: '患者腹部疼痛3天' };
      await parseChiefComplaint(mockReq as never, mockRes as Response);
      expect((mockRes as Record<string, ReturnType<typeof vi.fn>>).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            location: '腹部',
          }),
        })
      );
    });
  });
});
