/**
 * Express 类型扩展声明
 * 扩展 Request 类型以包含操作员身份信息
 */

import { Request } from 'express';
import { OperatorIdentity, OperatorRole } from '../middleware/auth';

/**
 * 扩展 Express Request 接口
 */
declare module 'express' {
  interface Request {
    /**
     * 当前操作员身份信息
     * 由认证中间件注入
     */
    operator?: OperatorIdentity;
  }
}

/**
 * 带操作员信息的请求类型
 * 用于需要认证的控制器方法
 */
export interface AuthenticatedRequest extends Request {
  operator: OperatorIdentity;
}

/**
 * 操作员信息（简化版）
 * 用于控制器中直接访问
 */
export interface RequestOperator {
  id: number;
  role: OperatorRole;
  token: string;
}

// 确保这个文件被当作模块处理
export type { OperatorIdentity, OperatorRole };
