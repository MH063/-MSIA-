import { Request, Response } from 'express';
import * as patientService from '../services/patient.service';
import { secureLogger } from '../utils/secureLogger';

/**
 * 获取患者列表
 */
export const getPatients = async (req: Request, res: Response) => {
  try {
    const patients = await patientService.getAllPatients();
    res.json({ success: true, data: { patients } });
  } catch (error) {
    secureLogger.error('[PatientController] 获取患者列表失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to fetch patients' });
  }
};

/**
 * 创建患者
 */
export const createPatient = async (req: Request, res: Response) => {
  try {
    const patient = await patientService.createPatient(req.body);
    res.json({ success: true, data: patient });
  } catch (error) {
    secureLogger.error('[PatientController] 创建患者失败', error instanceof Error ? error : undefined);
    res.status(500).json({ success: false, message: 'Failed to create patient' });
  }
};

/**
 * 删除患者（若存在会话记录将被数据库约束拒绝）
 */
export const deletePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pid = Number(id);
    // 直接尝试删除，若存在外键约束会抛错
    await (await import('../prisma')).default.patient.delete({ where: { id: pid } });
    res.json({ success: true });
  } catch (error) {
    secureLogger.error('[PatientController] 删除患者失败', error instanceof Error ? error : undefined);
    // 外键约束错误返回 400（Prisma P2003）
    const err = error as { code?: string };
    if (err?.code === 'P2003') {
      res.status(400).json({ success: false, message: 'Cannot delete patient with existing sessions' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to delete patient' });
  }
};
