import { useMemo, useCallback } from 'react';
import { Form, type FormInstance } from 'antd';

export interface CompletionStats {
  total: number;
  completed: number;
  percentage: number;
}

export interface SectionCompletion {
  [section: string]: CompletionStats;
}

interface FormValues {
  generalInfo?: Record<string, unknown>;
  chiefComplaint?: Record<string, unknown>;
  presentIllness?: Record<string, unknown>;
  pastHistory?: Record<string, unknown>;
  personalHistory?: Record<string, unknown>;
  maritalHistory?: Record<string, unknown>;
  menstrualHistory?: Record<string, unknown>;
  fertilityHistory?: Record<string, unknown>;
  familyHistory?: Record<string, unknown>;
  physicalExam?: Record<string, unknown>;
  specialistExam?: Record<string, unknown>;
  auxiliaryExams?: Record<string, unknown>;
  reviewOfSystems?: Record<string, unknown>;
}

/**
 * 计算单个字段的完成状态
 */
const isFieldCompleted = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return false;
};

/**
 * 计算对象的完成度
 */
const calculateObjectCompletion = (obj: Record<string, unknown> | undefined): CompletionStats => {
  if (!obj || typeof obj !== 'object') {
    return { total: 0, completed: 0, percentage: 0 };
  }

  const entries = Object.entries(obj);
  const total = entries.length;
  const completed = entries.filter(([, value]) => isFieldCompleted(value)).length;

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
};

/**
 * 计算表单各部分完成度的 Hook
 * 使用 Form.useWatch 监听表单值变化，确保实时更新
 */
export const useCompletion = (form: FormInstance): SectionCompletion => {
  // 使用 Form.useWatch 监听整个表单的值变化
  const formValues = Form.useWatch([], form);

  /**
   * 计算完成度的函数
   */
  const calculateCompletion = useCallback((values: FormValues): SectionCompletion => {
    return {
      general: calculateObjectCompletion(values.generalInfo),
      chiefComplaint: calculateObjectCompletion(values.chiefComplaint),
      presentIllness: calculateObjectCompletion(values.presentIllness),
      pastHistory: calculateObjectCompletion(values.pastHistory),
      personalHistory: calculateObjectCompletion(values.personalHistory),
      maritalHistory: calculateObjectCompletion(values.maritalHistory),
      menstrualHistory: calculateObjectCompletion(values.menstrualHistory),
      fertilityHistory: calculateObjectCompletion(values.fertilityHistory),
      familyHistory: calculateObjectCompletion(values.familyHistory),
      physicalExam: calculateObjectCompletion(values.physicalExam),
      specialistExam: calculateObjectCompletion(values.specialistExam),
      auxiliaryExams: calculateObjectCompletion(values.auxiliaryExams),
      reviewOfSystems: calculateObjectCompletion(values.reviewOfSystems),
    };
  }, []);

  // 使用 useMemo 缓存完成度计算结果
  const completion = useMemo(() => {
    const values = (formValues || form.getFieldsValue(true)) as FormValues;
    return calculateCompletion(values);
  }, [formValues, form, calculateCompletion]);

  return completion;
};
