import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { deleteSessionPermanentlyWithPrisma } from '../services/session.service';
import { SessionSchemas } from '../validators';
import type { Prisma } from '@prisma/client';

vi.mock('../prisma', () => ({
  default: {
    interviewSession: {
      delete: vi.fn(),
    },
  },
}));

import prisma from '../prisma';

describe('SessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('deleteSessionPermanentlyWithPrisma', () => {
    it('删除指定ID的会话记录', async () => {
      (prisma.interviewSession.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });

      const result = await deleteSessionPermanentlyWithPrisma(1);
      expect(result).toEqual({ deletedId: 1 });
      expect(prisma.interviewSession.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('删除不存在的会话会抛出错误', async () => {
      const error = new Error('Record not found');
      (prisma.interviewSession.delete as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(deleteSessionPermanentlyWithPrisma(999)).rejects.toThrow();
    });
  });

  describe('SessionSchemas.update', () => {
    it('接受 null 的可选字段并不报 400', () => {
      const input = {
        historianRelationship: null,
        pastHistory: null,
        personalHistory: null,
        maritalHistory: null,
        menstrualHistory: null,
        fertilityHistory: null,
        familyHistory: null,
        physicalExam: null,
        specialistExam: null,
        auxiliaryExams: null,
        reviewOfSystems: null,
        chiefComplaint: {
          text: '活动后心悸气促5年',
          symptom: '心悸',
          durationNum: 5,
          durationUnit: '年',
        },
      };

      const parsed = SessionSchemas.update.parse(input);
      expect(parsed).toBeDefined();
      const parsedRecord = parsed as Record<string, unknown>;
      expect(parsedRecord.historianRelationship).toBeUndefined();
      expect(parsedRecord.pastHistory).toBeUndefined();
    });
  });
});
