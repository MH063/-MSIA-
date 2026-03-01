/**
 * 测试工具类型定义
 * 用于消除测试文件中的 any 类型
 */
import type { Prisma } from '@prisma/client';

/**
 * Mock 函数类型
 */
export type MockFn<T extends (...args: unknown[]) => unknown = (...args: unknown[]) => unknown> = {
  mockResolvedValue: (value: ReturnType<T>) => MockFn<T>;
  mockResolvedValueOnce: (value: ReturnType<T>) => MockFn<T>;
  mockRejectedValue: (error: Error) => MockFn<T>;
  mockRejectedValueOnce: (error: Error) => MockFn<T>;
  mockReturnValue: (value: ReturnType<T>) => MockFn<T>;
  mockReturnValueOnce: (value: ReturnType<T>) => MockFn<T>;
  mockImplementation: (fn: T) => MockFn<T>;
  mockImplementationOnce: (fn: T) => MockFn<T>;
  mockClear: () => void;
  mockReset: () => void;
  mockRestore: () => void;
  getMockName: () => string;
  mock: {
    calls: Parameters<T>[];
    results: Array<{ type: string; value: ReturnType<T> }>;
    instances: unknown[];
  };
};

/**
 * Prisma 查询原始结果类型
 */
export interface QueryRawResult {
  exists: boolean;
}

/**
 * 事务调用记录
 */
export interface TransactionCall {
  name: string;
  args: unknown[];
}

/**
 * 事务客户端 Mock 接口
 */
export interface MockTransactionClient {
  $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<QueryRawResult[]>;
  $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<number>;
  interviewSession: {
    delete: (arg: Prisma.InterviewSessionDeleteArgs) => Promise<{ id: number }>;
  };
}

/**
 * Prisma 客户端 Mock 接口
 */
export interface MockPrismaClient {
  interviewSession: {
    findUnique: (arg: Prisma.InterviewSessionFindUniqueArgs) => Promise<{ id: number; doctorId: number | null } | null>;
  };
  $transaction: <T>(fn: (tx: MockTransactionClient) => Promise<T>) => Promise<T>;
  __calls: TransactionCall[];
}

/**
 * 会话创建参数
 */
export interface SessionCreateParams {
  sessionId: number;
  operator: {
    token: string;
    operatorId: number;
    role: 'admin' | 'doctor';
  };
}

/**
 * 会话查询结果
 */
export interface SessionQueryResult {
  id: number;
  doctorId: number | null;
}

/**
 * 创建 Mock Prisma 客户端工厂函数参数
 */
export interface CreateMockPrismaParams {
  findUnique: (arg: Prisma.InterviewSessionFindUniqueArgs) => Promise<SessionQueryResult | null>;
  onDelete: (arg: Prisma.InterviewSessionDeleteArgs) => Promise<{ id: number }>;
  tableExistsByName: Record<string, boolean>;
  onExecuteRawUnsafe?: (sql: string, ...values: unknown[]) => Promise<number>;
}

/**
 * 症状知识库 Mock 数据类型
 */
export interface MockSymptomKnowledge {
  id: number;
  symptomKey: string;
  displayName: string;
  category?: string;
  description?: string;
  questions?: unknown[];
  updatedAt?: Date;
}

/**
 * 患者 Mock 数据类型
 */
export interface MockPatient {
  id: number;
  name: string;
  gender: string;
  birthDate?: Date | string;
  nativePlace?: string;
  placeOfBirth?: string;
  ethnicity?: string;
  address?: string;
  occupation?: string;
  employer?: string;
  contactInfo?: Record<string, unknown>;
}

/**
 * Prisma 错误类型
 */
export interface PrismaError extends Error {
  code: string;
  meta?: Record<string, unknown>;
}

/**
 * 创建 Prisma 错误
 */
export function createPrismaError(code: string, message: string): PrismaError {
  const error = new Error(message) as PrismaError;
  error.code = code;
  return error;
}
