import { Router } from 'express';
import * as mappingController from '../controllers/mapping.controller';

const router = Router();

// 开发环境：直接访问映射接口，不需要认证
router.get('/symptoms', (req, res, next) => {
  // 开发环境跳过认证
  if (process.env.NODE_ENV === 'development') {
    next();
  } else {
    // 生产环境可以添加认证
    next();
  }
}, mappingController.getSymptomMappings);

export default router;
