import { Router } from 'express';
import * as diagnosisController from '../controllers/diagnosis.controller';
import { validateBody, validateParams } from '../middleware/validate';
import { DiagnosisSchemas, IdParamSchema } from '../validators';
import { requirePermission } from '../middleware/auth';

const router = Router();

// 诊断建议接口 - 验证请求体
router.post('/suggest', requirePermission('diagnosis:suggest'), validateBody(DiagnosisSchemas.suggest), diagnosisController.suggestDiagnosis);
router.post('/enhanced-suggest', requirePermission('diagnosis:suggest'), validateBody(DiagnosisSchemas.enhancedSuggest), diagnosisController.suggestEnhancedDiagnosis);

// 诊断数据管理接口 - 注意：具体路由要放在参数路由之前
router.get('/list', requirePermission('diagnosis:read'), diagnosisController.getAllDiagnoses);
router.post('/init', requirePermission('diagnosis:init'), diagnosisController.initializeDiagnosisData);
router.get('/:id', requirePermission('diagnosis:read'), validateParams(IdParamSchema), diagnosisController.getDiagnosisById);

export default router;
