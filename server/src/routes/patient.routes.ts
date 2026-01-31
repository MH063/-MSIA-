import { Router } from 'express';
import * as patientController from '../controllers/patient.controller';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { PatientSchemas } from '../validators';

const router = Router();

// 获取患者列表 - 验证查询参数
router.get('/', validateQuery(PatientSchemas.query), patientController.getPatients);

// 创建患者 - 验证请求体
router.post('/', validateBody(PatientSchemas.create), patientController.createPatient);

// 删除患者 - 验证路由参数
router.delete('/:id', validateParams(PatientSchemas.query), patientController.deletePatient);

export default router;
