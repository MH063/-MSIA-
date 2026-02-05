import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { redactSensitive } from '../utils/common';

/**
 * 自定义应用错误类
 * 用于区分可预期的业务错误和不可预期的系统错误
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode: string;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    // 保持正确的堆栈跟踪
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 常见错误类型快捷创建方法
 */
export const ErrorTypes = {
  // 400 Bad Request
  BadRequest: (message: string = '请求参数错误') =>
    new AppError(message, 400, 'BAD_REQUEST'),

  // 401 Unauthorized
  Unauthorized: (message: string = '未授权访问') =>
    new AppError(message, 401, 'UNAUTHORIZED'),

  // 403 Forbidden
  Forbidden: (message: string = '禁止访问') =>
    new AppError(message, 403, 'FORBIDDEN'),

  // 404 Not Found
  NotFound: (resource: string = '资源') =>
    new AppError(`${resource}不存在`, 404, 'NOT_FOUND'),

  // 409 Conflict
  Conflict: (message: string = '资源冲突') =>
    new AppError(message, 409, 'CONFLICT'),

  // 422 Unprocessable Entity
  ValidationError: (message: string = '数据验证失败') =>
    new AppError(message, 422, 'VALIDATION_ERROR'),

  // 429 Too Many Requests
  TooManyRequests: (message: string = '请求过于频繁') =>
    new AppError(message, 429, 'TOO_MANY_REQUESTS'),

  // 500 Internal Server Error
  InternalError: (message: string = '服务器内部错误') =>
    new AppError(message, 500, 'INTERNAL_ERROR', false),
};

/**
 * Prisma错误处理辅助函数
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    // 唯一约束冲突
    case 'P2002':
      const target = (error.meta?.target as string[])?.join(', ') || '字段';
      return new AppError(
        `${target}已存在，请勿重复创建`,
        409,
        'DUPLICATE_ENTRY'
      );

    // 外键约束失败
    case 'P2003':
      return new AppError(
        '关联的资源不存在，请检查引用ID是否正确',
        400,
        'FOREIGN_KEY_CONSTRAINT'
      );

    // 记录未找到
    case 'P2025':
      return new AppError(
        '请求的资源不存在',
        404,
        'RECORD_NOT_FOUND'
      );

    // 查询超时
    case 'P2024':
      return new AppError(
        '数据库查询超时，请稍后重试',
        504,
        'DATABASE_TIMEOUT',
        false
      );

    // 连接失败
    case 'P1001':
    case 'P1002':
      return new AppError(
        '数据库连接失败，请联系管理员',
        503,
        'DATABASE_CONNECTION',
        false
      );

    default:
      return new AppError(
        '数据库操作失败',
        500,
        'DATABASE_ERROR',
        false
      );
  }
}

/**
 * 全局错误处理中间件
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // 默认错误信息
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = '服务器内部错误';
  let isOperational = false;

  // 处理自定义应用错误
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    isOperational = err.isOperational;
  }
  // 处理Prisma错误
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const appError = handlePrismaError(err);
    statusCode = appError.statusCode;
    errorCode = appError.errorCode;
    message = appError.message;
    isOperational = appError.isOperational;
  }
  // 处理Prisma验证错误
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = '数据格式验证失败，请检查输入数据类型';
    isOperational = true;
  }
  // 处理JWT错误
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = '无效的认证令牌';
    isOperational = true;
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = '认证令牌已过期，请重新登录';
    isOperational = true;
  }
  // 处理SyntaxError（通常是JSON解析错误）
  else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = '请求体JSON格式错误';
    isOperational = true;
  }

  // 记录错误日志
  const errorLog = {
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown',
    method: req.method,
    path: req.path,
    query: redactSensitive(req.query),
    statusCode,
    errorCode,
    message,
    isOperational,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress,
  };

  // 根据错误类型选择日志级别
  if (statusCode >= 500) {
    const raw =
      process.env.NODE_ENV === 'development'
        ? err
        : {
            name: err.name,
            message: err.message,
            code: (err as any)?.code,
          };
    console.error('[ErrorHandler] 原始错误:', raw);
    console.error('[ErrorHandler] Server Error:', errorLog);
  } else if (statusCode >= 400) {
    console.warn('[ErrorHandler] Client Error:', errorLog);
  }

  // 发送错误响应
  const response: any = {
    success: false,
    error: {
      code: errorCode,
      message: message,
    },
  };

  // 开发环境添加详细信息
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
    response.error.details = err.message;
  }

  res.status(statusCode).json(response);
};

/**
 * 404路由处理中间件
 * 当没有任何路由匹配时执行
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `找不到路径: ${req.method} ${req.path}`,
    },
  });
};

/**
 * 异步路由处理包装器
 * 用于自动捕获异步函数中的错误
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
