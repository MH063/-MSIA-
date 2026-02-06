import prisma from '../prisma';
import { OperatorIdentity } from '../middleware/auth';
import { secureLogger } from '../utils/secureLogger';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * 级联删除配置接口
 */
interface CascadeDeleteSpec {
  table: string;
  fkColumn: string;
}

/**
 * 会话创建数据接口
 */
interface SessionCreateData {
  historian?: string;
  reliability?: string;
  historianRelationship?: string;
  [key: string]: unknown;
}

/**
 * 会话查询参数接口
 */
interface SessionQueryParams {
  take?: number;
  skip?: number;
  where?: Prisma.InterviewSessionWhereInput;
  orderBy?: Prisma.InterviewSessionOrderByWithRelationInput;
}

/**
 * 自定义错误接口
 */
interface CustomError extends Error {
  statusCode?: number;
  errorCode?: string;
}

/**
 * 事务客户端类型
 */
type TransactionClient = Prisma.TransactionClient;

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
      secureLogger.warn('[SessionService] SESSION_CASCADE_TABLES_JSON 解析失败', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  return [
    { table: 'interview_session_logs', fkColumn: 'session_id' },
    { table: 'interview_session_files', fkColumn: 'session_id' },
    { table: 'interview_session_items', fkColumn: 'session_id' },
  ];
}

async function tableExists(tx: TransactionClient, tableName: string): Promise<boolean> {
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
  tx: TransactionClient,
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
  tx: TransactionClient,
  payload: { operator: OperatorIdentity; sessionId: number; deletedAt: Date }
): Promise<void> {
  const { operator, sessionId, deletedAt } = payload;
  secureLogger.info('[SessionService] 问诊记录永久删除审计日志', {
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
    secureLogger.warn('[SessionService] 审计表写入失败（将继续返回删除成功）', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * 创建问诊会话
 * @param patientId 患者ID
 * @param additionalData 附加数据
 * @returns 创建的会话
 */
export const createSession = async (patientId: number, additionalData: SessionCreateData = {}) => {
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
 * @param id 会话ID
 * @param data 更新数据
 * @returns 更新后的会话
 */
export const updateSession = async (id: number, data: Prisma.InterviewSessionUpdateInput) => {
  return await prisma.interviewSession.update({
    where: { id },
    data,
  });
};

/**
 * 获取会话列表
 * @param params 查询参数
 * @returns 会话列表
 */
export const getSessions = async (params: SessionQueryParams) => {
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
 * @param where 查询条件
 * @returns 会话数量
 */
export const countSessions = async (where?: Prisma.InterviewSessionWhereInput) => {
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

/**
 * 永久删除会话参数接口
 */
interface DeleteSessionParams {
  sessionId: number;
  operator: OperatorIdentity;
}

export const deleteSessionPermanentlyWithPrisma = async (
  prismaClient: PrismaClient,
  params: DeleteSessionParams
) => {
  const { sessionId, operator } = params;

  const session = await prismaClient.interviewSession.findUnique({
    where: { id: sessionId },
    select: { id: true, doctorId: true },
  });

  if (!session) {
    const err = new Error('会话不存在') as CustomError;
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }

  const allowed = canOperatorDeleteSession({
    operator,
    sessionDoctorId: session.doctorId ?? null,
  });
  if (!allowed) {
    const err = new Error('无权限删除该问诊记录') as CustomError;
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }

  secureLogger.info('[SessionService] 开始永久删除问诊记录', {
    operatorId: operator.operatorId,
    role: operator.role,
    sessionId,
  });

  const deletedAt = new Date();
  await prismaClient.$transaction(async (tx) => {
    const specs = getCascadeDeleteSpecs();
    for (const spec of specs) {
      await deleteByFkIfExists(tx, spec, sessionId);
    }

    await tx.interviewSession.delete({ where: { id: sessionId } });

    await writeAuditLogIfExists(tx, { operator, sessionId, deletedAt });
  });

  secureLogger.info('[SessionService] 永久删除问诊记录完成', { sessionId });

  return { deletedId: sessionId };
};

export const deleteSessionPermanently = async (params: {
  sessionId: number;
  operator: OperatorIdentity;
}) => {
  return deleteSessionPermanentlyWithPrisma(prisma, params);
};
