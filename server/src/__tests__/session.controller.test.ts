/**
 * 会话控制器测试
 * 测试问诊会话的CRUD操作
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';

import * as sessionController from '../controllers/session.controller';
import * as sessionService from '../services/session.service';
import prisma from '../prisma';

// Mock 依赖
vi.mock('../services/session.service', () => ({
  createSession: vi.fn(),
  getSessionById: vi.fn(),
  updateSession: vi.fn(),
  getSessions: vi.fn(),
  countSessions: vi.fn(),
  deleteSessionPermanently: vi.fn(),
}));

vi.mock('../services/knowledge.service', () => ({
  countKnowledge: vi.fn(),
  getRecentKnowledge: vi.fn(),
}));

vi.mock('../prisma', () => ({
  default: {
    patient: {
      update: vi.fn(),
      count: vi.fn(),
    },
    interviewSession: {
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

describe('SessionController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let endMock: ReturnType<typeof vi.fn>;
  let setHeaderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    endMock = vi.fn();
    setHeaderMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock, end: endMock }));

    mockRes = {
      status: statusMock as unknown as Response['status'],
      json: jsonMock as unknown as Response['json'],
      end: endMock as unknown as Response['end'],
      setHeader: setHeaderMock as unknown as Response['setHeader'],
    };

    mockReq = {
      body: {},
      params: {},
      query: {},
    };
  });

  describe('createSession', () => {
    it('应该成功创建会话', async () => {
      const mockSession = {
        id: 1,
        patientId: 1,
        status: 'draft',
        historian: '本人',
      };

      (sessionService.createSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      mockReq.body = {
        patientId: 1,
        historian: '本人',
        reliability: 'reliable',
      };

      await sessionController.createSession(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockSession,
        })
      );
    });

    it('应该在缺少patientId时返回400', async () => {
      mockReq.body = { historian: '本人' };

      await sessionController.createSession(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Patient ID'),
        })
      );
    });
  });

  describe('getSession', () => {
    it('应该返回指定会话', async () => {
      const mockSession = {
        id: 1,
        patientId: 1,
        patient: { id: 1, name: '张三' },
        status: 'draft',
      };

      (sessionService.getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      mockReq.params = { id: '1' };

      await sessionController.getSession(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockSession,
        })
      );
    });

    it('应该在会话不存在时返回404', async () => {
      (sessionService.getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      mockReq.params = { id: '999' };

      await sessionController.getSession(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });

  describe('updateSession', () => {
    it('应该成功更新会话', async () => {
      const mockSession = {
        id: 1,
        patientId: 1,
        status: 'draft',
        historian: '家属',
      };

      (sessionService.updateSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
      (sessionService.getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
      (prisma.patient.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      mockReq.params = { id: '1' };
      mockReq.body = {
        historian: '家属',
        name: '张三',
      };

      await sessionController.updateSession(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.anything(),
        })
      );
    });
  });

  describe('getAllSessions', () => {
    it('应该返回会话列表', async () => {
      const mockSessions = [
        { id: 1, patientId: 1, status: 'draft' },
        { id: 2, patientId: 2, status: 'completed' },
      ];

      (sessionService.getSessions as ReturnType<typeof vi.fn>).mockResolvedValue(mockSessions);
      (sessionService.countSessions as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      mockReq.query = { page: '1', pageSize: '10' };

      await sessionController.getAllSessions(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            items: mockSessions,
            total: 2,
          }),
        })
      );
    });

    it('应该支持状态过滤', async () => {
      mockReq.query = { status: 'completed', page: '1', pageSize: '10' };

      await sessionController.getAllSessions(mockReq as Request, mockRes as Response);

      expect(sessionService.getSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: expect.objectContaining({
              in: ['archived', 'completed'],
            }),
          }),
        })
      );
    });
  });

  describe('deleteSession', () => {
    it('应该成功删除会话', async () => {
      (sessionService.deleteSessionPermanently as ReturnType<typeof vi.fn>).mockResolvedValue({ deletedId: 1 });

      mockReq.params = { id: '1' };
      mockReq.operator = {
        token: 'mock-token',
        operatorId: 1,
        role: 'doctor',
      };

      await sessionController.deleteSession(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            deletedId: 1,
          }),
        })
      );
    });

    it('应该在缺少操作员信息时返回401', async () => {
      mockReq.params = { id: '1' };
      mockReq.operator = undefined;

      await sessionController.deleteSession(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('deleteSessionsBulk', () => {
    it('应该批量删除会话', async () => {
      (sessionService.deleteSessionPermanently as ReturnType<typeof vi.fn>).mockResolvedValue({ deletedId: 1 });

      mockReq.body = { ids: [1, 2, 3] };
      mockReq.operator = {
        token: 'mock-token',
        operatorId: 1,
        role: 'admin',
      };

      await sessionController.deleteSessionsBulk(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            deletedCount: 3,
          }),
        })
      );
    });

    it('应该只允许管理员批量删除', async () => {
      mockReq.body = { ids: [1, 2] };
      mockReq.operator = {
        token: 'mock-token',
        operatorId: 1,
        role: 'doctor',
      };

      await sessionController.deleteSessionsBulk(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('应该在缺少ID列表时返回400', async () => {
      mockReq.body = {};
      mockReq.operator = {
        token: 'mock-token',
        operatorId: 1,
        role: 'admin',
      };

      await sessionController.deleteSessionsBulk(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('getDashboardStats', () => {
    it('应该返回仪表盘统计数据', async () => {
      (sessionService.countSessions as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(10)  // todayCount
        .mockResolvedValueOnce(5)   // completedCount
        .mockResolvedValueOnce(3)   // archivedCount
        .mockResolvedValueOnce(20)  // totalSessions
        ;
      (prisma.$queryRaw as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([{ count: BigInt(15) }])  // totalPatientsRaw
        .mockResolvedValueOnce([])  // sessionsDailyRaw
        .mockResolvedValueOnce([]); // completedDailyRaw
      (sessionService.getSessions as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.interviewSession.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'draft', _count: { _all: 10 } },
        { status: 'completed', _count: { _all: 5 } },
      ]);

      await sessionController.getDashboardStats(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            todayCount: expect.any(Number),
            completedCount: expect.any(Number),
            totalSessions: expect.any(Number),
            totalPatients: expect.any(Number),
          }),
        })
      );
    });
  });
});
