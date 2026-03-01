import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { deleteSessionPermanentlyWithPrisma } from '../services/session.service';
import { SessionSchemas } from '../validators';
import type {
  MockPrismaClient,
  MockTransactionClient,
  CreateMockPrismaParams,
  TransactionCall,
} from './testTypes';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * 创建 Mock Prisma 客户端
 */
function createFakePrisma(params: CreateMockPrismaParams): MockPrismaClient {
  const calls: TransactionCall[] = [];

  const tx: MockTransactionClient = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ name: '$queryRaw', args: [strings, ...values] });
      const tableName = String(values?.[0] ?? '');
      return [{ exists: Boolean(params.tableExistsByName[tableName]) }];
    },
    $executeRawUnsafe: async (sql: string, ...values: unknown[]) => {
      calls.push({ name: '$executeRawUnsafe', args: [sql, ...values] });
      if (params.onExecuteRawUnsafe) {
        return params.onExecuteRawUnsafe(sql, ...values);
      }
      return 1;
    },
    interviewSession: {
      delete: async (arg: Prisma.InterviewSessionDeleteArgs) => {
        calls.push({ name: 'interviewSession.delete', args: [arg] });
        return params.onDelete(arg);
      },
    },
  };

  const prismaClient: MockPrismaClient = {
    interviewSession: {
      findUnique: async (arg: Prisma.InterviewSessionFindUniqueArgs) => {
        calls.push({ name: 'interviewSession.findUnique', args: [arg] });
        return params.findUnique(arg);
      },
    },
    $transaction: async <T>(fn: (tx: MockTransactionClient) => Promise<T>): Promise<T> => {
      calls.push({ name: '$transaction', args: [] });
      return fn(tx);
    },
    __calls: calls,
  };

  return prismaClient;
}

describe('SessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('deleteSessionPermanentlyWithPrisma', () => {
    it('删除指定ID的会话记录', async () => {
      const prismaClient = createFakePrisma({
        findUnique: async () => ({ id: 1, doctorId: null }),
        onDelete: async () => ({ id: 1 }),
        tableExistsByName: {},
      });

      const result = await deleteSessionPermanentlyWithPrisma(1);
      expect(result).toEqual({ deletedId: 1 });
    });

    it('删除不存在的会话会抛出错误', async () => {
      const error = new Error('Record not found');
      
      const prismaClient = createFakePrisma({
        findUnique: async () => null,
        onDelete: async () => { throw error; },
        tableExistsByName: {},
      });

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
