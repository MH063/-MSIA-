import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteSessionPermanentlyWithPrisma } from '../services/session.service';

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

test('医生仅可删除归属自己的问诊记录', async () => {
  process.env.SESSION_CASCADE_TABLES_JSON = JSON.stringify([]);

  const prismaClient = createFakePrisma({
    findUnique: async () => ({ id: 1, doctorId: 2 }),
    onDelete: async () => ({ id: 1 }),
    tableExistsByName: {},
  });

  await assert.rejects(
    () =>
      deleteSessionPermanentlyWithPrisma(prismaClient as any, {
        sessionId: 1,
        operator: { token: 't', operatorId: 3, role: 'doctor' },
      }),
    (e: any) => {
      assert.equal(e.statusCode, 403);
      assert.equal(e.errorCode, 'FORBIDDEN');
      return true;
    }
  );
});

test('管理员可删除任何问诊记录', async () => {
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

  assert.deepEqual(ret, { deletedId: 1 });
});

test('事务回滚：级联删除失败时不删除主表', async () => {
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

  await assert.rejects(() =>
    deleteSessionPermanentlyWithPrisma(prismaClient as any, {
      sessionId: 1,
      operator: { token: 't', operatorId: 1, role: 'doctor' },
    })
  );
  assert.equal(deleted, false);
});

test('级联删除：按配置删除子表并写入审计表', async () => {
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

  assert.ok(executedSql.some((s) => s.includes('DELETE FROM "child_a"')));
  assert.ok(executedSql.some((s) => s.includes('DELETE FROM "child_b"')));
  assert.ok(executedSql.some((s) => s.includes('INSERT INTO "audit_logs"')));
});

