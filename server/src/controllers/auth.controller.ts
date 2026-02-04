import { Request, Response } from 'express';
import { loadOperatorFromToken, parseBearerToken } from '../middleware/auth';

export const login = async (req: Request, res: Response) => {
  try {
    const token = String((req.body as any)?.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, message: 'token 必填' });
    }

    const operator = loadOperatorFromToken(token);
    if (!operator) {
      return res.status(401).json({ success: false, message: 'token 无效' });
    }

    console.log('[auth.login] 登录成功', { operatorId: operator.operatorId, role: operator.role });
    return res.json({
      success: true,
      data: {
        operatorId: operator.operatorId,
        role: operator.role,
      },
    });
  } catch (error) {
    console.error('[auth.login] 登录失败', error);
    return res.status(500).json({ success: false, message: '登录失败' });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const token = parseBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: '缺少token' });
    }

    const operator = loadOperatorFromToken(token);
    if (!operator) {
      return res.status(401).json({ success: false, message: 'token 无效' });
    }

    return res.json({
      success: true,
      data: {
        operatorId: operator.operatorId,
        role: operator.role,
      },
    });
  } catch (error) {
    console.error('[auth.me] 获取当前用户失败', error);
    return res.status(500).json({ success: false, message: '获取当前用户失败' });
  }
};
