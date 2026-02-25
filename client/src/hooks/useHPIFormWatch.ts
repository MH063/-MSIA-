import { useMemo, useRef, useEffect } from 'react';
import { Form, type FormInstance } from 'antd';

export interface HPIFormValues {
  onsetTime?: string;
  onsetMode?: string;
  trigger?: string;
  location?: string;
  quality?: string;
  severity?: string;
  durationDetails?: string;
  factors?: string;
  associatedSymptoms?: string[];
  associatedSymptomsDetails?: string;
  negativeSymptoms?: string;
  treatmentHistory?: unknown[];
  treatmentHistoryUserOrdered?: boolean;
  admissionDiagnosis?: string;
  spirit?: string;
  appetite?: string;
  sleep?: string;
  strength?: string;
  weight?: string;
  weight_change_jin?: number;
  urine_stool?: string;
  hpi_evolution?: string;
  evolution?: string;
  narrative?: string;
  narrativeSource?: string;
}

interface UseHPIFormWatchReturn {
  values: HPIFormValues;
  hasChanged: (field: keyof HPIFormValues) => boolean;
}

export const useHPIFormWatch = (form: FormInstance): UseHPIFormWatchReturn => {
  const watched = Form.useWatch('presentIllness', form) as HPIFormValues | undefined;
  const presentIllness = useMemo<HPIFormValues>(() => watched ?? ({} as HPIFormValues), [watched]);
  
  // 使用 ref 记录上一次的值，用于检测变化
  const prevValuesRef = useRef<HPIFormValues>({});
  const changedFieldsRef = useRef<Set<string>>(new Set());

  // 使用 useMemo 提取需要的字段，避免重复计算
  const values = useMemo<HPIFormValues>(() => ({
    onsetTime: presentIllness.onsetTime,
    onsetMode: presentIllness.onsetMode,
    trigger: presentIllness.trigger,
    location: presentIllness.location,
    quality: presentIllness.quality,
    severity: presentIllness.severity,
    durationDetails: presentIllness.durationDetails,
    factors: presentIllness.factors,
    associatedSymptoms: presentIllness.associatedSymptoms,
    associatedSymptomsDetails: presentIllness.associatedSymptomsDetails,
    negativeSymptoms: presentIllness.negativeSymptoms,
    treatmentHistory: presentIllness.treatmentHistory,
    treatmentHistoryUserOrdered: presentIllness.treatmentHistoryUserOrdered,
    admissionDiagnosis: presentIllness.admissionDiagnosis,
    spirit: presentIllness.spirit,
    appetite: presentIllness.appetite,
    sleep: presentIllness.sleep,
    strength: presentIllness.strength,
    weight: presentIllness.weight,
    weight_change_jin: presentIllness.weight_change_jin,
    urine_stool: presentIllness.urine_stool,
    hpi_evolution: presentIllness.hpi_evolution,
    evolution: presentIllness.evolution,
    narrative: presentIllness.narrative,
    narrativeSource: presentIllness.narrativeSource,
  }), [
    // 只依赖整个对象，而不是每个字段
    presentIllness,
  ]);

  // 检测哪些字段发生了变化
  useEffect(() => {
    const changedFields = new Set<string>();
    const prevValues = prevValuesRef.current;

    (Object.keys(values) as Array<keyof HPIFormValues>).forEach((key) => {
      if (values[key] !== prevValues[key]) {
        changedFields.add(key);
      }
    });

    changedFieldsRef.current = changedFields;
    prevValuesRef.current = values;
  }, [values]);

  // 检查特定字段是否变化的辅助函数
  const hasChanged = (field: keyof HPIFormValues): boolean => {
    return changedFieldsRef.current.has(field);
  };

  return { values, hasChanged };
};
