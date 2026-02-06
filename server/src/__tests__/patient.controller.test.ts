/**
 * 患者控制器测试
 * 测试患者CRUD操作
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';

import * as patientController from '../controllers/patient.controller';
import * as patientService from '../services/patient.service';
import prisma from '../prisma';

// Mock 依赖
vi.mock('../services/patient.service', () => ({
  getAllPatients: vi.fn(),
  createPatient: vi.fn(),
}));

vi.mock('../prisma', () => ({
  default: {
    patient: {
      delete: vi.fn(),
    },
  },
}));

describe('PatientController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock }));

    mockRes = {
      status: statusMock as unknown as Response['status'],
      json: jsonMock as unknown as Response['json'],
    };

    mockReq = {
      body: {},
      params: {},
      query: {},
    };
  });

  describe('getPatients', () => {
    it('应该返回患者列表', async () => {
      const mockPatients = [
        { id: 1, name: '张三', gender: 'male', age: 30 },
        { id: 2, name: '李四', gender: 'female', age: 25 },
      ];

      (patientService.getAllPatients as ReturnType<typeof vi.fn>).mockResolvedValue(mockPatients);

      await patientController.getPatients(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            patients: mockPatients,
          }),
        })
      );
    });

    it('应该在发生错误时返回500', async () => {
      (patientService.getAllPatients as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB Error'));

      await patientController.getPatients(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Failed'),
        })
      );
    });
  });

  describe('createPatient', () => {
    it('应该成功创建患者', async () => {
      const mockPatient = {
        id: 1,
        name: '张三',
        gender: 'male',
        age: 30,
        birthDate: new Date('1994-01-01'),
      };

      (patientService.createPatient as ReturnType<typeof vi.fn>).mockResolvedValue(mockPatient);

      mockReq.body = {
        name: '张三',
        gender: 'male',
        age: 30,
        birthDate: '1994-01-01',
      };

      await patientController.createPatient(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockPatient,
        })
      );
    });

    it('应该在发生错误时返回500', async () => {
      (patientService.createPatient as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB Error'));

      mockReq.body = { name: '张三' };

      await patientController.createPatient(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Failed'),
        })
      );
    });
  });

  describe('deletePatient', () => {
    it('应该成功删除患者', async () => {
      (prisma.patient.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      mockReq.params = { id: '1' };

      await patientController.deletePatient(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('应该在外键约束错误时返回400', async () => {
      const fkError = new Error('Foreign key constraint') as Error & { code: string };
      fkError.code = 'P2003';
      (prisma.patient.delete as ReturnType<typeof vi.fn>).mockRejectedValue(fkError);

      mockReq.params = { id: '1' };

      await patientController.deletePatient(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Cannot delete'),
        })
      );
    });

    it('应该在其他错误时返回500', async () => {
      (prisma.patient.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB Error'));

      mockReq.params = { id: '1' };

      await patientController.deletePatient(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Failed'),
        })
      );
    });
  });
});
