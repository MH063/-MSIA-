import { useCallback, useMemo } from 'react';
import type { FormInstance } from 'antd';
import { useDebounceCallback } from './useDebounce';

interface UseFormChangeHandlerOptions {
  onBasicCheck?: (values: Record<string, unknown>) => void;
  onPanelUpdate?: (section: string) => void;
  onLinkageCheck?: (values: Record<string, unknown>, section: string) => void;
  onAutoSave?: () => void;
  isHydratingRef?: React.MutableRefObject<boolean>;
  isValidId?: boolean;
  currentSection: string;
}

export const useFormChangeHandler = (
  form: FormInstance,
  options: UseFormChangeHandlerOptions
) => {
  const {
    onBasicCheck,
    onPanelUpdate,
    onLinkageCheck,
    onAutoSave,
    isHydratingRef,
    isValidId,
    currentSection,
  } = options;

  // 使用 useMemo 缓存需要监听的字段
  const linkageFields = useMemo(() => new Set([
    'chiefComplaint',
    'presentIllness',
    'pastHistory',
    'reviewOfSystems',
    'age',
    'gender',
    'birthDate',
    'generalInfo',
  ]), []);

  // 防抖处理的基本检查
  const debouncedBasicCheck = useDebounceCallback(
    () => {
      if (onBasicCheck) {
        onBasicCheck(form.getFieldsValue(true));
      }
    },
    200
  );

  // 防抖处理的面板更新
  const debouncedPanelUpdate = useDebounceCallback(
    () => {
      if (onPanelUpdate) {
        onPanelUpdate(currentSection);
      }
    },
    250
  );

  // 防抖处理的关联检查
  const debouncedLinkageCheck = useDebounceCallback(
    () => {
      if (onLinkageCheck) {
        onLinkageCheck(form.getFieldsValue(true), currentSection);
      }
    },
    900
  );

  // 防抖处理的自动保存
  const debouncedAutoSave = useDebounceCallback(
    () => {
      if (onAutoSave && isValidId) {
        onAutoSave();
      }
    },
    1200
  );

  // 统一处理表单值变化
  const handleValuesChange = useCallback(
    (changedValues: Record<string, unknown>) => {
      // 如果正在数据回填，跳过处理
      if (isHydratingRef?.current) return;

      // 基本检查和面板更新（每次变化都执行）
      debouncedBasicCheck();
      debouncedPanelUpdate();

      // 检查是否触发关联检查
      const changedKeys = Object.keys(changedValues);
      const shouldLinkageCheck = changedKeys.some(key => linkageFields.has(key));

      if (shouldLinkageCheck) {
        debouncedLinkageCheck();
      }

      // 检查是否触发自动保存
      if (changedKeys.includes('presentIllness')) {
        debouncedAutoSave();
      }
    },
    [
      debouncedBasicCheck,
      debouncedPanelUpdate,
      debouncedLinkageCheck,
      debouncedAutoSave,
      isHydratingRef,
      linkageFields,
    ]
  );

  return { handleValuesChange };
};
