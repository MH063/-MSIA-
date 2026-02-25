import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { secureLogger } from '../utils/secureLogger';

/**
 * 验证请求体的中间件工厂函数
 * @param schema Zod验证模式
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      (req as any).validatedBody = validated;
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = formatZodError(error);
        secureLogger.warn('[validateBody] 请求体校验失败', {
          method: req.method,
          path: req.path,
          errors: formattedErrors,
        });
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: formattedErrors,
          },
        });
      }
      next(error);
    }
  };
};

/**
 * 验证查询参数的中间件工厂函数
 * @param schema Zod验证模式
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      (req as any).validatedQuery = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = formatZodError(error);
        secureLogger.warn('[validateQuery] 查询参数校验失败', {
          method: req.method,
          path: req.path,
          errors: formattedErrors,
        });
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '查询参数验证失败',
            details: formattedErrors,
          },
        });
      }
      next(error);
    }
  };
};

/**
 * 验证路由参数的中间件工厂函数
 * @param schema Zod验证模式
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.params);
      (req as any).validatedParams = validated;
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = formatZodError(error);
        secureLogger.warn('[validateParams] 路由参数校验失败', {
          method: req.method,
          path: req.path,
          errors: formattedErrors,
        });
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '路由参数验证失败',
            details: formattedErrors,
          },
        });
      }
      next(error);
    }
  };
};

/**
 * 格式化Zod错误信息
 */
function formatZodError(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * 获取验证后的请求体
 * 在控制器中使用
 */
export const getValidatedBody = <T>(req: Request): T => {
  return (req as any).validatedBody as T;
};

/**
 * 获取验证后的查询参数
 * 在控制器中使用
 */
export const getValidatedQuery = <T>(req: Request): T => {
  return (req as any).validatedQuery as T;
};

/**
 * 获取验证后的路由参数
 * 在控制器中使用
 */
export const getValidatedParams = <T>(req: Request): T => {
  return (req as any).validatedParams as T;
};
