import { Router } from 'express';
import * as patientController from '../controllers/patient.controller';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { PatientSchemas } from '../validators';
import { requirePermission } from '../middleware/auth';

const router = Router();

// 获取患者列表 - 验证查询参数
router.get('/', requirePermission('patient:list'), validateQuery(PatientSchemas.query), patientController.getPatients);

// 创建患者 - 验证请求体
router.post('/', requirePermission('patient:create'), validateBody(PatientSchemas.create), patientController.createPatient);

// 删除患者 - 验证路由参数
router.delete('/:id', requirePermission('patient:delete'), validateParams(PatientSchemas.query), patientController.deletePatient);

export default router;
