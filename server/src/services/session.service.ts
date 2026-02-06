import prisma from '../prisma';
import { OperatorIdentity } from '../middleware/auth';

type CascadeDeleteSpec = { table: string; fkColumn: string };

function isSafeSqlIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name);
}

function getCascadeDeleteSpecs(): CascadeDeleteSpec[] {
  const raw = String(process.env.SESSION_CASCADE_TABLES_JSON || '').trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<{
        table?: unknown;
        fkColumn?: unknown;
      }>;
      const normalized = (Array.isArray(parsed) ? parsed : [])
        .map((it) => ({
          table: String(it?.table || '').trim(),
          fkColumn: String(it?.fkColumn || '').trim(),
        }))
        .filter((it) => it.table && it.fkColumn)
        .filter((it) => isSafeSqlIdentifier(it.table) && isSafeSqlIdentifier(it.fkColumn));
      if (normalized.length > 0) {return normalized;}
    } catch (e) {
      console.warn('[session.delete] SESSION_CASCADE_TABLES_JSON 解析失败', e);
    }
  }

  return [
    { table: 'interview_session_logs', fkColumn: 'session_id' },
    { table: 'interview_session_files', fkColumn: 'session_id' },
    { table: 'interview_session_items', fkColumn: 'session_id' },
  ];
}

async function tableExists(tx: any, tableName: string): Promise<boolean> {
  const rows = (await tx.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) as "exists"
  `) as Array<{ exists: boolean }>;
  return Boolean(rows?.[0]?.exists);
}

async function deleteByFkIfExists(
  tx: any,
  spec: CascadeDeleteSpec,
  fkValue: number
): Promise<void> {
  if (!isSafeSqlIdentifier(spec.table) || !isSafeSqlIdentifier(spec.fkColumn)) {return;}
  const exists = await tableExists(tx, spec.table);
  if (!exists) {return;}

  const sql = `DELETE FROM "${spec.table}" WHERE "${spec.fkColumn}" = $1`;
  await tx.$executeRawUnsafe(sql, fkValue);
}

async function writeAuditLogIfExists(
  tx: any,
  payload: { operator: OperatorIdentity; sessionId: number; deletedAt: Date }
): Promise<void> {
  const { operator, sessionId, deletedAt } = payload;
  console.log('[audit] 问诊记录永久删除', {
    operatorId: operator.operatorId,
    role: operator.role,
    sessionId,
    deletedAt: deletedAt.toISOString(),
  });

  const auditTable = 'audit_logs';
  const exists = await tableExists(tx, auditTable);
  if (!exists) {return;}

  try {
    const sql =
      'INSERT INTO "audit_logs" ("action","operator_id","operator_role","target_id","created_at") VALUES ($1,$2,$3,$4,$5)';
    await tx.$executeRawUnsafe(sql, 'SESSION_DELETE', operator.operatorId, operator.role, sessionId, deletedAt);
  } catch (e) {
    console.warn('[audit] 审计表写入失败（将继续返回删除成功）', e);
  }
}

/**
 * 创建问诊会话
 */
export const createSession = async (patientId: number, additionalData: any = {}) => {
  return await prisma.interviewSession.create({
    data: {
      patientId,
      status: 'draft',
      generalInfo: {},
      chiefComplaint: {},
      presentIllness: {},
      ...additionalData
    },
  });
};

/**
 * 获取会话详情
 */
export const getSessionById = async (id: number) => {
  return await prisma.interviewSession.findUnique({
    where: { id },
    include: { patient: true },
  });
};

/**
 * 更新会话数据 (通用)
 */
export const updateSession = async (id: number, data: any) => {
  return await prisma.interviewSession.update({
    where: { id },
    data,
  });
};

/**
 * 获取会话列表
 */
export const getSessions = async (params: {
  take?: number;
  skip?: number;
  where?: any;
  orderBy?: any;
}) => {
  return await prisma.interviewSession.findMany({
    take: params.take,
    skip: params.skip,
    where: params.where,
    orderBy: params.orderBy || { createdAt: 'desc' },
    include: { patient: true },
  });
};

/**
 * 统计会话数量
 */
export const countSessions = async (where?: any) => {
  return await prisma.interviewSession.count({ where });
};

/**
 * 删除会话
 */
export const deleteSession = async (id: number) => {
  return await prisma.interviewSession.delete({
    where: { id },
  });
};

/**
 * 批量删除会话
 */
export const deleteSessionsBulk = async (ids: number[]) => {
  return await prisma.interviewSession.deleteMany({
    where: { id: { in: ids } },
  });
};

export function canOperatorDeleteSession(params: {
  operator: OperatorIdentity;
  sessionDoctorId: number | null;
}): boolean {
  const { operator, sessionDoctorId } = params;
  if (operator.role === 'admin') {return true;}
  if (operator.role === 'doctor') {
    if (sessionDoctorId === null) {return false;}
    return sessionDoctorId === operator.operatorId;
  }
  return false;
}

export const deleteSessionPermanentlyWithPrisma = async (
  prismaClient: any,
  params: {
  sessionId: number;
  operator: OperatorIdentity;
}
) => {
  const { sessionId, operator } = params;

  const session = await prismaClient.interviewSession.findUnique({
    where: { id: sessionId },
    select: { id: true, doctorId: true },
  });

  if (!session) {
    const err: any = new Error('会话不存在');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }

  const allowed = canOperatorDeleteSession({
    operator,
    sessionDoctorId: session.doctorId ?? null,
  });
  if (!allowed) {
    const err: any = new Error('无权限删除该问诊记录');
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }

  console.log('[session.delete] 开始永久删除', {
    operatorId: operator.operatorId,
    role: operator.role,
    sessionId,
  });

  const deletedAt = new Date();
  await prismaClient.$transaction(async (tx: any) => {
    const specs = getCascadeDeleteSpecs();
    for (const spec of specs) {
      await deleteByFkIfExists(tx, spec, sessionId);
    }

    await tx.interviewSession.delete({ where: { id: sessionId } });

    await writeAuditLogIfExists(tx, { operator, sessionId, deletedAt });
  });

  console.log('[session.delete] 永久删除完成', { sessionId });

  return { deletedId: sessionId };
};

export const deleteSessionPermanently = async (params: {
  sessionId: number;
  operator: OperatorIdentity;
}) => {
  return deleteSessionPermanentlyWithPrisma(prisma, params);
};
