import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  getAllPatients,
  createPatient,
  PatientData,
} from '../services/patient.service';
import prisma from '../prisma';

// Mock prisma
vi.mock('../prisma', () => ({
  default: {
    patient: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('PatientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('getAllPatients', () => {
    it('应该返回所有患者列表', async () => {
      const mockData = [
        { id: 1, name: '张三', gender: 'male' },
        { id: 2, name: '李四', gender: 'female' },
      ];
      (prisma.patient.findMany as any).mockResolvedValue(mockData);

      const result = await getAllPatients();

      expect(result).toEqual(mockData);
      expect(prisma.patient.findMany).toHaveBeenCalledWith();
    });

    it('当没有患者时，应该返回空数组', async () => {
      (prisma.patient.findMany as any).mockResolvedValue([]);

      const result = await getAllPatients();

      expect(result).toEqual([]);
    });
  });

  describe('createPatient', () => {
    it('应该成功创建患者', async () => {
      const mockData: PatientData = {
        name: '张三',
        gender: 'male',
        birthDate: '1990-01-01',
        nativePlace: '北京',
        placeOfBirth: '北京',
        ethnicity: '汉族',
        address: '北京市朝阳区',
        occupation: '工程师',
        employer: '某科技公司',
        contactInfo: { phone: '13800138000' },
      };
      const mockResult = { id: 1, ...mockData };
      (prisma.patient.create as any).mockResolvedValue(mockResult);

      const result = await createPatient(mockData);

      expect(result).toEqual(mockResult);
      expect(prisma.patient.create).toHaveBeenCalledWith({
        data: {
          name: '张三',
          gender: 'male',
          birthDate: new Date('1990-01-01'),
          nativePlace: '北京',
          placeOfBirth: '北京',
          ethnicity: '汉族',
          address: '北京市朝阳区',
          occupation: '工程师',
          employer: '某科技公司',
          contactInfo: { phone: '13800138000' },
        },
      });
    });

    it('应该处理可选字段为空的情况', async () => {
      const mockData: PatientData = {
        name: '李四',
        gender: 'female',
      };
      const mockResult = { id: 2, ...mockData };
      (prisma.patient.create as any).mockResolvedValue(mockResult);

      const result = await createPatient(mockData);

      expect(result).toEqual(mockResult);
      expect(prisma.patient.create).toHaveBeenCalledWith({
        data: {
          name: '李四',
          gender: 'female',
          birthDate: undefined,
          nativePlace: undefined,
          placeOfBirth: undefined,
          ethnicity: undefined,
          address: undefined,
          occupation: undefined,
          employer: undefined,
          contactInfo: undefined,
        },
      });
    });

    it('应该处理 Date 类型的 birthDate', async () => {
      const birthDate = new Date('1985-05-15');
      const mockData: PatientData = {
        name: '王五',
        gender: 'male',
        birthDate: birthDate,
      };
      const mockResult = { id: 3, ...mockData };
      (prisma.patient.create as any).mockResolvedValue(mockResult);

      const result = await createPatient(mockData);

      expect(result).toEqual(mockResult);
      expect(prisma.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: '王五',
          gender: 'male',
          birthDate: birthDate,
        }),
      });
    });

    it('当创建失败时，应该抛出异常', async () => {
      const mockData: PatientData = {
        name: '错误用户',
        gender: 'male',
      };
      const error = new Error('Database connection failed');
      (prisma.patient.create as any).mockRejectedValue(error);

      await expect(createPatient(mockData)).rejects.toThrow('Database connection failed');
    });
  });
});
