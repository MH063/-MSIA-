import { Request, Response } from 'express';
import * as patientService from '../services/patient.service';

/**
 * 获取患者列表
 */
export const getPatients = async (req: Request, res: Response) => {
  try {
    const patients = await patientService.getAllPatients();
    // 遵循 response.data.data 结构
    res.json({ success: true, data: patients });
  } catch (error) {
    console.error('Error fetching patients:', error);
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
    console.error('Error creating patient:', error);
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
  } catch (error: any) {
    console.error('Error deleting patient:', error);
    // 外键约束错误返回 400
    if (String(error?.message || '').includes('Foreign key')) {
      res.status(400).json({ success: false, message: 'Cannot delete patient with existing sessions' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to delete patient' });
  }
};
