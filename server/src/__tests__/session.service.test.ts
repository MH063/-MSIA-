import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { deleteSessionPermanentlyWithPrisma } from '../services/session.service';
import { SessionSchemas } from '../validators';

type AnyFn = (...args: any[]) => any;

function createFakePrisma(params: {
  findUnique: AnyFn;
  onDelete: AnyFn;
  tableExistsByName: Record<string, boolean>;
  onExecuteRawUnsafe?: AnyFn;
}) {
  const calls: Array<{ name: string; args: any[] }> = [];

  const tx = {
    $queryRaw: async (strings: any, ...values: any[]) => {
      calls.push({ name: '$queryRaw', args: [strings, ...values] });
      const tableName = String(values?.[0] ?? '');
      return [{ exists: Boolean(params.tableExistsByName[tableName]) }];
    },
    $executeRawUnsafe: async (sql: string, ...values: any[]) => {
      calls.push({ name: '$executeRawUnsafe', args: [sql, ...values] });
      if (params.onExecuteRawUnsafe) {return params.onExecuteRawUnsafe(sql, ...values);}
      return 1;
    },
    interviewSession: {
      delete: async (arg: any) => {
        calls.push({ name: 'interviewSession.delete', args: [arg] });
        return params.onDelete(arg);
      },
    },
  };

  const prismaClient = {
    interviewSession: {
      findUnique: async (arg: any) => {
        calls.push({ name: 'interviewSession.findUnique', args: [arg] });
        return params.findUnique(arg);
      },
    },
    $transaction: async (fn: AnyFn) => {
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
    it('医生仅可删除归属自己的问诊记录', async () => {
      process.env.SESSION_CASCADE_TABLES_JSON = JSON.stringify([]);

      const prismaClient = createFakePrisma({
        findUnique: async () => ({ id: 1, doctorId: 2 }),
        onDelete: async () => ({ id: 1 }),
        tableExistsByName: {},
      });

      await expect(
        deleteSessionPermanentlyWithPrisma(prismaClient as any, {
          sessionId: 1,
          operator: { token: 't', operatorId: 3, role: 'doctor' },
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        errorCode: 'FORBIDDEN',
      });

      delete process.env.SESSION_CASCADE_TABLES_JSON;
    });

    it('管理员可删除任何问诊记录', async () => {
      process.env.SESSION_CASCADE_TABLES_JSON = JSON.stringify([]);

      const prismaClient = createFakePrisma({
        findUnique: async () => ({ id: 1, doctorId: null }),
        onDelete: async () => ({ id: 1 }),
        tableExistsByName: { audit_logs: true },
      });

      const ret = await deleteSessionPermanentlyWithPrisma(prismaClient as any, {
        sessionId: 1,
        operator: { token: 't', operatorId: 0, role: 'admin' },
      });

      expect(ret).toEqual({ deletedId: 1 });
      delete process.env.SESSION_CASCADE_TABLES_JSON;
    });

    it('事务回滚：级联删除失败时不删除主表', async () => {
      process.env.SESSION_CASCADE_TABLES_JSON = JSON.stringify([
        { table: 'child_table', fkColumn: 'session_id' },
      ]);

      let deleted = false;
      const prismaClient = createFakePrisma({
        findUnique: async () => ({ id: 1, doctorId: 1 }),
        onDelete: async () => {
          deleted = true;
          return { id: 1 };
        },
        tableExistsByName: { child_table: true },
        onExecuteRawUnsafe: async (sql: string) => {
          if (sql.includes('DELETE FROM "child_table"')) {
            throw new Error('child delete failed');
          }
          return 1;
        },
      });

      await expect(
        deleteSessionPermanentlyWithPrisma(prismaClient as any, {
          sessionId: 1,
          operator: { token: 't', operatorId: 1, role: 'doctor' },
        })
      ).rejects.toThrow();

      expect(deleted).toBe(false);
      delete process.env.SESSION_CASCADE_TABLES_JSON;
    });

    it('级联删除：按配置删除子表并写入审计表', async () => {
      process.env.SESSION_CASCADE_TABLES_JSON = JSON.stringify([
        { table: 'child_a', fkColumn: 'session_id' },
        { table: 'child_b', fkColumn: 'session_id' },
      ]);

      const prismaClient = createFakePrisma({
        findUnique: async () => ({ id: 10, doctorId: 7 }),
        onDelete: async () => ({ id: 10 }),
        tableExistsByName: { child_a: true, child_b: true, audit_logs: true },
      });

      await deleteSessionPermanentlyWithPrisma(prismaClient as any, {
        sessionId: 10,
        operator: { token: 't', operatorId: 7, role: 'doctor' },
      });

      const calls = (prismaClient as any).__calls as Array<{ name: string; args: any[] }>;
      const executedSql = calls
        .filter((c) => c.name === '$executeRawUnsafe')
        .map((c) => String(c.args[0]));

      expect(executedSql.some((s) => s.includes('DELETE FROM "child_a"'))).toBe(true);
      expect(executedSql.some((s) => s.includes('DELETE FROM "child_b"'))).toBe(true);
      expect(executedSql.some((s) => s.includes('INSERT INTO "audit_logs"'))).toBe(true);

      delete process.env.SESSION_CASCADE_TABLES_JSON;
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
      expect((parsed as any).historianRelationship).toBeUndefined();
      expect((parsed as any).pastHistory).toBeUndefined();
    });
  });
});
